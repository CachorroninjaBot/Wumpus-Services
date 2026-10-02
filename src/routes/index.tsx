import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { DiscordModalPreview, DiscordPanel } from "@/components/discord-panel";
import { Button } from "@/components/ui/button";
import { brand, plans as fallbackPlans } from "@/lib/wumpus/brand";
import { SHARD_STORE } from "@/lib/wumpus/catalog";
import { useBilling } from "@/lib/wumpus/use-billing";
import { getPublicBotHealth, type PublicBotHealth } from "@/lib/wumpus/health";
import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const faqs = [
  {
    q: "O bot realmente lê o que eu configuro?",
    a: "As configurações publicadas passam por validação no servidor antes de chegar ao bot. Os recursos divulgados aqui correspondem aos fluxos integrados; campos sem integração não são anunciados como concluídos.",
  },
  {
    q: "A IA fala com o cliente?",
    a: "Não. A IA só sugere para a equipe — análise de ticket e pré-review de candidatura. Nada é enviado sozinho no canal.",
  },
  {
    q: "Preciso decorar comandos?",
    a: "Não. Os painéis publicados no Discord abrem tickets e formulários. A fila de tickets desta prévia ainda é demonstrativa; as ações de atendimento não são sincronizadas com o bot.",
  },
  {
    q: "Como eu entro no MEU painel?",
    a: "Botão Entrar com Discord. OAuth com identify + guilds. Só servidores que tu administra aparecem.",
  },
];

function Home() {
  const billing = useBilling();
  const [health, setHealth] = useState<PublicBotHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const plans = billing.data?.plans?.length ? billing.data.plans : fallbackPlans;
  const discounts = billing.data?.discounts ?? [
    { label: "trimestral", discount: 5 },
    { label: "semestral", discount: 10 },
    { label: "anual", discount: 18 },
  ];

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getPublicBotHealth()
        .then((result) => {
          if (active) {
            setHealth(result);
            setHealthError(false);
          }
        })
        .catch(() => {
          if (active) setHealthError(true);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <BrandMark size={28} />
          <span className="font-semibold tracking-tight">Wumpus</span>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#modulos" className="hover:text-foreground">
              Módulos
            </a>
            <a href="#planos" className="hover:text-foreground">
              Planos
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
          <Link to="/entrar" className="ml-auto sm:ml-4">
            <Button size="sm">Entrar com Discord</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="noise pointer-events-none absolute inset-0 opacity-60" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Discord · atendimento · proteção
            </p>
            <h1 className="mt-3 mb-4 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              {brand.tagline}
            </h1>
            <p className="m-0 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {brand.description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/entrar">
                <Button size="lg" className="w-full sm:w-auto">
                  Entrar com Discord
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href={brand.invite} target="_blank" rel="noreferrer">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Adicionar ao Discord
                </Button>
              </a>
            </div>
          </div>
          <DiscordPanel
            title="Central de atendimento"
            description="Escolha o departamento. Um canal privado é criado só para você e a equipe."
            buttons={["Compras", "Suporte", "Reembolso"]}
          />
        </div>
      </section>

      <section id="modulos" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            O que o Wumpus fecha
          </p>
          <h2 className="mt-2 mb-8 max-w-xl text-3xl font-semibold tracking-tight">
            Painel por resultado. Avançado fica escondido.
          </h2>
          <div className="grid gap-x-8 lg:grid-cols-2">
            <Feature
              title="Tickets de verdade"
              body="Departamentos, SLA, prioridade, transcrição no encerramento, feedback e métricas por atendente."
              preview={<DiscordPanel channel="abrir-atendimento" title="Central de atendimento" description="Escolha um departamento para falar com a equipe." buttons={["Suporte", "Compras", "Denúncias"]} />}
            />
            <Feature
              title="Candidaturas com modal"
              body="Formulário no Discord, cooldown e aprovação ou recusa com um motivo visível."
              preview={<DiscordModalPreview title="Candidatura à equipe" questions={["Nome ou apelido", "Por que quer entrar?", "Experiência relevante"]} />}
            />
            <Feature
              title="Moderação com histórico"
              body="Advertências, silenciamento, expulsão e banimento registrados para a equipe."
              preview={<DiscordPanel channel="moderação" title="Ação registrada" description="O histórico acompanha o motivo, a evidência e as medidas anteriores." buttons={["Advertir", "Silenciar", "Revisar caso"]} />}
            />
            <Feature
              title="Proteção configurável"
              body="AutoMod e resposta a raids com níveis graduais; sem tomar ações destrutivas sem autorização."
              preview={<DiscordPanel channel="segurança" title="Proteção da comunidade" description="Revise alertas e escolha a resposta adequada para o seu servidor." buttons={["Ver alertas", "Lockdown"]} />}
            />
          </div>
        </div>
      </section>

      <section id="planos" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mt-0 mb-2 text-3xl font-semibold tracking-tight">WumPlus, cobrado na ShardPay</h2>
          <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
            Loja {billing.data?.storeName ?? SHARD_STORE.name}. Nos planos mensais,{" "}
            {discounts.map((d) => `${d.label} −${d.discount}%`).join(", ")}.
          </p>
          {billing.data && !billing.data.ok ? (
            <p role="status" className="mb-5 text-sm text-warn">
              A ShardPay está indisponível. Estes valores são a referência salva; confirme o preço atual no checkout.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={`rounded-2xl p-5 shadow-border ${plan.highlight ? "bg-card ring-1 ring-primary/40" : "bg-card/60"}`}
              >
                <p className="m-0 text-sm text-muted-foreground">{plan.name}</p>
                <p className="mt-1 mb-2 text-2xl font-semibold">{plan.price}</p>
                <p className="mt-0 text-sm text-muted-foreground">{plan.blurb}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-col gap-2">
                  <a href={plan.checkoutUrl} target="_blank" rel="noreferrer">
                    <Button variant={plan.highlight ? "default" : "outline"} className="w-full">
                      Assinar na ShardPay
                    </Button>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="bot-status-title" className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center">
          <div className={`size-2.5 shrink-0 rounded-full ${health?.status === "online" ? "bg-ok" : health?.status === "offline" ? "bg-destructive" : "bg-muted-foreground"}`} />
          <div className="min-w-0 flex-1">
            <h2 id="bot-status-title" className="m-0 text-base font-semibold">Status do Wumpus</h2>
            <p className="m-0 text-sm text-muted-foreground">
              {healthError
                ? "Não foi possível consultar o monitor de saúde."
                : health?.status === "online"
                  ? `Online · ${health.guildCount ?? "—"} servidores conectados · atualizado ${health.lastSeenAt ? formatRelative(health.lastSeenAt) : "agora"}`
                  : health?.status === "offline"
                    ? `Sem heartbeat recente${health.lastSeenAt ? ` · visto ${formatRelative(health.lastSeenAt)}` : ""}`
                    : "Status ainda não disponível."}
            </p>
          </div>
          {health?.pingMs !== null && health?.pingMs !== undefined ? (
            <span className="text-sm text-muted-foreground">latência {health.pingMs} ms</span>
          ) : null}
        </div>
      </section>

      <section id="faq" className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="mt-0 mb-6 text-3xl font-semibold tracking-tight">Perguntas diretas</h2>
          <div className="divide-y divide-border rounded-2xl bg-card shadow-border">
            {faqs.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 mb-1 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>
            {brand.name} · {brand.legal}
          </span>
          <Link to="/entrar" className="sm:ml-auto text-foreground">
            Entrar com Discord
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body, preview }: { title: string; body: string; preview: React.ReactNode }) {
  return (
    <article className="grid min-w-0 gap-4 border-t border-border py-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
      <div>
        <h3 className="mt-0 mb-2 text-lg font-semibold">{title}</h3>
        <p className="m-0 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl">{preview}</div>
    </article>
  );
}
