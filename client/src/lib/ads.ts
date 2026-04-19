type AdsBasePayload = {
  value?: number;
  currency?: string;
  transactionId?: string;
  itemId?: string;
  itemName?: string;
};

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function canTrack() {
  return typeof window !== "undefined";
}

function fireGtagEvent(eventName: string, payload?: Record<string, unknown>) {
  if (!canTrack()) return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, payload ?? {});
}

function pushDataLayer(payload: Record<string, unknown>) {
  if (!canTrack()) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

function normalizeValue(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Number(value.toFixed(2));
}

export function trackBeginCheckout(payload: AdsBasePayload) {
  const value = normalizeValue(payload.value);
  const currency = payload.currency || "BRL";
  const items = payload.itemId
    ? [{ item_id: payload.itemId, item_name: payload.itemName ?? payload.itemId }]
    : undefined;

  fireGtagEvent("begin_checkout", { currency, value, items });

  pushDataLayer({
    event: "begin_checkout",
    ecommerce: { currency, value, items: items ?? [] },
  });
}

export function trackPurchase(payload: AdsBasePayload) {
  const value = normalizeValue(payload.value);
  const currency = payload.currency || "BRL";
  const transactionId = payload.transactionId || `purchase-${Date.now()}`;
  const items = payload.itemId
    ? [{ item_id: payload.itemId, item_name: payload.itemName ?? payload.itemId }]
    : undefined;

  fireGtagEvent("purchase", {
    transaction_id: transactionId,
    value,
    currency,
    items,
  });

  pushDataLayer({
    event: "purchase",
    ecommerce: {
      transaction_id: transactionId,
      currency,
      value,
      items: items ?? [],
    },
  });
}
