import { z } from "zod";
import { isValidMoney } from "./money";

const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export const zText = (max = 200) => z.string().trim().min(1, "Required").max(max, `Must be ${max} characters or fewer`);

export const zOptText = (max = 5000) =>
  z.preprocess((v) => (empty(v) ? null : typeof v === "string" ? v.trim() : v), z.string().max(max).nullable()).optional();

export const zOptId = z.preprocess((v) => (empty(v) ? null : v), z.string().min(1).max(60).nullable()).optional();

export const zOptDate = z
  .preprocess((v) => (empty(v) ? null : v), z.coerce.date({ invalid_type_error: "Invalid date" }).nullable())
  .optional();

export const zDate = z.coerce.date({ invalid_type_error: "Invalid date", required_error: "Required" });

export const zMoney = z
  .string()
  .trim()
  .refine((v) => isValidMoney(v), "Enter an amount with up to 2 decimal places");

export const zOptMoney = z.preprocess((v) => (empty(v) ? null : v), zMoney.nullable()).optional();

export const zDecimal = z
  .string()
  .trim()
  .refine((v) => /^-?\d{1,14}(\.\d{1,4})?$/.test(v), "Enter a number with up to 4 decimal places");

export const zOptDecimal = z.preprocess((v) => (empty(v) ? null : v), zDecimal.nullable()).optional();

export const zCheckbox = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());

export const zEmail = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const zOptEmail = z.preprocess((v) => (empty(v) ? null : v), zEmail.nullable()).optional();

export const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const zOptUrl = z
  .preprocess(
    (v) => (empty(v) ? null : v),
    z
      .string()
      .trim()
      .max(500)
      .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), "Enter a full URL starting with http:// or https://")
      .nullable(),
  )
  .optional();

/** Convert FormData to a plain object; keys ending in [] become arrays. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of fd.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    if (rawKey.endsWith("[]")) {
      const key = rawKey.slice(0, -2);
      (out[key] ??= [] as string[]);
      (out[key] as string[]).push(value);
    } else {
      out[rawKey] = value;
    }
  }
  return out;
}
