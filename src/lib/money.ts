// Monetary values are stored as PostgreSQL NUMERIC and transported as strings.
// Arithmetic is performed on integer minor units (BigInt) to avoid floating
// point rounding errors.

export type MoneyInput = string | number | { toString(): string } | null | undefined;

const SCALE = 100n;

export function toMinor(value: MoneyInput): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  const str = typeof value === "number" ? value.toFixed(2) : value.toString().trim();
  const match = /^(-)?(\d+)(?:\.(\d{0,}))?$/.exec(str);
  if (!match) throw new Error(`Invalid monetary amount: ${str}`);
  const [, sign, whole, fraction = ""] = match;
  // Round half away from zero on the third decimal.
  const frac2 = (fraction + "000").slice(0, 3);
  let minor = BigInt(whole) * SCALE + BigInt(frac2.slice(0, 2));
  if (Number(frac2[2]) >= 5) minor += 1n;
  return sign ? -minor : minor;
}

export function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function sumMoney(values: MoneyInput[]): string {
  return fromMinor(values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n));
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): string {
  return fromMinor(toMinor(a) - toMinor(b));
}

export function compareMoney(a: MoneyInput, b: MoneyInput): number {
  const d = toMinor(a) - toMinor(b);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
}

/** Percentage (0–100, one decimal) of part over whole. Returns 0 when whole is 0. */
export function percentOf(part: MoneyInput, whole: MoneyInput): number {
  const w = toMinor(whole);
  if (w === 0n) return 0;
  const p = toMinor(part);
  return Number((p * 1000n) / w) / 10;
}

export function isValidMoney(value: string): boolean {
  return /^\d{1,14}(\.\d{1,2})?$/.test(value.trim());
}

export function formatMoney(value: MoneyInput, currency = "INR", locale = "en-IN"): string {
  const minor = toMinor(value);
  const asNumber = Number(minor) / 100;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(asNumber);
  } catch {
    return `${currency} ${fromMinor(minor)}`;
  }
}
