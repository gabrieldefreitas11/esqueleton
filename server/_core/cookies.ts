import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function resolveCookieDomain(hostname?: string | null) {
  if (!hostname) return undefined;
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) return undefined;
  return hostname.startsWith(".") ? hostname : `.${hostname}`;
}

function getCookieDomainCandidates(req: Request) {
  const domains = new Set<string>();
  const requestDomain = resolveCookieDomain(req.hostname);
  if (requestDomain) {
    domains.add(requestDomain);
    domains.add(requestDomain.replace(/^\./, ""));
  }
  const publicBase = process.env.PUBLIC_BASE_URL;
  if (publicBase) {
    try {
      const baseHost = new URL(publicBase).hostname;
      const baseDomain = resolveCookieDomain(baseHost);
      if (baseDomain) {
        domains.add(baseDomain);
        domains.add(baseDomain.replace(/^\./, ""));
      }
    } catch {
      // ignore invalid PUBLIC_BASE_URL
    }
  }
  return Array.from(domains);
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const secure = isSecureRequest(req);
  const domain = (() => {
    const publicBase = process.env.PUBLIC_BASE_URL;
    if (publicBase) {
      try {
        const baseHost = new URL(publicBase).hostname;
        return resolveCookieDomain(baseHost);
      } catch {
        return resolveCookieDomain(req.hostname);
      }
    }
    return resolveCookieDomain(req.hostname);
  })();
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}

export function getSessionCookieDomains(req: Request) {
  return getCookieDomainCandidates(req);
}
