import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { nanoid } from "nanoid";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieDomains, getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function clearSessionCookies(
  res: CreateExpressContextOptions["res"],
  req: CreateExpressContextOptions["req"]
) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, domain: undefined, maxAge: -1 });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  for (const domain of getSessionCookieDomains(req)) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, domain, maxAge: -1 });
  }
}

function setSessionCookie(
  res: CreateExpressContextOptions["res"],
  req: CreateExpressContextOptions["req"],
  token: string
) {
  const cookieOptions = getSessionCookieOptions(req);
  const domains = getSessionCookieDomains(req);
  clearSessionCookies(res, req);
  const baseOptions = {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  };
  // Host-only cookie
  res.cookie(COOKIE_NAME, token, baseOptions);
  // Also set on known domains to avoid mismatches between www/root.
  for (const domain of domains) {
    res.cookie(COOKIE_NAME, token, { ...baseOptions, domain });
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const cookieHeader = opts.req.headers.cookie;
  const hasSessionCookie =
    typeof cookieHeader === "string" &&
    cookieHeader.includes(`${COOKIE_NAME}=`);

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    if (hasSessionCookie) {
      // Cookie inválido: limpa para evitar loop de autenticação.
      clearSessionCookies(opts.res, opts.req);
    }

    // Sempre cria uma sessão anônima quando não houver usuário autenticado,
    // inclusive após limpar cookie inválido.
    const openId = `anon_${nanoid(16)}`;
    await db.upsertUser({
      openId,
      name: "Visitante",
      loginMethod: "anonymous",
    });
    const sessionToken = await sdk.createSessionToken(openId, {
      name: "Visitante",
      expiresInMs: ONE_YEAR_MS,
    });
    setSessionCookie(opts.res, opts.req, sessionToken);
    user = (await db.getUserByOpenId(openId)) ?? null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
