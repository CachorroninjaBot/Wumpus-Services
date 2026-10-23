import type { PlanId } from "./catalog.ts";

export type PlanFeature = "forms" | "ai" | "multiDepartment" | "antiNuke" | "transcripts" | "ocr" | "webhooks";

const PLAN_RANK: Record<PlanId, number> = { essencial: 0, pro: 1, escala: 2, vitalicio: 2 };
const FEATURE_RANK: Record<PlanFeature, number> = {
  forms: 0,
  multiDepartment: 0,
  antiNuke: 0,
  ai: 1,
  transcripts: 1,
  ocr: 1,
  webhooks: 2,
};

export function planAllows(plan: PlanId, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= FEATURE_RANK[feature];
}

/** Créditos OCR mensais por assinatura; null representa uso sem teto. */
export function monthlyOcrLimit(plan: PlanId): number | null {
  if (plan === "pro") return 500;
  if (plan === "escala" || plan === "vitalicio") return null;
  return 0;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "essencial" || value === "pro" || value === "escala" || value === "vitalicio";
}
