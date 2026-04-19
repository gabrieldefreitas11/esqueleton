import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Clock, Home } from "lucide-react";
import { Link } from "wouter";

export default function PaymentPending() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-md text-center">
        <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Pagamento pendente</h1>
        <p className="text-muted-foreground mb-6">
          Assim que o pagamento for confirmado, você receberá acesso.
        </p>
        <Link href="/dashboard">
          <Button>
            <Home className="w-4 h-4 mr-1" /> Ir ao dashboard
          </Button>
        </Link>
      </main>
    </div>
  );
}
