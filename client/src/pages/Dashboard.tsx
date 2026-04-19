import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Receipt } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });

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
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-3xl font-bold mb-2">Olá, {user.name}</h1>
          <p className="text-muted-foreground mb-8">Bem-vindo ao seu painel.</p>

          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/items">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <Package className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Meus items</CardTitle>
                  <CardDescription>
                    CRUD de exemplo. Substitua pela sua entidade principal.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/checkout">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <Receipt className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Checkout</CardTitle>
                  <CardDescription>
                    Teste o fluxo de pagamento MercadoPago.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>

          <div className="mt-8">
            <Button variant="outline" asChild>
              <a href="/api/auth/logout" onClick={(e) => { e.preventDefault(); fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/")); }}>
                Sair
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
