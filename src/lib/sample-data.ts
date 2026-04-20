import type { UserRole } from "@/lib/types";

export const defaultInitialUsers: Array<{ name: string; role: UserRole }> = [
  { name: "hazi", role: "admin" },
  ...Array.from({ length: 9 }, (_, index) => ({
    name: `空き ${index + 1}`,
    role: "member" as const,
  })),
];
