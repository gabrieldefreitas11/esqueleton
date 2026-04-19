import Navbar from "@/components/Navbar";
import { APP_NAME } from "@shared/const";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-3xl prose dark:prose-invert">
        <h1>Política de Privacidade</h1>
        <p>
          <strong>Placeholder.</strong> Edite{" "}
          <code>client/src/pages/Privacy.tsx</code> com a política real do{" "}
          {APP_NAME}.
        </p>
        <h2>Dados coletados</h2>
        <p>Descreva aqui quais dados você coleta e com que propósito.</p>
        <h2>Uso dos dados</h2>
        <p>Descreva aqui como os dados são usados.</p>
        <h2>Contato</h2>
        <p>Email de contato do DPO.</p>
      </main>
    </div>
  );
}
