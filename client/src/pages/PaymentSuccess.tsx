import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { trackPurchase } from "@/lib/ads";
import { CheckCircle, Home, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [mpPaymentId, setMpPaymentId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversionSent = useRef(false);

  const payment = trpc.payments.status.useQuery(
    { paymentId: paymentId ?? 0 },
    { enabled: Boolean(paymentId && confirmed) }
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("payment_id") ?? params.get("collection_id");
    const localId = params.get("payment_id_local");
    const status = params.get("status") ?? params.get("collection_status");

    const numericId = localId ? parseInt(localId, 10) : null;
    if (numericId) setPaymentId(numericId);
    if (pid) setMpPaymentId(pid);

    if (status === "approved" && pid) {
      confirmPayment(pid);
    } else if (status === "approved") {
      setConfirming(false);
      setConfirmed(true);
    } else {
      setConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!confirmed || conversionSent.current) return;
    const amount = payment.data?.amount ? Number(payment.data.amount) : undefined;
    trackPurchase({
      transactionId: mpPaymentId ?? (paymentId ? `payment-${paymentId}` : undefined),
      value: amount,
      currency: "BRL",
    });
    conversionSent.current = true;
  }, [confirmed, mpPaymentId, paymentId, payment.data?.amount]);

  async function confirmPayment(mpId: string) {
    setConfirming(true);
    try {
      const res = await fetch("/api/webhook/mercadopago/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpPaymentId: mpId }),
      });
      if (!res.ok) throw new Error("Falha ao confirmar");
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-md text-center">
        {confirming ? (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirmando pagamento…</h1>
          </>
        ) : error ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-1" /> Ir ao dashboard
            </Button>
          </>
        ) : (
          <>
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h1 className="text-3xl font-bold mb-2">Pagamento aprovado!</h1>
            <p className="text-muted-foreground mb-6">
              Obrigado pela compra.
            </p>
            <Link href="/dashboard">
              <Button>
                <Home className="w-4 h-4 mr-1" /> Ir ao dashboard
              </Button>
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
