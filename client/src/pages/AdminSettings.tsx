import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { SiteSettingsData } from "@shared/site-settings";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function AdminSettings() {
  const { loading: authLoading, user } = useAuth({ redirectOnUnauthenticated: true });
  const enabled = Boolean(user && user.role === "admin");

  const { data: settings, isLoading } = trpc.admin.getSiteSettings.useQuery(undefined, {
    enabled,
  });

  const utils = trpc.useUtils();
  const update = trpc.admin.updateSiteSettings.useMutation({
    onSuccess: async () => {
      await utils.admin.getSiteSettings.invalidate();
      toast.success("Configurações salvas");
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState<SiteSettingsData | null>(null);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 container mx-auto px-4">
          <p className="text-center text-muted-foreground">Acesso negado.</p>
        </main>
      </div>
    );
  }
  if (isLoading || !form) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </main>
      </div>
    );
  }

  const set = <K extends keyof SiteSettingsData>(k: K, v: SiteSettingsData[K]) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));

  const handleSave = () => update.mutate(form);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Link>
              <h1 className="text-3xl font-bold">Configurações</h1>
              <p className="text-muted-foreground">
                Valores persistem em <code>site_settings</code>. Têm prioridade sobre{" "}
                <code>.env</code>.
              </p>
            </div>
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </div>

          {/* Preços ─────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Preços</CardTitle>
              <CardDescription>Usados em produtos e assinaturas.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <NumberField label="Produto (BRL)" value={form.defaultProductPrice} onChange={(v) => set("defaultProductPrice", v)} />
              <NumberField label="Mensal (BRL)" value={form.subscriptionMonthlyPrice} onChange={(v) => set("subscriptionMonthlyPrice", v)} />
              <NumberField label="Anual (BRL)" value={form.subscriptionAnnualPrice} onChange={(v) => set("subscriptionAnnualPrice", v)} />
            </CardContent>
          </Card>

          {/* Pagamentos ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>MercadoPago</CardTitle>
              <CardDescription>Access token e URLs de retorno.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PasswordField label="Access token" value={form.mercadopagoAccessToken} onChange={(v) => set("mercadopagoAccessToken", v)} />
              <TextField label="Subscription back URL" value={form.mercadopagoSubscriptionBackUrl} onChange={(v) => set("mercadopagoSubscriptionBackUrl", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>XGate (PIX / crypto)</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <TextField label="Email" value={form.xgateEmail} onChange={(v) => set("xgateEmail", v)} />
              <PasswordField label="Senha" value={form.xgatePassword} onChange={(v) => set("xgatePassword", v)} />
              <TextField label="API base URL" value={form.xgateApiBaseUrl} onChange={(v) => set("xgateApiBaseUrl", v)} />
              <TextField label="Customer ID default" value={form.xgateDefaultCustomerId} onChange={(v) => set("xgateDefaultCustomerId", v)} />
            </CardContent>
          </Card>

          {/* LLM ────────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>LLM</CardTitle>
              <CardDescription>
                Detecção por prefixo: <code>sk-ant-…</code> → Anthropic, <code>sk-…</code> → OpenAI, outro → Gemini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordField label="API key" value={form.llmApiKey} onChange={(v) => set("llmApiKey", v)} />
            </CardContent>
          </Card>

          {/* Google OAuth ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Google OAuth</CardTitle>
              <CardDescription>
                Credenciais em{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google Cloud Console
                </a>
                . Redirect URI: <code>{`${window.location.origin}/api/auth/google/callback`}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <TextField label="Client ID" value={form.googleClientId} onChange={(v) => set("googleClientId", v)} />
              <PasswordField label="Client secret" value={form.googleClientSecret} onChange={(v) => set("googleClientSecret", v)} />
            </CardContent>
          </Card>

          {/* reCAPTCHA ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>reCAPTCHA v3</CardTitle>
              <CardDescription>
                Protege login e registro. Credenciais em{" "}
                <a
                  href="https://www.google.com/recaptcha/admin"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google reCAPTCHA admin
                </a>
                . Deixe vazio pra desabilitar a verificação.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <TextField label="Site key (público)" value={form.recaptchaSiteKey} onChange={(v) => set("recaptchaSiteKey", v)} />
              </div>
              <NumberField label="Score mínimo (0-1)" value={form.recaptchaMinScore} onChange={(v) => set("recaptchaMinScore", Math.max(0, Math.min(1, v)))} />
              <div className="sm:col-span-3">
                <PasswordField label="Secret key" value={form.recaptchaSecretKey} onChange={(v) => set("recaptchaSecretKey", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Mailjet ────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Mailjet</CardTitle>
              <CardDescription>Emails transacionais (abandoned cart).</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <TextField label="API key" value={form.mailjetApiKey} onChange={(v) => set("mailjetApiKey", v)} />
              <PasswordField label="API secret" value={form.mailjetApiSecret} onChange={(v) => set("mailjetApiSecret", v)} />
              <TextField label="From email" value={form.mailjetFromEmail} onChange={(v) => set("mailjetFromEmail", v)} />
              <TextField label="From name" value={form.mailjetFromName} onChange={(v) => set("mailjetFromName", v)} />
            </CardContent>
          </Card>

          {/* WhatsApp ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp CTA</CardTitle>
              <CardDescription>Botão flutuante de contato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="wa-enabled">Ativo</Label>
                <Switch
                  id="wa-enabled"
                  checked={form.whatsappEnabled}
                  onCheckedChange={(v) => set("whatsappEnabled", v)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField label="Número (+55...)" value={form.whatsappNumber} onChange={(v) => set("whatsappNumber", v)} />
                <TextField label="CTA" value={form.whatsappCtaText} onChange={(v) => set("whatsappCtaText", v)} />
                <div className="space-y-2">
                  <Label>Animação</Label>
                  <Select value={form.whatsappAnimation} onValueChange={(v) => set("whatsappAnimation", v as SiteSettingsData["whatsappAnimation"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pulse">Pulse</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Select value={form.whatsappPosition} onValueChange={(v) => set("whatsappPosition", v as SiteSettingsData["whatsappPosition"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Direita</SelectItem>
                      <SelectItem value="left">Esquerda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem inicial</Label>
                <Textarea rows={3} value={form.whatsappMessage} onChange={(e) => set("whatsappMessage", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Scripts ────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Scripts de tracking</CardTitle>
              <CardDescription>Injetados em <code>&lt;head&gt;</code> e antes de <code>&lt;/body&gt;</code>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Head</Label>
                <Textarea rows={4} className="font-mono text-xs" value={form.headScripts} onChange={(e) => set("headScripts", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea rows={4} className="font-mono text-xs" value={form.bodyScripts} onChange={(e) => set("bodyScripts", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={update.isPending} size="lg">
              {update.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar tudo
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShow((v) => !v)}>
          {show ? "ocultar" : "mostrar"}
        </button>
      </div>
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
