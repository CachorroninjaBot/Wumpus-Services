import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { DiscordPanel } from "@/components/discord-panel";
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
    a: "Não. Os painéis publicados no Discord abrem tickets e formulários. A equipe acompanha os tickets reais na dashboard, enquanto o bot mantém as ações sincronizadas com os canais do servidor.",
  },
  {
    q: "Como eu entro no MEU painel?",
    a: "Botão Entrar com Discord. OAuth com identify + guilds. Só servidores que tu administra aparecem.",
  },
];

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">✓</span>
      <div>
        <p className="m-0 text-sm font-semibold">{title}</p>
        <p className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

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
            <a href="#assinatura" className="hover:text-foreground">
              Assinatura
            </a>
            <a href="#modulos" className="hover:text-foreground">
              Módulos
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
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <h1 className="mt-0 mb-4 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
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

      <section aria-label="Benefícios principais" className="border-y border-border bg-muted/35">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:grid-cols-3 sm:gap-8">
          <TrustItem title="Configuração visual" body="Mude o comportamento do servidor sem decorar comandos." />
          <TrustItem title="Ações com aprovação" body="O Wumpus sugere e registra; sua equipe decide." />
          <TrustItem title="Dados sincronizados" body="Publicações, tickets e auditoria ficam no mesmo painel." />
        </div>
      </section>

      <section id="modulos" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mt-0 mb-8 max-w-xl text-3xl font-semibold tracking-tight">
            Painel por resultado. Avançado fica escondido.
          </h2>
          <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <Feature
              title="Tickets de verdade"
              body="Departamentos, SLA, prioridade, transcrição no encerramento, feedback e métricas por atendente."
              preview={<DiscordPanel channel="abrir-atendimento" title="Central de atendimento" description="Escolha um departamento para falar com a equipe." buttons={["Suporte", "Compras", "Denúncias"]} />}
            />
            <ul className="m-0 divide-y divide-border border-t border-border p-0">
              <li className="list-none py-5">
                <h3 className="m-0 text-base font-semibold">Candidaturas com modal</h3>
                <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">Formulário no Discord, cooldown e aprovação ou recusa com um motivo visível.</p>
              </li>
              <li className="list-none py-5">
                <h3 className="m-0 text-base font-semibold">Moderação com histórico</h3>
                <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">Advertências, silenciamento, expulsão e banimento registrados para a equipe.</p>
              </li>
              <li className="list-none py-5">
                <h3 className="m-0 text-base font-semibold">Proteção configurável</h3>
                <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">AutoMod e resposta a raids em níveis graduais, sem ações destrutivas sem autorização.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="assinatura" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mt-0 mb-2 text-3xl font-semibold tracking-tight">Assinatura WumPlus</h2>
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
        <div className="mx-auto flex max-w-6xl items-center gap-3 border-b border-border px-4 py-4 text-sm text-muted-foreground">
          <span className={`size-2.5 shrink-0 rounded-full ${health?.status === "online" ? "bg-ok" : health?.status === "offline" ? "bg-destructive" : "bg-muted-foreground"}`} />
          <span className="min-w-0 flex-1">
            <strong className="font-medium text-foreground">Status do Wumpus:</strong>{" "}
            {healthError
              ? "não foi possível consultar o monitor."
              : health?.status === "online"
                ? `online · ${health.guildCount ?? "—"} servidores · atualizado ${health.lastSeenAt ? formatRelative(health.lastSeenAt) : "agora"}`
                : health?.status === "offline"
                  ? `sem heartbeat recente${health.lastSeenAt ? ` · visto ${formatRelative(health.lastSeenAt)}` : ""}`
                  : "ainda não disponível."}
          </span>
          {health?.pingMs !== null && health?.pingMs !== undefined ? (
            <span className="hidden shrink-0 sm:inline">latência {health.pingMs} ms</span>
          ) : null}
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>
            {brand.name} · {brand.legal}
          </span>
          <nav aria-label="Documentos legais" className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
            <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
          </nav>
          <Link to="/entrar" className="text-foreground">
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
