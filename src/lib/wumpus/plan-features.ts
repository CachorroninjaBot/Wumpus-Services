import type { PlanId } from "./catalog.ts";

export type PlanFeature = "forms" | "ai" | "multiDepartment" | "antiNuke" | "transcripts" | "ocr" | "webhooks";

const PLAN_RANK: Record<PlanId, number> = { gratuito: 0, pro: 1, vitalicio: 1 };
const FEATURE_RANK: Record<PlanFeature, number> = {
  forms: 0,
  multiDepartment: 1,
  antiNuke: 1,
  ai: 1,
  transcripts: 1,
  ocr: 1,
  webhooks: 1,
};

export function planAllows(plan: PlanId, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= FEATURE_RANK[feature];
}

/** Créditos OCR mensais por assinatura; null representa uso sem teto. */
export function monthlyOcrLimit(plan: PlanId): number | null {
  return plan === "gratuito" ? 0 : null;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "gratuito" || value === "pro" || value === "vitalicio";
}
