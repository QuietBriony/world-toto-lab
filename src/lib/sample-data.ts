import type { UserRole } from "@/lib/types";

export const defaultInitialUsers: Array<{ name: string; role: UserRole }> = [
  { name: "hazi", role: "admin" },
  ...Array.from({ length: 9 }, (_, index) => ({
    name: `空き ${index + 1}`,
    role: "member" as const,
  })),
];

const demoAccountSuffix = "（デモ）";
const placeholderAccountPattern = /^(?:空き|member)\s+\d+$/i;

export const defaultDemoUsers: Array<{ name: string; role: UserRole }> = [
  { name: `hazi${demoAccountSuffix}`, role: "admin" },
  { name: `sample 予想者${demoAccountSuffix}`, role: "admin" },
  { name: `cho1${demoAccountSuffix}`, role: "member" },
  { name: `sample watch 1${demoAccountSuffix}`, role: "member" },
  { name: `sample watch 2${demoAccountSuffix}`, role: "member" },
];

export function isDemoAccountName(name: string | null | undefined) {
  return (name ?? "").trim().endsWith(demoAccountSuffix);
}

export function isPlaceholderAccountName(name: string | null | undefined) {
  return placeholderAccountPattern.test((name ?? "").trim());
}
