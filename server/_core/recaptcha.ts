import * as db from "../db";
import { ENV } from "./env";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export type RecaptchaResult =
  | { ok: true; score: number; action?: string }
  | { ok: false; reason: string };

/**
 * Verifica um token reCAPTCHA v3. Se nenhuma secret key estiver configurada
 * (em site_settings nem em ENV), retorna `ok: true` com score = 1
 * (desabilita a verificação — útil em dev).
 */
export async function verifyRecaptcha(
  token: string | undefined | null,
  expectedAction?: string
): Promise<RecaptchaResult> {
  const settings = await db.getSiteSettings();
  const secret = (settings.recaptchaSecretKey || ENV.recaptchaSecretKey || "").trim();
  const minScore = Number(settings.recaptchaMinScore) || 0.5;

  if (!secret) {
    return { ok: true, score: 1 };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };
    if (!data.success) {
      return {
        ok: false,
        reason: `siteverify_failed:${(data["error-codes"] ?? []).join(",") || "unknown"}`,
      };
    }
    const score = typeof data.score === "number" ? data.score : 1;
    if (expectedAction && data.action && data.action !== expectedAction) {
      return { ok: false, reason: `action_mismatch:${data.action}` };
    }
    if (score < minScore) {
      return { ok: false, reason: `low_score:${score.toFixed(2)}` };
    }
    return { ok: true, score, action: data.action };
  } catch (error) {
    console.error("[reCAPTCHA] verify error", error);
    return { ok: false, reason: "verify_error" };
  }
}
