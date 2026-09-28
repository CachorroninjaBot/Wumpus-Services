import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Shield, Ticket, ClipboardList, Cpu } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { DiscordPanel } from "@/components/discord-panel";
import { Button } from "@/components/ui/button";
import { brand, plans as fallbackPlans } from "@/lib/wumpus/brand";
import { SHARD_STORE } from "@/lib/wumpus/catalog";
import { useBilling } from "@/lib/wumpus/use-billing";

export const Route = createFileRoute("/")({ component: Home });

const faqs = [
  {
    q: "O bot realmente lê o que eu configuro?",
    a: "Sim. Cada campo do painel entra no contrato do bot: SLA, cargos, termos bloqueados, perguntas do modal. Se não for usado, não aparece.",
  },
  {
    q: "A IA fala com o cliente?",
    a: "Não. A IA só sugere para a equipe — análise de ticket e pré-review de candidatura. Nada é enviado sozinho no canal.",
  },
  {
    q: "Preciso decorar comandos?",
    a: "Não. Painéis no Discord abrem ticket e formulário. A equipe trabalha daqui: assumir, encerrar, advertir, aprovar.",
  },
  {
    q: "Como eu entro no MEU painel?",
    a: "Botão Entrar com Discord. OAuth com identify + guilds. Só servidores que tu administra aparecem.",
  },
];

function Home() {
  const billing = useBilling();
  const plans = billing.data?.plans?.length ? billing.data.plans : fallbackPlans;
  const discounts = billing.data?.discounts ?? [
    { label: "trimestral", discount: 5 },
    { label: "semestral", discount: 10 },
    { label: "anual", discount: 18 },
  ];
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature icon={<Ticket className="size-5" />} title="Tickets de verdade" body="Departamentos, SLA, prioridade, tags, transcrição no encerramento, feedback com comentário e métrica por staff." />
            <Feature icon={<ClipboardList className="size-5" />} title="Candidaturas com modal" body="Perguntas configuráveis, cooldown, idade mínima da conta, aprovar ou recusar com motivo." />
            <Feature icon={<Shield className="size-5" />} title="Moderação com entrada" body="Advertir, silenciar, expulsar, banir. Strikes acumulam e o bot escala no limiar que você definiu." />
            <Feature icon={<Cpu className="size-5" />} title="Presets, não 40 knobs" body="Comunidade, loja ou RP. Um pacote coerente de AutoMod e anti-raid." />
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

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl bg-card p-5 shadow-border">
      <div className="grid size-10 place-items-center rounded-xl bg-muted text-foreground">{icon}</div>
      <h3 className="mt-4 mb-1 text-lg font-semibold">{title}</h3>
      <p className="m-0 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}
