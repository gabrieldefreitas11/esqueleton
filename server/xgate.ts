type XGateCurrency = {
  _id: string;
  name: string;
  type: string;
  createdDate?: string;
  updatedDate?: string;
  __v?: number;
  symbol?: string;
};

type XGateTokenResponse = {
  token?: string;
  data?: { token?: string };
  message?: string;
  error?: string;
};

type XGateCreateCustomerResponse = {
  customer?: { _id?: string };
  data?: { customer?: { _id?: string } };
  _id?: string;
  message?: string;
  error?: string;
};

type XGateConversionResponse = {
  amount?: number;
  crypto?: string;
  data?: {
    amount?: number;
    crypto?: string;
  };
  message?: string;
  error?: string;
};

type XGateDepositResponse = {
  data?: {
    id?: string;
    _id?: string;
    code?: string;
    status?: string;
    customerId?: string;
  };
  id?: string;
  _id?: string;
  code?: string;
  status?: string;
  customerId?: string;
  message?: string;
  error?: string;
};

type XGateDepositDetailsResponse = {
  data?: {
    _id?: string;
    id?: string;
    status?: string;
    amount?: number;
    customerId?: string;
    operation?: string;
  };
  _id?: string;
  id?: string;
  status?: string;
  amount?: number;
  customerId?: string;
  operation?: string;
  message?: string;
  error?: string;
};

type XGateRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  retryWithoutCache?: boolean;
};

type EnsureCustomerInput = {
  name: string;
  document: string;
  email?: string;
  phone?: string;
};

type CreatePixDepositInput = {
  amount: number;
  externalId: string;
  customer: EnsureCustomerInput;
  customerIdOverride?: string | null;
};

type CreatePixDepositOutput = {
  paymentId: string;
  pixCode: string;
  rawStatus: string;
  customerId: string;
  usdtAmount: number | null;
  usdtSymbol: string;
};

type DepositDetails = {
  paymentId: string;
  rawStatus: string;
  amount: number | null;
  customerId: string | null;
  operation: string | null;
};

export type XGateConfig = {
  email?: string | null;
  password?: string | null;
  apiBaseUrl?: string | null;
  defaultCustomerId?: string | null;
};

const DEFAULT_BASE_URL = "https://api.xgateglobal.com";
const TOKEN_BUFFER_MS = 30_000;
const TOKEN_TTL_MS = 55 * 60 * 1000;

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;
let cachedTokenKey: string | null = null;

function readConfigValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const clean = (value || "").trim();
    if (clean) return clean;
  }
  return "";
}

function getBaseUrl(config?: XGateConfig): string {
  return (
    readConfigValue(config?.apiBaseUrl, process.env.XGATE_API_BASE_URL) || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

function getCredentials(config?: XGateConfig) {
  const email = readConfigValue(config?.email, process.env.XGATE_EMAIL);
  const password = readConfigValue(config?.password, process.env.XGATE_PASSWORD);
  return { email, password };
}

export function isXGateConfigured(config?: XGateConfig): boolean {
  const { email, password } = getCredentials(config);
  return Boolean(email && password);
}

function normalizeDigits(input?: string | null): string {
  return (input || "").replace(/\D+/g, "");
}

export function buildFallbackCustomerDocument(input?: string | null, userId?: number): string {
  const digits = normalizeDigits(input);
  if (digits.length >= 6) return digits;
  if (userId && Number.isFinite(userId) && userId > 0) {
    return `9${String(userId).padStart(10, "0")}`;
  }
  return `9${Date.now()}`.slice(0, 11);
}

async function rawRequest<T>(
  path: string,
  options: XGateRequestOptions = {},
  config?: XGateConfig
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${getBaseUrl(config)}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new Error(`XGate ${method} ${path} falhou (${response.status}): ${details}`);
  }

  return payload as T;
}

async function getAuthToken(config?: XGateConfig, forceRefresh = false): Promise<string> {
  const now = Date.now();
  const { email, password } = getCredentials(config);
  const cacheKey = `${getBaseUrl(config)}|${email}`;

  if (cachedTokenKey !== cacheKey) {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
    cachedTokenKey = cacheKey;
  }

  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > now + TOKEN_BUFFER_MS) {
    return cachedToken;
  }

  if (!email || !password) {
    throw new Error("XGate nao configurado. Defina email e senha no painel admin ou no .env.");
  }

  const payload = await rawRequest<XGateTokenResponse>(
    "/auth/token",
    {
      method: "POST",
      body: { email, password },
    },
    config
  );

  const token = payload.token || payload.data?.token;
  if (!token) {
    throw new Error("XGate retornou resposta sem token.");
  }

  cachedToken = token;
  cachedTokenExpiresAt = now + TOKEN_TTL_MS;
  cachedTokenKey = cacheKey;
  return token;
}

async function xgateRequest<T>(
  path: string,
  options: XGateRequestOptions = {},
  config?: XGateConfig
): Promise<T> {
  const token = options.token || (await getAuthToken(config));
  try {
    return await rawRequest<T>(path, { ...options, token }, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldRetry = !options.retryWithoutCache && !options.token && /401|unauthorized|token/i.test(message);
    if (!shouldRetry) throw error;
    const refreshedToken = await getAuthToken(config, true);
    return rawRequest<T>(
      path,
      { ...options, token: refreshedToken, retryWithoutCache: true },
      config
    );
  }
}

async function getPixCurrency(config?: XGateConfig): Promise<XGateCurrency> {
  const currencies = await xgateRequest<XGateCurrency[]>("/deposit/company/currencies", {}, config);
  const pixBrl =
    currencies.find((currency) => currency.type?.toUpperCase() === "PIX" && currency.name?.toUpperCase() === "BRL") ||
    currencies.find((currency) => currency.type?.toUpperCase() === "PIX") ||
    currencies[0];

  if (!pixBrl) {
    throw new Error("XGate nao retornou moedas para deposito PIX.");
  }

  return pixBrl;
}

function normalizeCustomerName(name?: string | null): string {
  const normalized = (name || "").trim();
  if (normalized) return normalized;
  return "Cliente";
}

async function createCustomer(payload: EnsureCustomerInput, config?: XGateConfig): Promise<string> {
  const response = await xgateRequest<XGateCreateCustomerResponse>(
    "/customer",
    {
      method: "POST",
      body: {
        name: normalizeCustomerName(payload.name),
        document: payload.document,
        email: payload.email || "",
        phone: payload.phone || "",
        notValidationDuplicated: true,
      },
    },
    config
  );

  const customerId = response.customer?._id || response.data?.customer?._id || response._id;

  if (!customerId) {
    throw new Error("XGate nao retornou customerId ao criar cliente.");
  }

  return customerId;
}

async function resolveCustomerId(input: CreatePixDepositInput, config?: XGateConfig): Promise<string> {
  const forcedCustomerId = readConfigValue(
    input.customerIdOverride,
    config?.defaultCustomerId,
    process.env.XGATE_DEFAULT_CUSTOMER_ID
  );
  if (forcedCustomerId) return forcedCustomerId;
  return createCustomer(input.customer, config);
}

export async function createPixDeposit(
  input: CreatePixDepositInput,
  config?: XGateConfig
): Promise<CreatePixDepositOutput> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor de pagamento invalido para XGate.");
  }

  const currency = await getPixCurrency(config);
  const customerId = await resolveCustomerId(input, config);

  const conversion = await xgateRequest<XGateConversionResponse>(
    "/deposit/conversion/tether",
    {
      method: "POST",
      body: {
        amount,
        currency,
      },
    },
    config
  );

  const usdtAmountRaw = conversion.amount ?? conversion.data?.amount;
  const usdtAmount = Number.isFinite(usdtAmountRaw) ? Number(usdtAmountRaw) : null;
  const usdtSymbol = (conversion.crypto ?? conversion.data?.crypto ?? "USDT").toUpperCase();

  const deposit = await xgateRequest<XGateDepositResponse>(
    "/deposit",
    {
      method: "POST",
      body: {
        amount,
        customerId,
        currency,
        externalId: input.externalId,
      },
    },
    config
  );

  const depositData = deposit.data || deposit;
  const paymentId = depositData.id || depositData._id;
  const pixCode = depositData.code;
  const rawStatus = depositData.status || "WAITING_PAYMENT";

  if (!paymentId) {
    throw new Error("XGate nao retornou id do pagamento PIX.");
  }
  if (!pixCode) {
    throw new Error("XGate nao retornou codigo PIX.");
  }

  return {
    paymentId,
    pixCode,
    rawStatus,
    customerId: depositData.customerId || customerId,
    usdtAmount,
    usdtSymbol,
  };
}

export async function getDepositDetails(paymentId: string, config?: XGateConfig): Promise<DepositDetails> {
  const normalizedId = paymentId.trim();
  if (!normalizedId) {
    throw new Error("paymentId e obrigatorio para consultar a XGate.");
  }

  const details = await xgateRequest<XGateDepositDetailsResponse>(
    `/deposit/${encodeURIComponent(normalizedId)}/details`,
    {},
    config
  );
  const payload = details.data || details;
  const rawStatus = payload.status || "WAITING_PAYMENT";
  const amountRaw = payload.amount;
  const amount = Number.isFinite(amountRaw) ? Number(amountRaw) : null;

  return {
    paymentId: payload.id || payload._id || normalizedId,
    rawStatus,
    amount,
    customerId: payload.customerId || null,
    operation: payload.operation || null,
  };
}

export function mapXGatePaymentStatus(rawStatus?: string | null): "pending" | "approved" | "rejected" | "cancelled" | "refunded" {
  const normalized = (rawStatus || "").trim().toUpperCase();
  if (!normalized) return "pending";

  if (normalized === "PAID") return "approved";
  if (normalized === "REJECTED" || normalized === "ERROR") return "rejected";
  if (normalized === "REFUND_APPROVED") return "refunded";
  if (normalized === "REFUND_CANCELED" || normalized === "EXPIRED_DISPUTE") return "cancelled";

  return "pending";
}

export function isXGateApproved(rawStatus?: string | null): boolean {
  return (rawStatus || "").trim().toUpperCase() === "PAID";
}
