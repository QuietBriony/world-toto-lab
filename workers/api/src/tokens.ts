/**
 * 共有コード / 編集・管理トークンの生成と検証（Web Crypto を使用）。
 *
 * - editToken / adminToken は平文を D1 に保存せず SHA-256 hex のみ保存する。
 * - 比較は length-safe な定数時間比較を使う。
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** ランダムな hex トークン（既定 24 バイト = 48 hex）。 */
export function generateToken(byteLength = 24): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return toHex(buffer);
}

/** 人が共有しやすい短めの共有コード。 */
export function generateShareCode(): string {
  return generateToken(9);
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export type RoundTokens = {
  shareCode: string;
  editToken: string;
  adminToken: string;
};

export function generateRoundTokens(): RoundTokens {
  return {
    shareCode: generateShareCode(),
    editToken: generateToken(24),
    adminToken: generateToken(24),
  };
}
