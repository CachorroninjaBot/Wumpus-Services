import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TicketConsole } from "@/components/tickets/ticket-console";
import { useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/tickets")({
  validateSearch: (search: Record<string, unknown>): { ticket?: number } => {
    const raw = search.ticket;
    const parsed = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN;
    return Number.isInteger(parsed) && parsed > 0 ? { ticket: parsed } : {};
  },
  component: TicketsInbox,
});

function TicketsInbox() {
  const { ticket } = Route.useSearch();
  const gid = useWumpus((s) => s.activeGuildId);

  return (
    <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Atendimento"
        description="A fila real do seu servidor: leia a conversa, responda, assuma, transfira e encerre sem sair do painel."
        actions={
          <Link to="/app/config/tickets">
            <Button size="sm" variant="outline">
              <Settings2 aria-hidden="true" className="size-4" />
              Configurar painéis
            </Button>
          </Link>
        }
      />
      <TicketConsole guildId={gid} initialTicket={ticket} />
    </div>
  );
}
