# Esqueleton

Boilerplate de SaaS/micro-SaaS em TypeScript — clone, renomeie, configure, foque no produto.

> Este README é um **guia de onboarding**: você acabou de clonar o Esqueleton e quer começar a construir. Lê até o fim antes de sair editando.

---

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + Radix/shadcn (53 componentes) + Wouter (router) + React Query + tRPC client
- **Backend:** Express + tRPC + Zod + Drizzle ORM + MySQL
- **Auth:** Google OAuth + email/senha (bcrypt) + sessão JWT em cookie HttpOnly + reCAPTCHA v3
- **Pagamentos:** MercadoPago (preferências + assinaturas) + XGate (PIX/crypto) + webhooks genéricos
- **Emails:** Mailjet (com template de abandoned cart genérico)
- **LLM:** multi-provider (Anthropic / OpenAI / Gemini) — detecta pelo prefixo da API key
- **Admin:** dashboard com stats + usuários + pagamentos + página de configurações completa

---

## 1. Primeiro uso

```bash
# 1. Clone como novo projeto
cp -r esqueleton/ ../meu-saas && cd ../meu-saas
rm -rf node_modules pnpm-lock.yaml dist .env

# 2. Renomeie (interativo)
node scripts/rename-project.mjs
# ↳ substitui package.json.name, shared/const.ts APP_NAME, client/index.html title

# 3. Configure env
cp .env.example .env     # e preencha — mínimo: DATABASE_URL, JWT_SECRET

# 4. Banco
pnpm install
pnpm db:push             # gera e aplica migrations

# 5. Rode
pnpm dev                 # Vite + Express em http://localhost:3000
```

**Mínimo pra subir:** `DATABASE_URL` + `JWT_SECRET`. Sem Google OAuth o botão "Continuar com Google" retorna 500, mas email/senha funciona. Sem `MP_ACCESS_TOKEN` (ou valor no admin) o checkout falha.

---

## 2. Configurações: DB primeiro, env como fallback

**Regra:** todas as credenciais externas (MercadoPago, XGate, Mailjet, LLM, Google OAuth, reCAPTCHA) têm prioridade no banco (`site_settings`) sobre o `.env`. Preencha pelo painel `/admin/settings` — assim você muda em produção sem redeploy.

O `.env` é útil para: **secrets de infra** (`DATABASE_URL`, `JWT_SECRET`, `APP_URL`) e para bootstrap (primeira vez rodando antes de entrar no admin).

Promoção pra admin:
- Opção 1: set `OWNER_OPEN_ID=seu@email.com` no `.env` — o primeiro registro com esse email já vira admin.
- Opção 2: `UPDATE users SET role='admin' WHERE id=1;` direto no MySQL.

---

## 3. Estrutura

```
client/
  src/
    components/
      ui/               # 53 componentes shadcn — copy-paste, edite à vontade
      Navbar.tsx        # topo; APP_NAME puxado de shared/const.ts
      DashboardLayout.tsx, ErrorBoundary.tsx, SiteScriptsInjector.tsx, WhatsAppCtaButton.tsx
    pages/              # Home, Login, Register, Dashboard, Items, Checkout, Admin, AdminSettings, …
    hooks/              # useMobile, useRecaptcha, usePersistFn, useComposition
    lib/{trpc,utils,ads}.ts
    contexts/ThemeContext.tsx
    _core/hooks/useAuth.ts

server/
  _core/
    index.ts            # entry Express
    trpc.ts             # publicProcedure, protectedProcedure, adminProcedure
    context.ts          # cria sessão anônima para visitantes
    cookies.ts, env.ts, sdk.ts, vite.ts
    oauth.ts            # /api/auth/{register,login,logout,check-email,google/*}
    googleAuth.ts       # exchange code + userinfo
    recaptcha.ts        # verifyRecaptcha(token, action)
    llm.ts              # multi-provider
  db.ts                 # helpers Drizzle (CRUD users/items/payments/subs/…)
  routers.ts            # tRPC: system, site, auth, items, payments, subscriptions, admin
  webhookHandler.ts     # /api/webhook/{mercadopago,xgate} + manual confirm
  hooks.ts              # ← ESTENDA AQUI: onPaymentApproved, onSubscriptionChanged
  xgate.ts, mailjet.ts

shared/
  const.ts              # APP_NAME, COOKIE_NAME
  site-settings.ts      # SiteSettingsData, Public/Full types, DEFAULT_SITE_SETTINGS
  types.ts              # reexporta tudo
  _core/errors.ts       # HttpError + construtores

drizzle/
  schema.ts             # users, items, payments, userSubscriptions, downloadTokens, siteSettings
  migrations/           # geradas por drizzle-kit
```

Entidades genéricas: **`users`, `payments`, `userSubscriptions`, `downloadTokens`, `siteSettings`**. A entidade `items` é só um CRUD-exemplo — substitua pela sua lógica de negócio (ou deixe e crie outras ao lado).

---

## 4. Fluxos principais

### Auth (`server/_core/oauth.ts`)
- `POST /api/auth/register` — email, name, password, recaptchaToken → cria user + bcrypt + cookie JWT
- `POST /api/auth/login` — email, password, recaptchaToken → cookie JWT
- `POST /api/auth/logout` — limpa cookie
- `POST /api/auth/check-email` — "já existe? tem senha?"
- `GET /api/auth/google/start` → redireciona pro Google
- `GET /api/auth/google/callback` → cria user + cookie, redireciona `/dashboard`

reCAPTCHA v3 é aplicado no login/register. Se `site_settings.recaptchaSecretKey` estiver vazio, a verificação é **pulada** (score = 1) — ideal pra dev.

### tRPC (`server/routers.ts`)
- `system.health` — ping
- `site.settings` — **público**; só expõe `recaptchaSiteKey`, `googleClientId`, whatsapp, scripts, preços
- `auth.me` — retorna user atual ou null
- `items.{list,get,create,update,delete}` — CRUD exemplo
- `payments.{createCheckout,status,myPayments}` — cria preference MP
- `subscriptions.{current,hasActive,createMonthly}` — assinatura recorrente
- `admin.{stats,listUsers,listPayments,updateUserRole,getSiteSettings,updateSiteSettings}` — só `role=admin`

### Pagamentos (`server/webhookHandler.ts`)
- Convenção de `external_reference`: `payment-{id}` para pagamentos únicos, `subscription-user-{userId}` para assinaturas.
- Quando MP ou XGate aprovam, o handler chama `onPaymentApproved(payment)` de `server/hooks.ts`. **É aqui que você coloca a lógica de negócio** (conceder acesso, mandar email, liberar download, etc).

```ts
// server/hooks.ts
export async function onPaymentApproved(payment: Payment) {
  // payment.resourceType + payment.resourceId identificam o recurso comprado
  // (você define esses campos ao chamar payments.createCheckout)
  if (payment.resourceType === "item") {
    await grantItemAccess(payment.userId, payment.resourceId!);
    await sendConfirmationEmail(payment.payerEmail);
  }
}
```

### LLM (`server/_core/llm.ts`)
Chamadas via `invokeLLM(params)`. Auto-detecta o provider pela chave (`LLM_API_KEY` no env ou `llmApiKey` em `site_settings`):
- `sk-ant-…` → **Anthropic Claude** (`claude-haiku-4-5`)
- `sk-…` → **OpenAI** (`gpt-4o-mini`)
- outro → **Google Gemini** (`gemini-2.0-flash`)

Troque a chave, troque o provider. Formato de entrada/saída é OpenAI-compatível (Anthropic é normalizado internamente).

---

## 5. Como adicionar uma entidade nova

Use `items` como molde. Para criar uma tabela `posts`, por exemplo:

**1. Schema** — `drizzle/schema.ts`:
```ts
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;
```

**2. Migration** — `pnpm db:push`

**3. Helpers CRUD** — `server/db.ts` (copie o bloco de `items`):
```ts
export async function createPost(data: InsertPost) { /* ... */ }
export async function getPostsByUserId(userId: number) { /* ... */ }
// etc
```

**4. Router tRPC** — `server/routers.ts`:
```ts
const postsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getPostsByUserId(ctx.user.id)),
  create: protectedProcedure.input(/* zod */).mutation(/* ... */),
  // ...
});

export const appRouter = router({
  // ...
  posts: postsRouter,
});
```

**5. Página** — copie `client/src/pages/Items.tsx` → `Posts.tsx`, ajuste copy e campos.

**6. Rota** — `client/src/App.tsx`:
```tsx
<Route path="/posts" component={Posts} />
```

---

## 6. Como cobrar por um recurso

No frontend, chame `payments.createCheckout` passando o recurso:

```ts
const checkout = trpc.payments.createCheckout.useMutation();
checkout.mutate({
  title: "Post Premium #42",
  amount: 29.90,
  resourceType: "post",
  resourceId: post.id,
});
// checkout.data.initPoint → window.location.href
```

Quando MP aprovar, o webhook chama `onPaymentApproved(payment)`. Em `server/hooks.ts` você despacha baseado em `payment.resourceType`:

```ts
if (payment.resourceType === "post") {
  await db.markPostAsPaid(payment.resourceId!);
}
```

---

## 7. Admin: configurações em runtime

Acesse `/admin/settings` com um user `role=admin`. Lá você edita (sem redeploy):

- Preços (produto, mensal, anual)
- MercadoPago (access token, subscription back URL)
- XGate (email, senha, base URL, customer ID)
- LLM (API key)
- Google OAuth (client ID + secret)
- reCAPTCHA v3 (site key + secret + score mínimo)
- Mailjet (API key/secret, from email/name)
- WhatsApp CTA flutuante (número, mensagem, animação, posição)
- Scripts de tracking (`<head>` e antes de `</body>`)

---

## 8. Testando webhooks em dev

```bash
# Simular aprovação MercadoPago
curl -X POST http://localhost:3000/api/webhook/mercadopago \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"MP_PAYMENT_ID"}}'

# Simular aprovação XGate (PIX/crypto)
curl -X POST http://localhost:3000/api/webhook/xgate \
  -H "Content-Type: application/json" \
  -d '{"id":"XGATE_ID","status":"COMPLETED","operation":"DEPOSIT"}'
```

Como fallback (caso o webhook não tenha disparado quando o user volta pro site), a página `/payment/success` chama `/api/webhook/mercadopago/confirm` com o `payment_id` da query string.

---

## 9. Deploy

```bash
pnpm build           # vite build + esbuild server
pnpm start           # node dist/index.js
```

**Variáveis obrigatórias em prod:** `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `PUBLIC_BASE_URL`.

No Google Cloud Console, autorize o redirect URI `${APP_URL}/api/auth/google/callback`.

**Atenção:** se `dist/public/index.html` existir, o server serve estático em vez de rodar Vite em dev. Se for testar build local, roda `pnpm build && pnpm start`. Pra voltar pro modo dev, **delete `dist/`**.

---

## 10. FAQ

**Posso usar PostgreSQL?** Sim, com trabalho: trocar `mysql2` por `pg`/`postgres`, `mysqlTable`/`mysqlEnum` por `pgTable`/`pgEnum`, e `drizzle.config.ts` (`dialect: "postgresql"`).

**Como desabilito sessão anônima?** Em `server/_core/context.ts`, remova o bloco que cria `anon_${nanoid(16)}`. Procedures `public` vão receber `user: null`.

**O reCAPTCHA sempre bloqueia em dev.** Só ativa se você preencher `site_settings.recaptchaSecretKey`. Deixe vazio → verificação é pulada.

**Webhook MP requer HTTPS pra testar.** Use `ngrok http 3000` em dev e configure o URL do ngrok como `PUBLIC_BASE_URL` + adicione no app MP.

**Como trocar o provider de LLM?** Muda só a `LLM_API_KEY`. Código detecta pelo prefixo. Veja `server/_core/llm.ts:217`.

---

## 11. O que NÃO incluí (e deveria ter pensado?)

Coisas úteis que ficaram de fora, caso o próximo projeto precise:

- ❌ **Uploads de arquivo** — AWS S3 foi removido. Adicione `@aws-sdk/client-s3` + signed URLs se precisar.
- ❌ **Emails de confirmação de conta** — o register não manda nada. Adicione em `oauth.ts` após `upsertUser`.
- ❌ **Rate limiting** — sem proteção contra brute force em `/api/auth/login`. Adicione `express-rate-limit` ou cloudflare.
- ❌ **i18n** — copy tá em pt-BR hardcoded. Troque por `react-i18next` se for internacional.
- ❌ **Observabilidade** — sem Sentry/datadog. Adicione no `main.tsx` e `_core/index.ts`.
- ❌ **Testes** — só um `vitest.config.ts` vazio. Escreva seus próprios.

---

Bom build. Se bater dúvida e perder tempo, me manda o contexto — com sorte tô no próximo projeto.
