/**
 * `<input type="datetime-local">` と、保存される UTC ISO 文字列の相互変換。
 *
 * datetime-local はタイムゾーンを持たない「壁時計」入力。保存値（UTC ISO）と
 * 入力欄を素朴に `new Date(iso).toISOString().slice(0,16)` ／ `new Date(value).toISOString()`
 * で往復すると、初期化は UTC 壁時計・保存はローカル解釈という非対称になり、
 * JST 環境では (1) 見出し表示(Asia/Tokyo)と編集欄が9時間ずれ、(2) 無編集保存でも
 * kickoff が毎回 9 時間後退する。ここでは初期化・保存とも Asia/Tokyo 規約で統一し
 * 往復不変にする。日本は夏時間が無いため固定オフセット +09:00 で安全。
 */
const TOKYO_TIME_ZONE = "Asia/Tokyo";
const TOKYO_UTC_OFFSET = "+09:00";

/** 保存値（UTC ISO 等）を Asia/Tokyo 壁時計の datetime-local 値 "YYYY-MM-DDTHH:mm" にする。 */
export function isoToTokyoDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}`;
}

/** datetime-local 値（Asia/Tokyo 壁時計）を UTC ISO 文字列にする。空/不正なら null。 */
export function tokyoDateTimeLocalToIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const matched = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/.exec(trimmed);
  if (!matched) {
    return null;
  }
  const withSeconds = matched[2] ? trimmed : `${matched[1]}:00`;
  const date = new Date(`${withSeconds}${TOKYO_UTC_OFFSET}`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
