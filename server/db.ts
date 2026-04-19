import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  items,
  users,
  payments,
  downloadTokens,
  siteSettings,
  userSubscriptions,
  type InsertUser,
  type InsertItem,
  type InsertPayment,
  type InsertDownloadToken,
  type InsertSiteSettings,
  type InsertUserSubscription,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEFAULT_SITE_SETTINGS, type SiteSettingsData } from "../shared/site-settings";

let _db: ReturnType<typeof drizzle> | null = null;
const MYSQL_TIMESTAMP_MAX = new Date("2037-12-31T23:59:59.000Z");

function clampMySqlTimestamp(value: unknown): Date {
  const parsed =
    value instanceof Date ? value : value ? new Date(String(value)) : MYSQL_TIMESTAMP_MAX;
  if (Number.isNaN(parsed.getTime())) return MYSQL_TIMESTAMP_MAX;
  return parsed.getTime() > MYSQL_TIMESTAMP_MAX.getTime() ? MYSQL_TIMESTAMP_MAX : parsed;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const assignField = <K extends keyof InsertUser>(field: K) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    (values as Record<string, unknown>)[field as string] = normalized;
    updateSet[field as string] = normalized;
  };
  (["name", "email", "loginMethod", "passwordHash", "role"] as const).forEach(assignField);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role === undefined && user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0];
}

// ─── Items (CRUD de exemplo) ──────────────────────────────────────────────────
export async function createItem(data: InsertItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(items).values(data);
  const header = result[0] as unknown as { insertId: number };
  return header.insertId;
}

export async function getItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return result[0];
}

export async function getItemsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(items)
    .where(eq(items.userId, userId))
    .orderBy(desc(items.createdAt));
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(items).set(data).where(eq(items.id, id));
}

export async function deleteItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(items).where(eq(items.id, id));
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(payments).values(data);
  const header = result[0] as unknown as { insertId: number };
  return header.insertId;
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result[0];
}

export async function getPaymentByPreferenceId(preferenceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.mpPreferenceId, preferenceId))
    .limit(1);
  return result[0];
}

export async function getPaymentByMpPaymentId(mpPaymentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.mpPaymentId, mpPaymentId))
    .limit(1);
  return result[0];
}

export async function updatePayment(id: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
}

export async function getPendingAbandonedCarts(opts?: {
  minMinutesOld?: number;
  maxHoursOld?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const minMinutes = opts?.minMinutesOld ?? 60;
  const maxHours = opts?.maxHoursOld ?? 48;
  const now = Date.now();
  const startBoundary = new Date(now - maxHours * 60 * 60 * 1000);
  const endBoundary = new Date(now - minMinutes * 60 * 1000);
  const limit = opts?.limit ?? 50;

  return db
    .select({ payment: payments, user: users })
    .from(payments)
    .leftJoin(users, eq(payments.userId, users.id))
    .where(
      and(
        eq(payments.status, "pending"),
        sql`${payments.createdAt} >= ${startBoundary}`,
        sql`${payments.createdAt} <= ${endBoundary}`,
        sql`${payments.abandonedEmailSentAt} IS NULL`
      )
    )
    .limit(limit);
}

export async function markAbandonedEmailSent(paymentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(payments)
    .set({ abandonedEmailSentAt: new Date() })
    .where(eq(payments.id, paymentId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled"
  | "expired";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authorized", "approved"]);

export function mapMercadoPagoSubscriptionStatus(
  status?: string | null
): SubscriptionStatus {
  if (!status) return "pending";
  const normalized = status.toLowerCase();
  if (normalized === "authorized" || normalized === "active" || normalized === "approved") {
    return "active";
  }
  if (normalized === "paused") return "paused";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "expired") return "expired";
  return "pending";
}

export function isSubscriptionActive(status?: string | null): boolean {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status.toLowerCase());
}

export async function getLatestUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByPreapprovalId(mpPreapprovalId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.mpPreapprovalId, mpPreapprovalId))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasActiveSubscription(userId: number): Promise<boolean> {
  const subscription = await getLatestUserSubscription(userId);
  if (!subscription) return false;
  const statusActive =
    isSubscriptionActive(subscription.status) ||
    isSubscriptionActive(subscription.mpStatus);
  if (!statusActive) return false;

  const now = Date.now();
  if (subscription.cancelledAt && new Date(subscription.cancelledAt).getTime() <= now) {
    return false;
  }
  if (subscription.endsAt && new Date(subscription.endsAt).getTime() <= now) {
    return false;
  }
  return true;
}

export async function createUserSubscription(data: InsertUserSubscription) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(userSubscriptions).values(data);
  const header = result[0] as unknown as { insertId: number };
  return header.insertId;
}

export async function updateUserSubscription(
  id: number,
  data: Partial<InsertUserSubscription>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(userSubscriptions).set(data).where(eq(userSubscriptions.id, id));
}

export async function upsertUserSubscriptionByPreapprovalId(input: {
  userId: number;
  mpPreapprovalId: string;
  mpStatus?: string | null;
  status: SubscriptionStatus;
  amount?: string;
  currency?: string;
  payerEmail?: string | null;
  initPoint?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  cancelledAt?: Date | null;
}) {
  const existing = await getSubscriptionByPreapprovalId(input.mpPreapprovalId);
  if (existing) {
    await updateUserSubscription(existing.id, {
      mpStatus: input.mpStatus ?? existing.mpStatus,
      status: input.status,
      amount: input.amount ?? existing.amount,
      currency: input.currency ?? existing.currency,
      payerEmail: input.payerEmail ?? existing.payerEmail,
      initPoint: input.initPoint ?? existing.initPoint,
      startsAt: input.startsAt ?? existing.startsAt,
      endsAt: input.endsAt ?? existing.endsAt,
      cancelledAt: input.cancelledAt ?? existing.cancelledAt,
    });
    return existing.id;
  }
  return createUserSubscription({
    userId: input.userId,
    planCode: "unlimited_monthly",
    mpPreapprovalId: input.mpPreapprovalId,
    mpStatus: input.mpStatus ?? undefined,
    status: input.status,
    amount: input.amount ?? "0.00",
    currency: input.currency ?? "BRL",
    payerEmail: input.payerEmail ?? undefined,
    initPoint: input.initPoint ?? undefined,
    startsAt: input.startsAt ?? undefined,
    endsAt: input.endsAt ?? undefined,
    cancelledAt: input.cancelledAt ?? undefined,
  });
}

// ─── Download Tokens ──────────────────────────────────────────────────────────
export async function createDownloadToken(data: InsertDownloadToken) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(downloadTokens).values({
    ...data,
    expiresAt: clampMySqlTimestamp(data.expiresAt),
  });
}

export async function getDownloadToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(downloadTokens)
    .where(eq(downloadTokens.token, token))
    .limit(1);
  return result[0];
}

export async function markTokenUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(downloadTokens)
    .set({ usedAt: new Date() })
    .where(eq(downloadTokens.token, token));
}

// ─── Site Settings (single row) ───────────────────────────────────────────────
function normalizeSiteSettingsRow(
  row?: Partial<InsertSiteSettings> | null
): SiteSettingsData {
  return {
    defaultProductPrice: Number(
      row?.defaultProductPrice ?? DEFAULT_SITE_SETTINGS.defaultProductPrice
    ),
    subscriptionMonthlyPrice: Number(
      row?.subscriptionMonthlyPrice ?? DEFAULT_SITE_SETTINGS.subscriptionMonthlyPrice
    ),
    subscriptionAnnualPrice: Number(
      row?.subscriptionAnnualPrice ?? DEFAULT_SITE_SETTINGS.subscriptionAnnualPrice
    ),
    whatsappEnabled: Boolean(row?.whatsappEnabled ?? DEFAULT_SITE_SETTINGS.whatsappEnabled),
    whatsappNumber: String(row?.whatsappNumber ?? DEFAULT_SITE_SETTINGS.whatsappNumber),
    whatsappMessage: String(row?.whatsappMessage ?? DEFAULT_SITE_SETTINGS.whatsappMessage),
    whatsappCtaText: String(row?.whatsappCtaText ?? DEFAULT_SITE_SETTINGS.whatsappCtaText),
    whatsappAnimation:
      (row?.whatsappAnimation as SiteSettingsData["whatsappAnimation"]) ??
      DEFAULT_SITE_SETTINGS.whatsappAnimation,
    whatsappPosition:
      (row?.whatsappPosition as SiteSettingsData["whatsappPosition"]) ??
      DEFAULT_SITE_SETTINGS.whatsappPosition,
    headScripts: String(row?.headScripts ?? DEFAULT_SITE_SETTINGS.headScripts),
    bodyScripts: String(row?.bodyScripts ?? DEFAULT_SITE_SETTINGS.bodyScripts),
    xgateEmail: String(row?.xgateEmail ?? DEFAULT_SITE_SETTINGS.xgateEmail),
    xgatePassword: String(row?.xgatePassword ?? DEFAULT_SITE_SETTINGS.xgatePassword),
    xgateApiBaseUrl: String(row?.xgateApiBaseUrl ?? DEFAULT_SITE_SETTINGS.xgateApiBaseUrl),
    xgateDefaultCustomerId: String(
      row?.xgateDefaultCustomerId ?? DEFAULT_SITE_SETTINGS.xgateDefaultCustomerId
    ),
    mercadopagoAccessToken: String(
      row?.mercadopagoAccessToken ?? DEFAULT_SITE_SETTINGS.mercadopagoAccessToken
    ),
    mercadopagoSubscriptionBackUrl: String(
      row?.mercadopagoSubscriptionBackUrl ??
        DEFAULT_SITE_SETTINGS.mercadopagoSubscriptionBackUrl
    ),
    llmApiKey: String(row?.llmApiKey ?? DEFAULT_SITE_SETTINGS.llmApiKey),
    mailjetApiKey: String(row?.mailjetApiKey ?? DEFAULT_SITE_SETTINGS.mailjetApiKey),
    mailjetApiSecret: String(row?.mailjetApiSecret ?? DEFAULT_SITE_SETTINGS.mailjetApiSecret),
    mailjetFromEmail: String(row?.mailjetFromEmail ?? DEFAULT_SITE_SETTINGS.mailjetFromEmail),
    mailjetFromName: String(row?.mailjetFromName ?? DEFAULT_SITE_SETTINGS.mailjetFromName),
    googleClientId: String(row?.googleClientId ?? DEFAULT_SITE_SETTINGS.googleClientId),
    googleClientSecret: String(
      row?.googleClientSecret ?? DEFAULT_SITE_SETTINGS.googleClientSecret
    ),
    recaptchaSiteKey: String(
      row?.recaptchaSiteKey ?? DEFAULT_SITE_SETTINGS.recaptchaSiteKey
    ),
    recaptchaSecretKey: String(
      row?.recaptchaSecretKey ?? DEFAULT_SITE_SETTINGS.recaptchaSecretKey
    ),
    recaptchaMinScore: Number(
      row?.recaptchaMinScore ?? DEFAULT_SITE_SETTINGS.recaptchaMinScore
    ),
  };
}

export async function getSiteSettings(): Promise<SiteSettingsData> {
  const db = await getDb();
  if (!db) return DEFAULT_SITE_SETTINGS;
  const rows = await db.select().from(siteSettings).limit(1);
  if (rows.length === 0) return DEFAULT_SITE_SETTINGS;
  return normalizeSiteSettingsRow(rows[0]);
}

export async function updateSiteSettings(
  input: Partial<SiteSettingsData>
): Promise<SiteSettingsData> {
  const db = await getDb();
  if (!db) return DEFAULT_SITE_SETTINGS;
  const rows = await db.select().from(siteSettings).limit(1);
  if (rows.length === 0) {
    await db.insert(siteSettings).values({} as InsertSiteSettings);
    const reloaded = await db.select().from(siteSettings).limit(1);
    if (reloaded.length === 0) return DEFAULT_SITE_SETTINGS;
    rows.push(reloaded[0]);
  }
  const current = normalizeSiteSettingsRow(rows[0]);
  const next: SiteSettingsData = { ...current, ...input };

  await db
    .update(siteSettings)
    .set({
      defaultProductPrice: String(next.defaultProductPrice),
      subscriptionMonthlyPrice: String(next.subscriptionMonthlyPrice),
      subscriptionAnnualPrice: String(next.subscriptionAnnualPrice),
      whatsappEnabled: next.whatsappEnabled,
      whatsappNumber: next.whatsappNumber || null,
      whatsappMessage: next.whatsappMessage || null,
      whatsappCtaText: next.whatsappCtaText || null,
      whatsappAnimation: next.whatsappAnimation,
      whatsappPosition: next.whatsappPosition,
      headScripts: next.headScripts || null,
      bodyScripts: next.bodyScripts || null,
      xgateEmail: next.xgateEmail.trim() || null,
      xgatePassword: next.xgatePassword.trim() || null,
      xgateApiBaseUrl: next.xgateApiBaseUrl.trim() || null,
      xgateDefaultCustomerId: next.xgateDefaultCustomerId.trim() || null,
      mercadopagoAccessToken: next.mercadopagoAccessToken.trim() || null,
      mercadopagoSubscriptionBackUrl: next.mercadopagoSubscriptionBackUrl.trim() || null,
      llmApiKey: next.llmApiKey.trim() || null,
      mailjetApiKey: next.mailjetApiKey.trim() || null,
      mailjetApiSecret: next.mailjetApiSecret.trim() || null,
      mailjetFromEmail: next.mailjetFromEmail.trim() || null,
      mailjetFromName: next.mailjetFromName.trim() || null,
      googleClientId: next.googleClientId.trim() || null,
      googleClientSecret: next.googleClientSecret.trim() || null,
      recaptchaSiteKey: next.recaptchaSiteKey.trim() || null,
      recaptchaSecretKey: next.recaptchaSecretKey.trim() || null,
      recaptchaMinScore: String(next.recaptchaMinScore),
    })
    .where(eq(siteSettings.id, rows[0].id));

  return next;
}

// ─── Admin Queries ────────────────────────────────────────────────────────────
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) {
    return { totalUsers: 0, totalItems: 0, totalPayments: 0, approvedPayments: 0, totalRevenue: 0 };
  }
  const [allUsers, allItems, allPayments] = await Promise.all([
    db.select().from(users),
    db.select().from(items),
    db.select().from(payments),
  ]);
  const approvedPayments = allPayments.filter((p) => p.status === "approved");
  const totalRevenue = approvedPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount || "0"),
    0
  );
  return {
    totalUsers: allUsers.length,
    totalItems: allItems.length,
    totalPayments: allPayments.length,
    approvedPayments: approvedPayments.length,
    totalRevenue,
  };
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
