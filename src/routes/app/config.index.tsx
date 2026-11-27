import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Gauge,
  Settings,
  Shield,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import type { ModuleKey } from "@/lib/wumpus/defaults";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/config/")({
  component: ConfigHub,
});

type HubItem = {
  to: "/app/config/tickets" | "/app/forms" | "/app/staff" | "/app/moderation" | "/app/protect" | "/app/knowledge" | "/app/settings" | "/app/logs" | "/app/stats";
  label: string;
  description: string;
  icon: typeof Ticket;
  module: ModuleKey;
};

const items: HubItem[] = [
  {
    to: "/app/config/tickets",
    label: "Painéis de atendimento",
    description: "Tipos de ticket, perguntas, equipe, canais privados, SLA e mensagens.",
    icon: Ticket,
    module: "tickets",
  },
  {
    to: "/app/forms",
    label: "Formulários",
    description: "Candidaturas e inscrições: perguntas, revisão e canais de resposta.",
    icon: ClipboardCheck,
    module: "forms",
  },
  {
    to: "/app/staff",
    label: "Equipe",
    description: "Cargos de atendimento, plantão, metas de resposta e carga.",
    icon: Users,
    module: "staff",
  },
  {
    to: "/app/moderation",
    label: "Moderação",
    description: "Advertências, silenciamentos e punições automáticas.",
    icon: ShieldAlert,
    module: "moderation",
  },
  {
    to: "/app/protect",
    label: "Proteção",
    description: "AutoMod, anti-raid, OCR de imagens e verificação de membros.",
    icon: Shield,
    module: "security",
  },
  {
    to: "/app/knowledge",
    label: "Base de conhecimento",
    description: "Artigos aprovados que o bot usa para responder no servidor.",
    icon: BookOpen,
    module: "knowledge",
  },
  {
    to: "/app/settings",
    label: "Servidor",
    description: "Boas-vindas, cargos automáticos, canais de anúncio e manutenção.",
    icon: Settings,
    module: "servers",
  },
  {
    to: "/app/logs",
    label: "Auditoria",
    description: "Canal de registros e o que entra em cada evento.",
    icon: FileText,
    module: "logs",
  },
  {
    to: "/app/stats",
    label: "Estatísticas",
    description: "Atividade, CSAT e desempenho por período.",
    icon: Gauge,
    module: "statistics",
  },
];

function ConfigHub() {
  const gid = useWumpus((state) => state.activeGuildId);

  return (
    <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Tudo o que o bot faz neste servidor, organizado por módulo. A operação do dia a dia fica em Atender."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <HubCard key={item.to} item={item} />
        ))}
      </div>
    </div>
  );
}

function HubCard({ item }: { item: HubItem }) {
  const moduleState = useModule(item.module);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={cn(
        "group flex min-h-[7.5rem] flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors",
        "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-sm font-semibold">{item.label}</h2>
          <Badge tone={moduleState.enabled ? "ok" : "default"}>
            {moduleState.enabled ? "Ligado" : "Desligado"}
          </Badge>
        </div>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{item.description}</p>
      </div>
    </Link>
  );
}
