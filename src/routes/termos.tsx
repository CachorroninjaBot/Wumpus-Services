import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage, termsDocument } from "@/components/legal-document";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | Wumpus" },
      { name: "description", content: "Leia as regras para acessar a dashboard, conectar o bot e usar as ferramentas Wumpus." },
    ],
  }),
  component: () => <LegalDocumentPage document={termsDocument} />,
});
