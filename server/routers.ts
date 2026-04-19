import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { APP_NAME } from "@shared/const";
import { toPublicSiteSettings } from "@shared/site-settings";
import * as db from "./db";
import { ENV } from "./_core/env";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  buildAbandonedCartEmail,
  isMailjetConfigured,
  sendMailjetEmail,
} from "./mailjet";
import type { Payment } from "../drizzle/schema";

// ─── MercadoPago helpers ─────────────────────────────────────────────────────

function resolveBaseUrl(): string {
  try {
    return new URL(ENV.publicBaseUrl || ENV.appUrl || "http://localhost:3000")
      .toString()
      .replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

async function resolveMpAccessToken(): Promise<string> {
  const settings = await db.getSiteSettings();
  return (
    settings.mercadopagoAccessToken || process.env.MP_ACCESS_TOKEN || ""
  ).trim();
}

async function createMercadoPagoPreference(opts: {
  paymentId: number;
  title: string;
  amount: number;
  payerEmail: string;
}) {
  const accessToken = await resolveMpAccessToken();
  if (!accessToken) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "MercadoPago access token não configurado",
    });
  }

  const baseUrl = resolveBaseUrl();
  const allowAutoReturn =
    baseUrl.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(baseUrl);

  const body = {
    items: [
      {
        id: `payment-${opts.paymentId}`,
        title: opts.title,
        quantity: 1,
        unit_price: opts.amount,
        currency_id: "BRL",
      },
    ],
    payer: { email: opts.payerEmail },
    back_urls: {
      success: `${baseUrl}/payment/success?payment_id=${opts.paymentId}`,
      failure: `${baseUrl}/payment/failure?payment_id=${opts.paymentId}`,
      pending: `${baseUrl}/payment/pending?payment_id=${opts.paymentId}`,
    },
    ...(allowAutoReturn ? { auto_return: "approved" } : {}),
    payment_methods: {
      default_payment_method_id: "pix",
      installments: 1,
    },
    notification_url: `${baseUrl}/api/webhook/mercadopago`,
    external_reference: `payment-${opts.paymentId}`,
    statement_descriptor: APP_NAME.toUpperCase().slice(0, 22),
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `MercadoPago error: ${err}`,
    });
  }

  return res.json() as Promise<{
    id: string;
    init_point: string;
    sandbox_init_point: string;
  }>;
}

async function createMercadoPagoSubscription(opts: {
  userId: number;
  amount: number;
  payerEmail: string;
  reason: string;
}) {
  const accessToken = await resolveMpAccessToken();
  if (!accessToken) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "MercadoPago access token não configurado",
    });
  }

  const baseUrl = resolveBaseUrl();
  const backUrl = baseUrl.startsWith("https://")
    ? baseUrl
    : "https://www.mercadopago.com.br";

  const body = {
    reason: opts.reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: opts.amount,
      currency_id: "BRL",
    },
    back_url: backUrl,
    payer_email: opts.payerEmail,
    external_reference: `subscription-user-${opts.userId}`,
    notification_url: `${baseUrl}/api/webhook/mercadopago`,
  };

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `MercadoPago subscription error: ${err}`,
    });
  }

  return res.json() as Promise<{
    id: string;
    status: string;
    init_point: string;
  }>;
}

// ─── Site router (public settings) ───────────────────────────────────────────

const siteRouter = router({
  settings: publicProcedure.query(async () => {
    const settings = await db.getSiteSettings();
    return toPublicSiteSettings(settings);
  }),
});

// ─── Auth router ─────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user || ctx.user.loginMethod === "anonymous") return null;
    return {
      id: ctx.user.id,
      openId: ctx.user.openId,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      loginMethod: ctx.user.loginMethod,
    };
  }),
});

// ─── Items router (exemplo CRUD) ─────────────────────────────────────────────

const itemsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getItemsByUserId(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const item = await db.getItemById(input.id);
      if (!item || item.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      }
      return item;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(10_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createItem({
        userId: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(10_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getItemById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      }
      await db.updateItem(input.id, {
        title: input.title,
        description: input.description,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getItemById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      }
      await db.deleteItem(input.id);
      return { success: true };
    }),
});

// ─── Payments router ─────────────────────────────────────────────────────────

const paymentsRouter = router({
  createCheckout: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        amount: z.number().positive(),
        resourceType: z.string().max(64).optional(),
        resourceId: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const paymentId = await db.createPayment({
        userId: ctx.user.id,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        amount: input.amount.toFixed(2),
        currency: "BRL",
        status: "pending",
        payerEmail: ctx.user.email ?? null,
      });

      const preference = await createMercadoPagoPreference({
        paymentId,
        title: input.title,
        amount: input.amount,
        payerEmail: ctx.user.email ?? "",
      });

      await db.updatePayment(paymentId, {
        mpPreferenceId: preference.id,
        initPoint: preference.init_point,
      });

      return {
        paymentId,
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
      };
    }),

  status: protectedProcedure
    .input(z.object({ paymentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const payment = await db.getPaymentById(input.paymentId);
      if (!payment || payment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        id: payment.id,
        status: payment.status,
        mpStatus: payment.mpStatus,
        amount: payment.amount,
        initPoint: payment.initPoint,
      };
    }),

  myPayments: protectedProcedure.query(({ ctx }) =>
    db.getPaymentsByUserId(ctx.user.id)
  ),
});

// ─── Subscriptions router ────────────────────────────────────────────────────

const subscriptionsRouter = router({
  current: protectedProcedure.query(({ ctx }) =>
    db.getLatestUserSubscription(ctx.user.id)
  ),

  hasActive: protectedProcedure.query(({ ctx }) =>
    db.hasActiveSubscription(ctx.user.id)
  ),

  createMonthly: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getSiteSettings();
    const preapproval = await createMercadoPagoSubscription({
      userId: ctx.user.id,
      amount: settings.subscriptionMonthlyPrice,
      payerEmail: ctx.user.email ?? "",
      reason: `${APP_NAME} — Assinatura Mensal`,
    });

    await db.upsertUserSubscriptionByPreapprovalId({
      userId: ctx.user.id,
      mpPreapprovalId: preapproval.id,
      mpStatus: preapproval.status ?? "pending",
      status: db.mapMercadoPagoSubscriptionStatus(preapproval.status),
      amount: settings.subscriptionMonthlyPrice.toFixed(2),
      currency: "BRL",
      payerEmail: ctx.user.email ?? null,
      initPoint: preapproval.init_point,
    });

    return {
      preapprovalId: preapproval.id,
      initPoint: preapproval.init_point,
    };
  }),
});

// ─── Admin router ────────────────────────────────────────────────────────────

const adminRouter = router({
  stats: adminProcedure.query(() => db.getAdminStats()),
  listUsers: adminProcedure.query(() => db.getAllUsers()),
  listPayments: adminProcedure.query(() => db.getAllPayments()),

  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  getSiteSettings: adminProcedure.query(() => db.getSiteSettings()),

  updateSiteSettings: adminProcedure
    .input(
      z
        .object({
          defaultProductPrice: z.number().optional(),
          subscriptionMonthlyPrice: z.number().optional(),
          subscriptionAnnualPrice: z.number().optional(),
          whatsappEnabled: z.boolean().optional(),
          whatsappNumber: z.string().optional(),
          whatsappMessage: z.string().optional(),
          whatsappCtaText: z.string().optional(),
          whatsappAnimation: z.enum(["pulse", "bounce", "none"]).optional(),
          whatsappPosition: z.enum(["right", "left"]).optional(),
          headScripts: z.string().optional(),
          bodyScripts: z.string().optional(),
          mercadopagoAccessToken: z.string().optional(),
          mercadopagoSubscriptionBackUrl: z.string().optional(),
          xgateEmail: z.string().optional(),
          xgatePassword: z.string().optional(),
          xgateApiBaseUrl: z.string().optional(),
          xgateDefaultCustomerId: z.string().optional(),
          llmApiKey: z.string().optional(),
          mailjetApiKey: z.string().optional(),
          mailjetApiSecret: z.string().optional(),
          mailjetFromEmail: z.string().optional(),
          mailjetFromName: z.string().optional(),
          googleClientId: z.string().optional(),
          googleClientSecret: z.string().optional(),
          recaptchaSiteKey: z.string().optional(),
          recaptchaSecretKey: z.string().optional(),
          recaptchaMinScore: z.number().min(0).max(1).optional(),
        })
        .strict()
    )
    .mutation(({ input }) => db.updateSiteSettings(input)),
});

// ─── Root router ─────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  site: siteRouter,
  auth: authRouter,
  items: itemsRouter,
  payments: paymentsRouter,
  subscriptions: subscriptionsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

// ─── Cron: abandoned carts ───────────────────────────────────────────────────

export async function processAbandonedCarts(): Promise<{
  processed: number;
  skipped: number;
}> {
  const settings = await db.getSiteSettings();
  const creds = {
    apiKey: settings.mailjetApiKey || ENV.mailjetApiKey,
    apiSecret: settings.mailjetApiSecret || ENV.mailjetApiSecret,
    fromEmail: settings.mailjetFromEmail || ENV.mailjetFromEmail,
    fromName: settings.mailjetFromName || ENV.mailjetFromName,
  };
  if (!isMailjetConfigured(creds)) {
    console.warn("[Cron] Mailjet not configured");
    return { processed: 0, skipped: 0 };
  }

  const carts = await db.getPendingAbandonedCarts();
  let processed = 0;
  let skipped = 0;
  const baseUrl = resolveBaseUrl();

  for (const row of carts) {
    const payment = row.payment as Payment;
    const user = row.user as { email?: string | null; name?: string | null } | null;
    const email = payment.payerEmail ?? user?.email;
    if (!email) {
      skipped++;
      continue;
    }

    try {
      const { subject, htmlBody, textBody } = buildAbandonedCartEmail({
        userName: user?.name ?? null,
        productName: null,
        checkoutUrl: payment.initPoint ?? `${baseUrl}/checkout`,
        brandName: APP_NAME,
      });
      await sendMailjetEmail(creds, {
        to: { email, name: user?.name ?? undefined },
        subject,
        htmlBody,
        textBody,
      });
      await db.markAbandonedEmailSent(payment.id);
      processed++;
    } catch (error) {
      console.error("[Cron] abandoned cart email failed", error);
      skipped++;
    }
  }

  return { processed, skipped };
}
