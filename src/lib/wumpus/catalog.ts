export type PlanId = "gratuito" | "pro" | "vitalicio";

export const SHARD_STORE = {
  id: "01a09384-95b0-707d-8fc7-d82191e14827",
  name: "Hub Express",
  slug: "hubexpress",
  url: "https://shardpay.app/pt-br/store/hubexpress",
} as const;

export type CatalogPlan = {
  id: PlanId;
  productId: string | null;
  name: string;
  priceCents: number;
  recurring: boolean;
  price: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
  checkoutUrl: string | null;
};

function brl(cents: number, recurring: boolean) {
  const value = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return recurring ? `${value}/mês` : value;
}

export function checkoutUrl(productId: string) {
  return `https://shardpay.app/pt-br/checkout/${productId}`;
}

export const plans: CatalogPlan[] = [
  {
    id: "gratuito",
    productId: null,
    name: "Wumpus Gratuito",
    priceCents: 0,
    recurring: false,
    price: "Grátis",
    blurb: "Para começar: um servidor com tickets, moderação e proteção essencial.",
    features: [
      "1 servidor",
      "Tickets e formulários",
      "Moderação e logs",
      "AutoMod e anti-raid",
      "Estatísticas de atendimento",
    ],
    checkoutUrl: null,
  },
  {
    id: "pro",
    productId: "01a09c5a-d344-78fa-9ead-77fbd322c4f5",
    name: "WumPlus Pro",
    priceCents: 2990,
    recurring: true,
    price: brl(2990, true),
    blurb: "O plano completo: servidores, IA e OCR sem teto.",
    features: [
      "Servidores ilimitados",
      "Todos os módulos de atendimento",
      "IA (knowledge, OCR e cargos) ilimitada",
      "Transcrições e webhooks",
      "Anti-nuke e multidepartamentos",
      "Suporte prioritário",
    ],
    highlight: true,
    checkoutUrl: checkoutUrl("01a09c5a-d344-78fa-9ead-77fbd322c4f5"),
  },
  {
    id: "vitalicio",
    productId: "01a09c61-e028-7e49-974c-8b225ab3057b",
    name: "WumPlus Vitalício",
    priceCents: 34990,
    recurring: false,
    price: brl(34990, false),
    blurb: "Pague uma vez e use todos os recursos do Pro para sempre.",
    features: [
      "Pagamento único",
      "Servidores ilimitados",
      "Todos os recursos do Pro",
      "IA, OCR e webhooks ilimitados",
      "Sem mensalidade ou renovação",
    ],
    checkoutUrl: checkoutUrl("01a09c61-e028-7e49-974c-8b225ab3057b"),
  },
];

export const CYCLE_DISCOUNTS = [
  { id: "quarterly", label: "trimestral", discount: 5 },
  { id: "semiannually", label: "semestral", discount: 10 },
  { id: "yearly", label: "anual", discount: 20 },
] as const;

const LEGACY: Record<string, PlanId> = {
  comunidade: "gratuito",
  essencial: "gratuito",
  loja: "pro",
  escala: "pro",
  rede: "pro",
};

export function normalizePlan(value: string | undefined | null): PlanId {
  if (!value) return "gratuito";
  if (value in LEGACY) return LEGACY[value]!;
  if (value === "gratuito" || value === "pro" || value === "vitalicio") return value;
  return planIdFromName(value) ?? "gratuito";
}

/** Produtos vendidos na ShardPay; nomes antigos deixam de ser reconhecidos. */
export function planIdFromName(name: string): PlanId | null {
  const n = name.toLowerCase();
  if (n.includes("vital")) return "vitalicio";
  if (n.includes("gratuit") || n.includes("free")) return "gratuito";
  if (n.includes("pro")) return "pro";
  return null;
}

/** Produto exato da ShardPay — imune a renomeações do catálogo. */
export function planIdFromProductId(productId: string | null | undefined): PlanId | null {
  if (!productId) return null;
  return plans.find((plan) => plan.productId === productId)?.id ?? null;
}

export function planById(id: PlanId): CatalogPlan {
  return plans.find((p) => p.id === id) ?? plans[0]!;
}

export function serverLimit(plan: PlanId): number | null {
  return plan === "gratuito" ? 1 : null;
}

export function isPaidPlan(plan: PlanId | null | undefined): boolean {
  return plan === "pro" || plan === "vitalicio";
}
