import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

const SCRIPT_ID = "recaptcha-v3";

function loadScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (document.getElementById(SCRIPT_ID)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("recaptcha load failed"));
    document.head.appendChild(s);
  });
}

/**
 * Hook para reCAPTCHA v3. Retorna `getToken(action)` que devolve um token
 * (string) ou `null` se o reCAPTCHA não estiver configurado no site_settings.
 * Nesse caso o backend pula a verificação automaticamente.
 */
export function useRecaptcha() {
  const { data: settings } = trpc.site.settings.useQuery();
  const siteKey = settings?.recaptchaSiteKey?.trim() || "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript(siteKey)
      .then(() => {
        if (cancelled) return;
        const check = () => {
          if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
            window.grecaptcha.ready(() => !cancelled && setReady(true));
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      })
      .catch((err) => console.error("[reCAPTCHA]", err));
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const getToken = useCallback(
    async (action: string): Promise<string | null> => {
      if (!siteKey) return null;
      if (!window.grecaptcha || !ready) return null;
      try {
        return await window.grecaptcha.execute(siteKey, { action });
      } catch (err) {
        console.error("[reCAPTCHA] execute", err);
        return null;
      }
    },
    [siteKey, ready]
  );

  return { enabled: Boolean(siteKey), ready, getToken };
}
