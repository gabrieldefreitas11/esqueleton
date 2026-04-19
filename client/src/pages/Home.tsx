import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@shared/const";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl mx-auto">
            Bem-vindo ao <span className="text-primary">{APP_NAME}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Este é o esqueleto. Edite <code>Home.tsx</code> para descrever seu
            produto.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg">
                Criar conta <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: "Auth pronta", desc: "Google OAuth + email/senha com bcrypt." },
              { title: "Pagamentos", desc: "MercadoPago + XGate prontos." },
              { title: "Admin", desc: "Dashboard com stats, usuários e pagamentos." },
            ].map((f) => (
              <div key={f.title} className="border rounded-xl p-6 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">{f.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <div className="flex gap-4">
            <Link href="/privacy">Privacidade</Link>
            <Link href="/terms">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
