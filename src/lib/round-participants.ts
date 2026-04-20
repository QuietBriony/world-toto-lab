import type { User } from "@/lib/types";

const roundParticipantsPattern = /^\[\[participants:([0-9a-f-,]+)]](?:\n([\s\S]*))?$/i;

export function parseRoundParticipantsNote(rawNote: string | null | undefined) {
  if (!rawNote) {
    return {
      notes: null,
      participantIds: [] as string[],
    };
  }

  const matched = rawNote.match(roundParticipantsPattern);
  if (!matched) {
    return {
      notes: rawNote,
      participantIds: [],
    };
  }

  const participantIds = Array.from(
    new Set(
      matched[1]
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  return {
    notes: matched[2]?.trim() || null,
    participantIds,
  };
}

export function encodeRoundParticipantsNote(
  notes: string | null | undefined,
  participantIds: string[] | null | undefined,
) {
  const normalizedNotes = notes?.trim() || null;
  const normalizedParticipantIds = Array.from(
    new Set(
      (participantIds ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  if (normalizedParticipantIds.length === 0) {
    return normalizedNotes;
  }

  const token = `[[participants:${normalizedParticipantIds.join(",")}]]`;
  return normalizedNotes ? `${token}\n${normalizedNotes}` : token;
}

export function resolveRoundParticipantUsers(
  users: User[],
  participantIds: string[] | null | undefined,
) {
  const normalizedParticipantIds = Array.from(
    new Set((participantIds ?? []).filter(Boolean)),
  );

  if (normalizedParticipantIds.length === 0) {
    return users;
  }

  const selectedUsers = users.filter((user) => normalizedParticipantIds.includes(user.id));
  return selectedUsers.length > 0 ? selectedUsers : users;
}
