// Cliente para Mailjet Send API v3.1 (https://dev.mailjet.com/email/guides/send-api-v31/).
// Autenticação: Basic Auth com APIKey (public) + APISecret (private).

const MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";

export type MailjetCredentials = {
  apiKey: string;
  apiSecret: string;
  fromEmail: string;
  fromName?: string;
};

export function isMailjetConfigured(creds: MailjetCredentials): boolean {
  return Boolean(creds.apiKey && creds.apiSecret && creds.fromEmail);
}

export type SendEmailInput = {
  to: { email: string; name?: string };
  subject: string;
  textBody?: string;
  htmlBody?: string;
};

export async function sendMailjetEmail(
  creds: MailjetCredentials,
  input: SendEmailInput
): Promise<{ status: number; body: string }> {
  if (!isMailjetConfigured(creds)) {
    throw new Error("Mailjet nao configurado (apiKey/apiSecret/fromEmail ausentes)");
  }

  const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString("base64");

  const payload = {
    Messages: [
      {
        From: {
          Email: creds.fromEmail,
          Name: creds.fromName || "SaaS",
        },
        To: [
          {
            Email: input.to.email,
            Name: input.to.name || input.to.email.split("@")[0],
          },
        ],
        Subject: input.subject,
        TextPart: input.textBody || stripHtml(input.htmlBody || ""),
        HTMLPart: input.htmlBody || `<p>${escapeHtml(input.textBody || "")}</p>`,
      },
    ],
  };

  const res = await fetch(MAILJET_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Mailjet retornou ${res.status}: ${body.slice(0, 300)}`);
  }
  return { status: res.status, body };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildAbandonedCartEmail(opts: {
  userName?: string | null;
  productName?: string | null;
  checkoutUrl: string;
  brandName?: string;
}): { subject: string; htmlBody: string; textBody: string } {
  const name = (opts.userName || "").trim().split(" ")[0] || "olá";
  const productName = (opts.productName || "seu pedido").trim();
  const brand = opts.brandName || "SaaS";

  const subject = `${name}, falta pouco para finalizar ${productName}`;

  const htmlBody = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:28px 32px 0;">
                <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Você esqueceu algo, ${name}!</h1>
                <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.5;">
                  Notamos que você começou a finalizar o pagamento de <strong>${escapeHtml(productName)}</strong> mas não concluiu.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 28px;">
                <a href="${opts.checkoutUrl}" style="display:inline-block;background:#0ea5e9;background:linear-gradient(90deg,#6366f1 0%,#0ea5e9 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
                  Finalizar pagamento
                </a>
                <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">
                  Pagamento seguro via PIX ou cartão
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;text-align:center;">
                Você está recebendo este e-mail porque iniciou um pedido em ${brand}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const textBody = [
    `Olá, ${name}!`,
    "",
    `Você começou a finalizar o pagamento de ${productName} mas não concluiu.`,
    "",
    `Finalize agora: ${opts.checkoutUrl}`,
    "",
    `— ${brand}`,
  ].join("\n");

  return { subject, htmlBody, textBody };
}
