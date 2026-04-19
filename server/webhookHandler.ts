import type { Express, Request, Response } from "express";
import {
  getPaymentById,
  getPaymentByMpPaymentId,
  updatePayment,
  getSiteSettings,
  getSubscriptionByPreapprovalId,
  updateUserSubscription,
  mapMercadoPagoSubscriptionStatus,
  upsertUserSubscriptionByPreapprovalId,
  getLatestUserSubscription,
} from "./db";
import { onPaymentApproved, onSubscriptionChanged } from "./hooks";
import { getDepositDetails, isXGateApproved, mapXGatePaymentStatus } from "./xgate";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveManualMonthlyEndsAt(baseDate?: Date | null): Date {
  const base = baseDate ?? new Date();
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
}

function resolveMercadoPagoAccessToken(
  settings: Awaited<ReturnType<typeof getSiteSettings>>
): string {
  return (settings.mercadopagoAccessToken || process.env.MP_ACCESS_TOKEN || "").trim();
}

function resolveXGateConfig(settings: Awaited<ReturnType<typeof getSiteSettings>>) {
  return {
    email: settings.xgateEmail,
    password: settings.xgatePassword,
    apiBaseUrl: settings.xgateApiBaseUrl,
    defaultCustomerId: settings.xgateDefaultCustomerId,
  };
}

function mapXGateSubscriptionStatus(
  rawStatus?: string | null
): "pending" | "active" | "cancelled" {
  const mapped = mapXGatePaymentStatus(rawStatus);
  if (mapped === "approved") return "active";
  if (mapped === "rejected" || mapped === "cancelled" || mapped === "refunded") {
    return "cancelled";
  }
  return "pending";
}

function parseXGateBody(rawBody: unknown) {
  if (!rawBody) return null;
  if (typeof rawBody === "object") return rawBody;
  if (typeof rawBody !== "string") return null;
  const trimmed = rawBody.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (trimmed.includes("=")) {
    const params = new URLSearchParams(trimmed);
    return Object.fromEntries(params.entries());
  }
  return { id: trimmed };
}

function parseXGatePayload(req: Request) {
  const parsedBody = parseXGateBody(req.body);
  const body = Array.isArray(parsedBody) ? parsedBody[0] : parsedBody;
  const data = (body as any)?.data ?? null;

  const queryId = req.query.id ?? req.query.payment_id ?? req.query.paymentId;
  const queryStatus = req.query.status;
  const queryOperation = req.query.operation;

  const paymentId =
    (body as any)?.id ?? data?.id ?? (Array.isArray(queryId) ? queryId[0] : queryId);
  const status =
    (body as any)?.status ??
    data?.status ??
    (Array.isArray(queryStatus) ? queryStatus[0] : queryStatus);
  const operation =
    (body as any)?.operation ??
    data?.operation ??
    (Array.isArray(queryOperation) ? queryOperation[0] : queryOperation) ??
    "DEPOSIT";

  return {
    paymentId:
      typeof paymentId === "string" ? paymentId : paymentId ? String(paymentId) : null,
    status: typeof status === "string" ? status : status ? String(status) : null,
    operation:
      typeof operation === "string" ? operation : operation ? String(operation) : null,
  };
}

// ─── Core sync logic ─────────────────────────────────────────────────────────

async function syncXGatePaymentById(paymentId: string, fallbackStatus?: string | null) {
  const clean = paymentId.trim();
  if (!clean) return { processed: false as const, reason: "payment_id_missing" };

  const settings = await getSiteSettings();
  const xgateConfig = resolveXGateConfig(settings);

  let rawStatus = (fallbackStatus || "").trim().toUpperCase();
  if (!rawStatus) {
    const details = await getDepositDetails(clean, xgateConfig);
    rawStatus = (details.rawStatus || "").trim().toUpperCase();
  }

  const mappedStatus = mapXGatePaymentStatus(rawStatus);
  const payment = await getPaymentByMpPaymentId(clean);
  const subscription = await getSubscriptionByPreapprovalId(clean);

  if (!payment && !subscription) {
    return {
      processed: false as const,
      reason: "record_not_found",
      rawStatus,
      mappedStatus,
    };
  }

  if (payment) {
    await updatePayment(payment.id, { mpStatus: rawStatus, status: mappedStatus });
    if (isXGateApproved(rawStatus)) {
      const fresh = await getPaymentById(payment.id);
      if (fresh) await onPaymentApproved(fresh);
    }
  }

  if (subscription) {
    const nextStatus = mapXGateSubscriptionStatus(rawStatus);
    await updateUserSubscription(subscription.id, {
      mpStatus: rawStatus,
      status: nextStatus,
      startsAt:
        nextStatus === "active"
          ? subscription.startsAt ?? new Date()
          : subscription.startsAt,
      endsAt:
        nextStatus === "active"
          ? subscription.endsAt ??
            resolveManualMonthlyEndsAt(subscription.startsAt ?? new Date())
          : subscription.endsAt,
      cancelledAt:
        nextStatus === "cancelled"
          ? subscription.cancelledAt ?? new Date()
          : subscription.cancelledAt,
    });
    const fresh = await getLatestUserSubscription(subscription.userId);
    if (fresh) await onSubscriptionChanged(fresh);
  }

  return {
    processed: true as const,
    rawStatus,
    mappedStatus,
    isPaid: isXGateApproved(rawStatus),
    paymentId: payment?.id ?? null,
    subscriptionId: subscription?.id ?? null,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerWebhookRoutes(app: Express) {
  // ── XGate webhook ──────────────────────────────────────────────────────────
  app.post("/api/webhook/xgate", async (req: Request, res: Response) => {
    res.status(200).json({ received: true });
    try {
      const payload = parseXGatePayload(req);
      if (!payload.paymentId) return;
      const operation = (payload.operation ?? "DEPOSIT").toUpperCase();
      if (operation !== "DEPOSIT") return;
      const result = await syncXGatePaymentById(payload.paymentId, payload.status);
      console.log("[XGate Webhook] Processed:", result);
    } catch (error) {
      console.error("[XGate Webhook] Error:", error);
    }
  });

  // ── XGate manual confirm ───────────────────────────────────────────────────
  app.post("/api/webhook/xgate/confirm", async (req: Request, res: Response) => {
    try {
      const payload = parseXGatePayload(req);
      if (!payload.paymentId) {
        return res.status(400).json({ error: "paymentId required" });
      }
      const result = await syncXGatePaymentById(payload.paymentId, payload.status);
      return res.json({
        success: true,
        status: result.rawStatus ?? "PENDING",
        isPaid: Boolean(result.isPaid),
        mappedStatus: result.mappedStatus ?? "pending",
        processed: result.processed,
      });
    } catch (error) {
      console.error("[XGate Confirm] Error:", error);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // ── MercadoPago webhook (payment + subscription) ──────────────────────────
  app.post("/api/webhook/mercadopago", async (req: Request, res: Response) => {
    res.status(200).json({ received: true });
    try {
      const body = req.body as {
        type?: string;
        action?: string;
        data?: { id?: string };
      };
      const topicRaw = (req.query.topic as string) ?? body.type ?? body.action ?? "";
      const topic = topicRaw.toLowerCase();
      const resourceId = (req.query.id as string) ?? body.data?.id ?? "";
      const isPaymentTopic = topic.includes("payment");
      const isSubscriptionTopic =
        topic.includes("preapproval") || topic.includes("subscription");

      if (!resourceId || (!isPaymentTopic && !isSubscriptionTopic)) return;

      const settings = await getSiteSettings();
      const accessToken = resolveMercadoPagoAccessToken(settings);
      if (!accessToken) {
        console.error("[MP Webhook] MP_ACCESS_TOKEN not configured");
        return;
      }

      if (isSubscriptionTopic) {
        const subRes = await fetch(
          `https://api.mercadopago.com/preapproval/${resourceId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!subRes.ok) {
          console.error(`[MP Webhook] preapproval fetch ${subRes.status}`);
          return;
        }
        const mpSub = (await subRes.json()) as {
          id: string;
          status?: string;
          payer_email?: string;
          external_reference?: string;
          init_point?: string;
          auto_recurring?: { transaction_amount?: number; currency_id?: string };
          date_created?: string;
          next_payment_date?: string;
          canceled_date?: string;
        };

        const existing = await getSubscriptionByPreapprovalId(mpSub.id);
        const parsedUserId = (() => {
          const ref = mpSub.external_reference ?? "";
          const match = ref.match(/^subscription-user-(\d+)$/);
          return match ? Number(match[1]) : null;
        })();
        const userId = parsedUserId ?? existing?.userId;
        if (!userId) return;

        await upsertUserSubscriptionByPreapprovalId({
          userId,
          mpPreapprovalId: mpSub.id,
          mpStatus: mpSub.status ?? null,
          status: mapMercadoPagoSubscriptionStatus(mpSub.status),
          amount:
            mpSub.auto_recurring?.transaction_amount !== undefined
              ? Number(mpSub.auto_recurring.transaction_amount).toFixed(2)
              : undefined,
          currency: mpSub.auto_recurring?.currency_id ?? "BRL",
          payerEmail: mpSub.payer_email ?? null,
          initPoint: mpSub.init_point ?? null,
          startsAt: parseOptionalDate(mpSub.date_created),
          endsAt: parseOptionalDate(mpSub.next_payment_date),
          cancelledAt: parseOptionalDate(mpSub.canceled_date),
        });

        const fresh = await getLatestUserSubscription(userId);
        if (fresh) await onSubscriptionChanged(fresh);
        return;
      }

      // ── Payment ──────────────────────────────────────────────────────────
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!mpRes.ok) {
        console.error(`[MP Webhook] payment fetch ${mpRes.status}`);
        return;
      }
      const mpPayment = (await mpRes.json()) as {
        id: number;
        status: string;
        external_reference: string;
        payer?: { email?: string };
      };

      // Convention: external_reference = "payment-{paymentId}"
      const match = (mpPayment.external_reference ?? "").match(/^payment-(\d+)$/);
      if (!match) {
        console.error(
          `[MP Webhook] unsupported external_reference: ${mpPayment.external_reference}`
        );
        return;
      }
      const paymentId = Number(match[1]);
      const payment = await getPaymentById(paymentId);
      if (!payment) {
        console.error(`[MP Webhook] payment ${paymentId} not found`);
        return;
      }

      const statusMap: Record<
        string,
        "approved" | "rejected" | "cancelled" | "pending"
      > = {
        approved: "approved",
        rejected: "rejected",
        cancelled: "cancelled",
        refunded: "cancelled",
        charged_back: "cancelled",
      };
      const newStatus = statusMap[mpPayment.status] ?? "pending";

      await updatePayment(payment.id, {
        mpPaymentId: String(mpPayment.id),
        mpStatus: mpPayment.status,
        status: newStatus,
        payerEmail: mpPayment.payer?.email,
      });

      if (newStatus === "approved") {
        const fresh = await getPaymentById(payment.id);
        if (fresh) await onPaymentApproved(fresh);
      }
    } catch (err) {
      console.error("[MP Webhook] Error:", err);
    }
  });

  // ── MercadoPago manual confirm (fallback from frontend) ────────────────────
  app.post("/api/webhook/mercadopago/confirm", async (req: Request, res: Response) => {
    try {
      const mpPaymentId = String(req.body?.mpPaymentId ?? "").trim();
      if (!mpPaymentId) {
        return res.status(400).json({ error: "mpPaymentId required" });
      }
      const settings = await getSiteSettings();
      const accessToken = resolveMercadoPagoAccessToken(settings);
      if (!accessToken) {
        return res.status(500).json({ error: "MP access token missing" });
      }
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!mpRes.ok) {
        return res.status(mpRes.status).json({ error: "MP fetch failed" });
      }
      const mpPayment = (await mpRes.json()) as {
        id: number;
        status: string;
        external_reference: string;
      };
      const match = (mpPayment.external_reference ?? "").match(/^payment-(\d+)$/);
      if (!match) {
        return res.status(400).json({ error: "invalid external_reference" });
      }
      const payment = await getPaymentById(Number(match[1]));
      if (!payment) return res.status(404).json({ error: "payment not found" });

      const statusMap: Record<string, "approved" | "rejected" | "cancelled" | "pending"> = {
        approved: "approved",
        rejected: "rejected",
        cancelled: "cancelled",
        refunded: "cancelled",
        charged_back: "cancelled",
      };
      const newStatus = statusMap[mpPayment.status] ?? "pending";
      await updatePayment(payment.id, {
        mpPaymentId: String(mpPayment.id),
        mpStatus: mpPayment.status,
        status: newStatus,
      });
      if (newStatus === "approved") {
        const fresh = await getPaymentById(payment.id);
        if (fresh) await onPaymentApproved(fresh);
      }
      return res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error("[MP Confirm] Error:", error);
      return res.status(500).json({ error: "Internal error" });
    }
  });
}
