import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Home, XCircle } from "lucide-react";
import { Link } from "wouter";

export default function PaymentFailure() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-md text-center">
        <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Pagamento não aprovado</h1>
        <p className="text-muted-foreground mb-6">
          Tente novamente ou use outro método de pagamento.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/checkout">
            <Button>Tentar novamente</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
