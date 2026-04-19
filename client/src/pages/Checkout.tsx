import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { trackBeginCheckout } from "@/lib/ads";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Checkout() {
  const { loading, user } = useAuth({ redirectOnUnauthenticated: true });
  const [title, setTitle] = useState("Compra de exemplo");
  const [amount, setAmount] = useState("9.90");

  const createCheckout = trpc.payments.createCheckout.useMutation({
    onSuccess: (data) => {
      trackBeginCheckout({
        value: Number(amount),
        currency: "BRL",
        itemId: `payment-${data.paymentId}`,
        itemName: title,
      });
      window.location.href = data.initPoint;
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-xl">
          <h1 className="text-3xl font-bold mb-6">Checkout</h1>

          <Card>
            <CardHeader>
              <CardTitle>Teste de pagamento</CardTitle>
              <CardDescription>
                Cria uma preferência no MercadoPago e redireciona.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Produto</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (BRL)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={createCheckout.isPending}
                onClick={() =>
                  createCheckout.mutate({
                    title,
                    amount: Number(amount),
                  })
                }
              >
                {createCheckout.isPending && (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                )}
                Pagar com MercadoPago
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
