export type WhatsAppAnimation = "pulse" | "bounce" | "none";
export type WhatsAppPosition = "right" | "left";

export type PublicSiteSettingsData = {
  defaultProductPrice: number;
  subscriptionMonthlyPrice: number;
  subscriptionAnnualPrice: number;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  whatsappCtaText: string;
  whatsappAnimation: WhatsAppAnimation;
  whatsappPosition: WhatsAppPosition;
  headScripts: string;
  bodyScripts: string;
  // Campos seguros de expor ao cliente:
  googleClientId: string;
  recaptchaSiteKey: string;
};

export type SiteSettingsData = PublicSiteSettingsData & {
  xgateEmail: string;
  xgatePassword: string;
  xgateApiBaseUrl: string;
  xgateDefaultCustomerId: string;
  mercadopagoAccessToken: string;
  mercadopagoSubscriptionBackUrl: string;
  llmApiKey: string;
  mailjetApiKey: string;
  mailjetApiSecret: string;
  mailjetFromEmail: string;
  mailjetFromName: string;
  googleClientSecret: string;
  recaptchaSecretKey: string;
  recaptchaMinScore: number;
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  defaultProductPrice: 9.9,
  subscriptionMonthlyPrice: 29.9,
  subscriptionAnnualPrice: 299.0,
  whatsappEnabled: false,
  whatsappNumber: "",
  whatsappMessage: "Oi! Preciso de ajuda.",
  whatsappCtaText: "Falar no WhatsApp",
  whatsappAnimation: "pulse",
  whatsappPosition: "right",
  headScripts: "",
  bodyScripts: "",
  xgateEmail: "",
  xgatePassword: "",
  xgateApiBaseUrl: "",
  xgateDefaultCustomerId: "",
  mercadopagoAccessToken: "",
  mercadopagoSubscriptionBackUrl: "",
  llmApiKey: "",
  mailjetApiKey: "",
  mailjetApiSecret: "",
  mailjetFromEmail: "",
  mailjetFromName: "SaaS",
  googleClientId: "",
  googleClientSecret: "",
  recaptchaSiteKey: "",
  recaptchaSecretKey: "",
  recaptchaMinScore: 0.5,
};

export function toPublicSiteSettings(
  settings: SiteSettingsData
): PublicSiteSettingsData {
  return {
    defaultProductPrice: settings.defaultProductPrice,
    subscriptionMonthlyPrice: settings.subscriptionMonthlyPrice,
    subscriptionAnnualPrice: settings.subscriptionAnnualPrice,
    whatsappEnabled: settings.whatsappEnabled,
    whatsappNumber: settings.whatsappNumber,
    whatsappMessage: settings.whatsappMessage,
    whatsappCtaText: settings.whatsappCtaText,
    whatsappAnimation: settings.whatsappAnimation,
    whatsappPosition: settings.whatsappPosition,
    headScripts: settings.headScripts,
    bodyScripts: settings.bodyScripts,
    googleClientId: settings.googleClientId,
    recaptchaSiteKey: settings.recaptchaSiteKey,
  };
}
