import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Items (entidade-exemplo, substitua pela sua) ─────────────────────────────
export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: int("resourceId"),
  mpPreferenceId: varchar("mpPreferenceId", { length: 255 }),
  mpPaymentId: varchar("mpPaymentId", { length: 255 }),
  mpStatus: varchar("mpStatus", { length: 100 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 10 }).default("BRL"),
  status: mysqlEnum("status", [
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "refunded",
  ])
    .default("pending")
    .notNull(),
  payerEmail: varchar("payerEmail", { length: 320 }),
  initPoint: text("initPoint"),
  abandonedEmailSentAt: timestamp("abandonedEmailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ─── User Subscriptions ───────────────────────────────────────────────────────
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planCode: varchar("planCode", { length: 64 })
    .default("unlimited_monthly")
    .notNull(),
  mpPreapprovalId: varchar("mpPreapprovalId", { length: 255 }),
  mpStatus: varchar("mpStatus", { length: 100 }),
  status: mysqlEnum("status", [
    "pending",
    "active",
    "paused",
    "cancelled",
    "expired",
  ])
    .default("pending")
    .notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("29.90"),
  currency: varchar("currency", { length: 10 }).default("BRL"),
  payerEmail: varchar("payerEmail", { length: 320 }),
  initPoint: text("initPoint"),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Download Tokens ──────────────────────────────────────────────────────────
export const downloadTokens = mysqlTable("download_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: int("resourceId"),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDownloadToken = typeof downloadTokens.$inferInsert;

// ─── Site Settings (single row) ───────────────────────────────────────────────
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  defaultProductPrice: decimal("defaultProductPrice", { precision: 10, scale: 2 })
    .default("9.90")
    .notNull(),
  subscriptionMonthlyPrice: decimal("subscriptionMonthlyPrice", {
    precision: 10,
    scale: 2,
  })
    .default("29.90")
    .notNull(),
  subscriptionAnnualPrice: decimal("subscriptionAnnualPrice", {
    precision: 10,
    scale: 2,
  })
    .default("299.00")
    .notNull(),
  whatsappEnabled: boolean("whatsappEnabled").default(false).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 32 }),
  whatsappMessage: text("whatsappMessage"),
  whatsappCtaText: varchar("whatsappCtaText", { length: 120 }),
  whatsappAnimation: varchar("whatsappAnimation", { length: 20 })
    .default("pulse")
    .notNull(),
  whatsappPosition: varchar("whatsappPosition", { length: 20 })
    .default("right")
    .notNull(),
  headScripts: text("headScripts"),
  bodyScripts: text("bodyScripts"),
  xgateEmail: varchar("xgateEmail", { length: 320 }),
  xgatePassword: varchar("xgatePassword", { length: 255 }),
  xgateApiBaseUrl: varchar("xgateApiBaseUrl", { length: 255 }),
  xgateDefaultCustomerId: varchar("xgateDefaultCustomerId", { length: 120 }),
  mercadopagoAccessToken: text("mercadopagoAccessToken"),
  mercadopagoSubscriptionBackUrl: text("mercadopagoSubscriptionBackUrl"),
  llmApiKey: varchar("llmApiKey", { length: 255 }),
  mailjetApiKey: varchar("mailjetApiKey", { length: 255 }),
  mailjetApiSecret: varchar("mailjetApiSecret", { length: 255 }),
  mailjetFromEmail: varchar("mailjetFromEmail", { length: 320 }),
  mailjetFromName: varchar("mailjetFromName", { length: 120 }),
  googleClientId: varchar("googleClientId", { length: 255 }),
  googleClientSecret: varchar("googleClientSecret", { length: 255 }),
  recaptchaSiteKey: varchar("recaptchaSiteKey", { length: 255 }),
  recaptchaSecretKey: varchar("recaptchaSecretKey", { length: 255 }),
  recaptchaMinScore: decimal("recaptchaMinScore", { precision: 3, scale: 2 })
    .default("0.50")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = typeof siteSettings.$inferInsert;
