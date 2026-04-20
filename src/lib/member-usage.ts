import type {
  HumanScoutReport,
  Pick,
  ReviewNote,
  User,
} from "@/lib/types";
import { isPlaceholderAccountName } from "@/lib/sample-data";

export type MemberUsageSummary = {
  userId: string;
  isPlaceholderName: boolean;
  pickCount: number;
  scoutReportCount: number;
  reviewNoteCount: number;
  supportRefCount: number;
  hasDirectInput: boolean;
  isEmpty: boolean;
  canQuickDelete: boolean;
};

type UsageCollections = {
  picks: Pick[];
  reviewNotes?: ReviewNote[];
  scoutReports?: HumanScoutReport[];
  users: User[];
};

type StatusTone = "amber" | "sky" | "slate" | "teal";

export type MemberUsageStatus = {
  detail: string;
  label: string;
  tone: StatusTone;
};

function createEmptySummary(user: { id: string; name: string }): MemberUsageSummary {
  return {
    userId: user.id,
    isPlaceholderName: isPlaceholderAccountName(user.name),
    pickCount: 0,
    scoutReportCount: 0,
    reviewNoteCount: 0,
    supportRefCount: 0,
    hasDirectInput: false,
    isEmpty: true,
    canQuickDelete: true,
  };
}

function detailParts(summary: MemberUsageSummary) {
  const parts: string[] = [];

  if (summary.pickCount > 0) {
    parts.push(`${summary.pickCount}予想`);
  }

  if (summary.scoutReportCount > 0) {
    parts.push(`${summary.scoutReportCount}根拠`);
  }

  if (summary.reviewNoteCount > 0) {
    parts.push(`${summary.reviewNoteCount}メモ`);
  }

  return parts;
}

export function buildMemberUsageMap(input: UsageCollections) {
  const userById = new Map(input.users.map((user) => [user.id, user]));
  const map = new Map<string, MemberUsageSummary>(
    input.users.map((user) => [user.id, createEmptySummary(user)]),
  );

  const ensureSummary = (userId: string) => {
    const sourceUser = userById.get(userId);
    const current =
      map.get(userId) ??
      createEmptySummary({
        id: userId,
        name: sourceUser?.name ?? "",
      });
    map.set(userId, current);
    return current;
  };

  input.picks.forEach((pick) => {
    const summary = ensureSummary(pick.userId);
    summary.pickCount += 1;

    if (pick.support.kind === "predictor") {
      const referenced = ensureSummary(pick.support.userId);
      referenced.supportRefCount += 1;
    }
  });

  (input.scoutReports ?? []).forEach((report) => {
    const summary = ensureSummary(report.userId);
    summary.scoutReportCount += 1;
  });

  (input.reviewNotes ?? []).forEach((note) => {
    if (!note.userId) {
      return;
    }

    const summary = ensureSummary(note.userId);
    summary.reviewNoteCount += 1;
  });

  map.forEach((summary, userId) => {
    const hasDirectInput =
      summary.pickCount > 0 ||
      summary.scoutReportCount > 0 ||
      summary.reviewNoteCount > 0;

    map.set(userId, {
      ...summary,
      hasDirectInput,
      isEmpty: !hasDirectInput && summary.supportRefCount === 0,
      canQuickDelete: !hasDirectInput && summary.supportRefCount === 0,
    });
  });

  return map;
}

export function describeMemberInventoryStatus(summary: MemberUsageSummary): MemberUsageStatus {
  if (summary.canQuickDelete) {
    return {
      label: summary.isPlaceholderName ? "空き" : "入力なし",
      tone: "slate",
      detail: summary.isPlaceholderName
        ? "入力がないので、この画面から整理できます。"
        : "まだ本番入力がないので、この画面から整理できます。",
    };
  }

  if (!summary.hasDirectInput && summary.supportRefCount > 0) {
    return {
      label: "支持先で使用中",
      tone: "sky",
      detail: `${summary.supportRefCount}件の支持先として使われています。`,
    };
  }

  return {
    label: "入力あり",
    tone: "teal",
    detail: detailParts(summary).join(" / "),
  };
}

export function describeRoundMemberStatus(
  summary: MemberUsageSummary,
  matchCount: number,
): MemberUsageStatus {
  if (summary.pickCount > 0) {
    return {
      label: `入力済 ${summary.pickCount}/${matchCount}`,
      tone: "teal",
      detail: "このラウンドでは入力があります。",
    };
  }

  if (summary.scoutReportCount > 0 || summary.reviewNoteCount > 0) {
    return {
      label: "未入力",
      tone: "amber",
      detail: "このラウンドの予想はまだ入っていません。",
    };
  }

  if (summary.supportRefCount > 0) {
    return {
      label: "支持先で使用中",
      tone: "sky",
      detail: `${summary.supportRefCount}件の支持先として参照されています。`,
    };
  }

  return {
    label: summary.isPlaceholderName ? "空き" : "入力なし",
    tone: "slate",
    detail: summary.isPlaceholderName
      ? "このラウンドではまだ使っていません。"
      : "このラウンドではまだ入力がありません。",
  };
}
