import Navbar from "@/components/Navbar";
import { APP_NAME } from "@shared/const";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-3xl prose dark:prose-invert">
        <h1>Termos de Uso</h1>
        <p>
          <strong>Placeholder.</strong> Edite{" "}
          <code>client/src/pages/Terms.tsx</code> com os termos reais do{" "}
          {APP_NAME}.
        </p>
        <h2>Uso do serviço</h2>
        <p>Descreva aqui as regras de uso.</p>
        <h2>Pagamentos e cancelamentos</h2>
        <p>Descreva política de reembolso.</p>
        <h2>Limitação de responsabilidade</h2>
        <p>Cláusulas legais aplicáveis.</p>
      </main>
    </div>
  );
}
