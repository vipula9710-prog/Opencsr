import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function emailEnabled() {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Sends an email when SMTP is configured. Never throws: failures are logged so
 * that the calling workflow (e.g. storing an enquiry) is not interrupted.
 */
export async function sendMail(msg: { to: string | string[]; subject: string; text: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.SMTP_FROM, to: msg.to, subject: msg.subject, text: msg.text });
    return true;
  } catch (err) {
    logger.error("email delivery failed", { err, subject: msg.subject });
    return false;
  }
}
