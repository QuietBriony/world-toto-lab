from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    speaker: str | None = None


def format_ts(seconds: float) -> str:
    seconds = max(0.0, seconds)
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(int(minutes), 60)
    return f"{hours:02d}:{minutes:02d}:{secs:05.2f}"


def choose_whisper_attempts(model: str, device: str, compute_type: str) -> list[tuple[str, str, str]]:
    if device != "auto":
        return [(model, device, compute_type)]

    return [
        (model, "cuda", "float16"),
        (model, "cuda", "int8_float16"),
        ("medium", "cuda", "float16"),
        ("medium", "cuda", "int8_float16"),
        ("medium", "cpu", "int8"),
        ("small", "cpu", "int8"),
    ]


def transcribe_audio(
    audio_path: Path,
    out_dir: Path,
    model_name: str,
    device: str,
    compute_type: str,
    language: str,
) -> tuple[list[TranscriptSegment], dict[str, Any]]:
    from faster_whisper import WhisperModel

    errors: list[str] = []
    for attempt_model, attempt_device, attempt_compute_type in choose_whisper_attempts(
        model_name, device, compute_type
    ):
        try:
            model = WhisperModel(
                attempt_model,
                device=attempt_device,
                compute_type=attempt_compute_type,
                download_root=str(out_dir / "models" / "faster-whisper"),
            )
            raw_segments, info = model.transcribe(
                str(audio_path),
                language=language,
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 450},
            )
            segments = [
                TranscriptSegment(
                    start=float(segment.start),
                    end=float(segment.end),
                    text=segment.text.strip(),
                )
                for segment in raw_segments
                if segment.text.strip()
            ]
            metadata = {
                "model": attempt_model,
                "device": attempt_device,
                "compute_type": attempt_compute_type,
                "language": getattr(info, "language", language),
                "language_probability": getattr(info, "language_probability", None),
                "duration": getattr(info, "duration", None),
                "errors_before_success": errors,
            }
            return segments, metadata
        except Exception as exc:
            errors.append(
                f"{attempt_model}/{attempt_device}/{attempt_compute_type}: "
                f"{type(exc).__name__}: {exc}"
            )

    raise RuntimeError("Whisper transcription failed: " + " | ".join(errors))


def load_audio_mono(audio_path: Path) -> tuple[Any, int]:
    import soundfile as sf
    import torch

    samples, sample_rate = sf.read(str(audio_path), dtype="float32", always_2d=True)
    mono = samples.mean(axis=1, keepdims=True).T
    return torch.from_numpy(mono), int(sample_rate)


def collect_embeddings(
    audio_path: Path,
    segments: list[TranscriptSegment],
    out_dir: Path,
) -> tuple[np.ndarray | None, list[int], str | None]:
    try:
        import torch
        from speechbrain.inference.speaker import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy
    except Exception as exc:
        return None, [], f"speechbrain import failed: {type(exc).__name__}: {exc}"

    try:
        waveform, sample_rate = load_audio_mono(audio_path)
        classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=str(out_dir / "models" / "speechbrain-spkrec-ecapa-voxceleb"),
            run_opts={"device": "cpu"},
            local_strategy=LocalStrategy.COPY_SKIP_CACHE,
        )
    except Exception as exc:
        return None, [], f"speechbrain model load failed: {type(exc).__name__}: {exc}"

    embeddings: list[np.ndarray] = []
    segment_indexes: list[int] = []
    total_samples = waveform.shape[1]
    for index, segment in enumerate(segments):
        duration = segment.end - segment.start
        if duration < 0.45:
            continue

        start = max(0.0, segment.start - max(0.0, 0.8 - duration) / 2)
        end = min(total_samples / sample_rate, segment.end + max(0.0, 0.8 - duration) / 2)
        start_sample = max(0, int(math.floor(start * sample_rate)))
        end_sample = min(total_samples, int(math.ceil(end * sample_rate)))
        if end_sample - start_sample < int(sample_rate * 0.45):
            continue

        clip = waveform[:, start_sample:end_sample]
        try:
            with torch.no_grad():
                embedding = classifier.encode_batch(clip).detach().cpu().numpy().reshape(-1)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embeddings.append(embedding / norm)
                segment_indexes.append(index)
        except Exception:
            continue

    if len(embeddings) < 2:
        return None, [], "not enough diarization embeddings"

    return np.vstack(embeddings), segment_indexes, None


def choose_cluster_labels(embeddings: np.ndarray, max_speakers: int) -> np.ndarray:
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score

    count = embeddings.shape[0]
    if count < 4:
        return np.zeros(count, dtype=int)

    best_labels: np.ndarray | None = None
    best_score = -1.0
    upper = min(max_speakers, count - 1)
    for clusters in range(2, upper + 1):
        labels = AgglomerativeClustering(
            n_clusters=clusters,
            metric="cosine",
            linkage="average",
        ).fit_predict(embeddings)
        if len(set(labels.tolist())) < 2:
            continue
        score = silhouette_score(embeddings, labels, metric="cosine")
        if score > best_score:
            best_score = float(score)
            best_labels = labels

    if best_labels is None:
        return np.zeros(count, dtype=int)
    return best_labels


def diarize_segments(
    audio_path: Path,
    segments: list[TranscriptSegment],
    out_dir: Path,
    max_speakers: int,
) -> dict[str, Any]:
    embeddings, segment_indexes, warning = collect_embeddings(audio_path, segments, out_dir)
    if embeddings is None:
        for segment in segments:
            segment.speaker = "Speaker 1"
        return {"method": "fallback-single-speaker", "warning": warning}

    try:
        labels = choose_cluster_labels(embeddings, max_speakers=max_speakers)
    except Exception as exc:
        for segment in segments:
            segment.speaker = "Speaker 1"
        return {
            "method": "fallback-single-speaker",
            "warning": f"clustering failed: {type(exc).__name__}: {exc}",
        }

    label_order: dict[int, int] = {}
    for label in labels.tolist():
        if label not in label_order:
            label_order[label] = len(label_order) + 1

    for segment in segments:
        segment.speaker = "Speaker 1"
    for segment_index, label in zip(segment_indexes, labels.tolist(), strict=True):
        segments[segment_index].speaker = f"Speaker {label_order[label]}"

    return {
        "method": "speechbrain-ecapa-segment-clustering",
        "speaker_count": len(label_order),
        "embedded_segments": len(segment_indexes),
    }


def write_outputs(
    out_dir: Path,
    source_audio: Path,
    segments: list[TranscriptSegment],
    transcription: dict[str, Any],
    diarization: dict[str, Any],
) -> None:
    payload = {
        "source_audio": str(source_audio),
        "transcription": transcription,
        "diarization": diarization,
        "segments": [
            {
                "start": segment.start,
                "end": segment.end,
                "speaker": segment.speaker,
                "text": segment.text,
            }
            for segment in segments
        ],
    }

    (out_dir / "transcript.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# Voice requirements transcript",
        "",
        f"- Source: `{source_audio}`",
        (
            f"- Whisper: {transcription['model']} / {transcription['device']} / "
            f"{transcription['compute_type']}"
        ),
        f"- Diarization: {diarization.get('method', 'unknown')}",
    ]
    if diarization.get("warning"):
        lines.append(f"- Diarization warning: {diarization['warning']}")
    lines.append("")

    previous_speaker = None
    for segment in segments:
        speaker = segment.speaker or "Speaker 1"
        prefix = f"[{format_ts(segment.start)}-{format_ts(segment.end)}]"
        if speaker != previous_speaker:
            lines.append("")
            lines.append(f"## {speaker}")
            previous_speaker = speaker
        lines.append(f"{prefix} {segment.text}")

    (out_dir / "transcript.md").write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--out-dir", type=Path, default=Path("generated/voice-requirements"))
    parser.add_argument("--model", default="large-v3")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    parser.add_argument("--compute-type", default="float16")
    parser.add_argument("--language", default="ja")
    parser.add_argument("--max-speakers", type=int, default=4)
    parser.add_argument("--diarize-existing", action="store_true")
    args = parser.parse_args()

    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.diarize_existing:
        existing_path = out_dir / "transcript.json"
        existing = json.loads(existing_path.read_text(encoding="utf-8"))
        transcription = existing.get("transcription", {})
        segments = [
            TranscriptSegment(
                start=float(segment["start"]),
                end=float(segment["end"]),
                text=str(segment["text"]),
            )
            for segment in existing.get("segments", [])
        ]
    else:
        segments, transcription = transcribe_audio(
            audio_path=args.audio,
            out_dir=out_dir,
            model_name=args.model,
            device=args.device,
            compute_type=args.compute_type,
            language=args.language,
        )
    diarization = diarize_segments(
        audio_path=args.audio,
        segments=segments,
        out_dir=out_dir,
        max_speakers=max(1, args.max_speakers),
    )
    write_outputs(out_dir, args.audio, segments, transcription, diarization)
    print(json.dumps({"segments": len(segments), **transcription, "diarization": diarization}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
