import {
  enumToOutcome,
  favoriteOutcome,
  parseOutcomeList,
  type OutcomeValue,
} from "@/lib/domain";
import type { PickSupport, User } from "@/lib/types";

type SupportMatch = {
  id: string;
  modelProb0: number | null;
  modelProb1: number | null;
  modelProb2: number | null;
  recommendedOutcomes: string | null;
};

const supportPattern = /^\[\[support:(ai|predictor:[^\]]+)]](?:\n([\s\S]*))?$/;

export function parsePickSupportNote(rawNote: string | null | undefined): {
  note: string | null;
  support: PickSupport;
} {
  if (!rawNote) {
    return {
      note: null,
      support: { kind: "manual" },
    };
  }

  const matched = rawNote.match(supportPattern);
  if (!matched) {
    return {
      note: rawNote,
      support: { kind: "manual" },
    };
  }

  const note = matched[2]?.trim() || null;
  if (matched[1] === "ai") {
    return {
      note,
      support: { kind: "ai" },
    };
  }

  return {
    note,
    support: {
      kind: "predictor",
      userId: matched[1].replace("predictor:", ""),
    },
  };
}

export function encodePickSupportNote(
  note: string | null | undefined,
  support: PickSupport,
) {
  const normalizedNote = note?.trim() || null;
  if (support.kind === "manual") {
    return normalizedNote;
  }

  const token =
    support.kind === "ai"
      ? "[[support:ai]]"
      : `[[support:predictor:${support.userId}]]`;

  return normalizedNote ? `${token}\n${normalizedNote}` : token;
}

export function pickSupportValue(support: PickSupport | null | undefined) {
  if (!support || support.kind === "manual") {
    return "manual";
  }

  if (support.kind === "ai") {
    return "ai";
  }

  return support.userId;
}

export function pickSupportFromValue(value: string | null | undefined): PickSupport {
  if (!value || value === "manual") {
    return { kind: "manual" };
  }

  if (value === "ai") {
    return { kind: "ai" };
  }

  return {
    kind: "predictor",
    userId: value,
  };
}

export function supportLabel(
  support: PickSupport | null | undefined,
  userById: Map<string, User>,
) {
  if (!support || support.kind === "manual") {
    return "手入力";
  }

  if (support.kind === "ai") {
    return "AI";
  }

  return userById.get(support.userId)?.name ?? "予想者";
}

export function resolveSupportedOutcome(input: {
  match: SupportMatch;
  picks: Array<{
    matchId: string;
    pick: "ONE" | "DRAW" | "TWO";
    userId: string;
  }>;
  support: PickSupport;
}): OutcomeValue | "" {
  if (input.support.kind === "manual") {
    return "";
  }

  if (input.support.kind === "ai") {
    const saved = parseOutcomeList(input.match.recommendedOutcomes);
    return (
      saved[0] ??
      favoriteOutcome({
        "1": input.match.modelProb1,
        "0": input.match.modelProb0,
        "2": input.match.modelProb2,
      }) ??
      ""
    );
  }

  const predictorId = input.support.kind === "predictor" ? input.support.userId : null;
  const pick = predictorId
    ? input.picks.find(
        (candidate) =>
          candidate.matchId === input.match.id && candidate.userId === predictorId,
      )
    : null;

  return enumToOutcome(pick?.pick) ?? "";
}
