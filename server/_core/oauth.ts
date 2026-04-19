import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";

import * as db from "../db";
import { getSessionCookieDomains, getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  isGoogleConfigured,
} from "./googleAuth";
import { verifyRecaptcha } from "./recaptcha";
import { sdk } from "./sdk";

function clearSessionCookies(res: Response, req: Request) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, domain: undefined, maxAge: -1 });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  for (const domain of getSessionCookieDomains(req)) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, domain, maxAge: -1 });
  }
}

function setSessionCookie(res: Response, req: Request, token: string) {
  const cookieOptions = getSessionCookieOptions(req);
  clearSessionCookies(res, req);
  const baseOptions = { ...cookieOptions, maxAge: ONE_YEAR_MS };
  res.cookie(COOKIE_NAME, token, baseOptions);
  for (const domain of getSessionCookieDomains(req)) {
    res.cookie(COOKIE_NAME, token, { ...baseOptions, domain });
  }
}

function getGoogleRedirectUri(): string {
  const base = ENV.appUrl.replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(128),
  recaptchaToken: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export function registerAuthRoutes(app: Express) {
  // ── Google OAuth: start ─────────────────────────────────────────────────────
  app.get("/api/auth/google/start", async (_req: Request, res: Response) => {
    const configured = await isGoogleConfigured();
    if (!configured) {
      res.status(500).json({ error: "Google OAuth not configured" });
      return;
    }
    const state = nanoid(24);
    const url = await buildGoogleAuthUrl(getGoogleRedirectUri(), state);
    res.redirect(302, url);
  });

  // ── Google OAuth: callback ──────────────────────────────────────────────────
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    if (!code) {
      res.status(400).json({ error: "code required" });
      return;
    }

    try {
      const tokens = await exchangeGoogleCode(code, getGoogleRedirectUri());
      const info = await getGoogleUserInfo(tokens.access_token);

      if (!info.sub) {
        res.status(400).json({ error: "Google user sub missing" });
        return;
      }

      const openId = `google:${info.sub}`;
      const name = info.name || info.email || "Usuário";

      await db.upsertUser({
        openId,
        name,
        email: info.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, { name });
      setSessionCookie(res, req, sessionToken);
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // ── Email/password: check-email ─────────────────────────────────────────────
  app.post("/api/auth/check-email", async (req: Request, res: Response) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Email inválido" });
        return;
      }
      const email = parsed.data.email;
      const user =
        (await db.getUserByOpenId(email)) ?? (await db.getUserByEmail(email));
      res.status(200).json({
        exists: Boolean(user),
        hasPassword: Boolean(user?.passwordHash),
        name: user?.name ?? null,
      });
    } catch (error) {
      console.error("[Auth] check-email failed", error);
      res.status(500).json({ error: "Falha ao verificar email" });
    }
  });

  // ── Email/password: register ────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = credentialsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Dados inválidos" });
        return;
      }
      const { email, name, password, recaptchaToken } = parsed.data;

      const captcha = await verifyRecaptcha(recaptchaToken, "register");
      if (!captcha.ok) {
        res.status(400).json({ error: `reCAPTCHA falhou (${captcha.reason})` });
        return;
      }

      const existing = await db.getUserByOpenId(email);
      if (existing?.passwordHash) {
        res.status(409).json({ error: "Usuário já existe" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await db.upsertUser({
        openId: email,
        email,
        name: name ?? email,
        loginMethod: "password",
        passwordHash,
        lastSignedIn: new Date(),
        role: email === ENV.ownerOpenId ? "admin" : undefined,
      });

      const sessionToken = await sdk.createSessionToken(email, {
        name: name ?? email,
      });
      setSessionCookie(res, req, sessionToken);
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("[Auth] register failed", error);
      res.status(500).json({ error: "Falha ao criar conta" });
    }
  });

  // ── Email/password: login ───────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = credentialsSchema.omit({ name: true }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Dados inválidos" });
        return;
      }
      const { email, password, recaptchaToken } = parsed.data;

      const captcha = await verifyRecaptcha(recaptchaToken, "login");
      if (!captcha.ok) {
        res.status(400).json({ error: `reCAPTCHA falhou (${captcha.reason})` });
        return;
      }

      const user = await db.getUserByOpenId(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
      });
      setSessionCookie(res, req, sessionToken);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Auth] login failed", error);
      res.status(500).json({ error: "Falha ao autenticar" });
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    clearSessionCookies(res, req);
    res.status(200).json({ success: true });
  });
}
