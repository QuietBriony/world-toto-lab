import type { User, UserRole } from "@/lib/types";

export const userRoleLabel: Record<UserRole, string> = {
  admin: "予想者",
  member: "ウォッチ",
};

export const userRoleDescription: Record<UserRole, string> = {
  admin: "AIと並べて比較したい人力予想者です。",
  member: "AIか予想者のどちらに乗るかを選ぶ役割です。",
};

export function parseUserRole(value: string | null | undefined): UserRole {
  return value === "admin" ? "admin" : "member";
}

export function isPredictorRole(role: UserRole) {
  return role === "admin";
}

export function isPredictorUser(
  user: Pick<User, "role"> | null | undefined,
): user is Pick<User, "role"> {
  return Boolean(user && isPredictorRole(user.role));
}

export function filterPredictors<T extends { role: UserRole }>(users: T[]) {
  return users.filter((user) => isPredictorRole(user.role));
}

export function filterWatchers<T extends { role: UserRole }>(users: T[]) {
  return users.filter((user) => !isPredictorRole(user.role));
}

export function nextPredictorLineName(users: Array<Pick<User, "name">>, baseName: string) {
  const matched = baseName.trim().match(/^(.*?)(?:\s+(\d+))?$/);
  const normalizedBase = matched?.[1]?.trim() || baseName.trim();
  const taken = new Set(users.map((user) => user.name.trim()));

  if (!taken.has(normalizedBase)) {
    return normalizedBase;
  }

  let index = 2;
  while (taken.has(`${normalizedBase} ${index}`)) {
    index += 1;
  }

  return `${normalizedBase} ${index}`;
}
