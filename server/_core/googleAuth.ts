import * as db from "../db";
import { ENV } from "./env";
import type { GoogleTokenResponse, GoogleUserInfo } from "./types/googleAuth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

async function resolveCredentials() {
  const settings = await db.getSiteSettings();
  return {
    clientId: (settings.googleClientId || ENV.googleClientId || "").trim(),
    clientSecret: (settings.googleClientSecret || ENV.googleClientSecret || "").trim(),
  };
}

export async function isGoogleConfigured(): Promise<boolean> {
  const { clientId, clientSecret } = await resolveCredentials();
  return Boolean(clientId && clientSecret);
}

export async function buildGoogleAuthUrl(
  redirectUri: string,
  state: string
): Promise<string> {
  const { clientId } = await resolveCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = await resolveCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }

  return (await res.json()) as GoogleUserInfo;
}
