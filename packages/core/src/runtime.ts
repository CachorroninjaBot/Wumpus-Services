import { z } from "zod";

export const serviceNameSchema = z.enum(["huborder-bot", "wumpus", "express-tester"]);
export type ServiceName = z.infer<typeof serviceNameSchema>;

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function numericEnv(name: string, fallback: number): number {
  const value = optionalEnv(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }
  return parsed;
}

export function createLogger(service: string) {
  const write = (level: "info" | "warn" | "error", message: string, context: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, service, message, ...context }));
  };

  return {
    info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
  };
}

export async function sendHeartbeat(input: {
  apiUrl: string;
  serviceKey: string;
  service: ServiceName;
  status: "operational" | "degraded";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch(`${input.apiUrl.replace(/\/$/, "")}/v1/internal/services/${input.service}/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-huborder-service-key": input.serviceKey
    },
    body: JSON.stringify({ status: input.status, metadata: input.metadata ?? {} }),
    signal: AbortSignal.timeout(5_000)
  });

  if (!response.ok) {
    throw new Error(`Heartbeat failed with HTTP ${response.status}.`);
  }
}
