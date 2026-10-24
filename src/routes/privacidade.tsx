import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage, privacyDocument } from "@/components/legal-document";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Wumpus" },
      { name: "description", content: "Saiba como o Wumpus trata dados da conta, dos servidores conectados e das ferramentas de atendimento." },
    ],
  }),
  component: () => <LegalDocumentPage document={privacyDocument} />,
});
