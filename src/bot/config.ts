/**
 * Configuracao do bot — leitura do runtime que o painel publica.
 *
 * O painel grava `data/wumpus-runtime.json`. Aqui apenas lemos, com cache
 * curto: o bot recebe muitas mensagens e nao pode tocar o disco em cada uma
 * (o bot antigo fazia isso e relia o arquivo inteiro a cada mensagem).
 *
 * A fonte da verdade e o que o painel grava. Os acessores abaixo devolvem um
 * fallback apenas quando a chave realmente nao veio — assim uma configuracao
 * publicada sempre vence o palpite do codigo.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ModuleConfig = Record<string, unknown>;
export type GuildConfig = Record<string, ModuleConfig | string | undefined>;
export type Runtime = { updatedAt: number; guilds: Record<string, GuildConfig> };

/** Curto o bastante para a mudanca no painel aparecer rapido, longo o bastante para nao ler disco sempre. */
const TTL_MS = 5_000;

const EMPTY: Runtime = { updatedAt: 0, guilds: {} };

let cache: { runtime: Runtime; at: number } | null = null;

function runtimePath(): string {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

/**
 * Le o runtime. `force` ignora o cache — usado quando o painel avisa que
 * acabou de publicar, para o efeito ser imediato e nao esperar o TTL.
 */
export async function loadRuntime(force = false): Promise<Runtime> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.runtime;

  try {
    const parsed = JSON.parse(await readFile(runtimePath(), "utf8")) as Partial<Runtime>;
    const runtime: Runtime = {
      updatedAt: Number(parsed?.updatedAt) || 0,
      guilds: parsed?.guilds && typeof parsed.guilds === "object" ? parsed.guilds : {}
    };
    cache = { runtime, at: Date.now() };
    return runtime;
  } catch {
    // Arquivo ausente ou invalido nao pode derrubar o bot: vale como "nada publicado".
    cache = { runtime: EMPTY, at: Date.now() };
    return EMPTY;
  }
}

/** Config de um modulo num servidor. `null` quando o painel ainda nao publicou esse modulo. */
export async function moduleConfig(guildId: string, module: string): Promise<ModuleConfig | null> {
  const runtime = await loadRuntime();
  const saved = runtime.guilds?.[guildId]?.[module];
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  return saved as ModuleConfig;
}

/** `true` quando o painel ja publicou alguma coisa para esse servidor. */
export async function hasPublishedConfig(guildId: string): Promise<boolean> {
  const runtime = await loadRuntime();
  const guild = runtime.guilds?.[guildId];
  return Boolean(guild && Object.keys(guild).length > 0);
}

export function str(config: ModuleConfig | null, key: string, fallback = ""): string {
  const value = config?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function num(config: ModuleConfig | null, key: string, fallback: number): number {
  const value = Number(config?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function bool(config: ModuleConfig | null, key: string, fallback: boolean): boolean {
  const value = config?.[key];
  return typeof value === "boolean" ? value : fallback;
}

/**
 * O modulo esta ligado?
 *
 * O painel publica `enabled` junto com os campos. Sem checar isto, desligar um
 * modulo na dashboard nao o parava no bot — a interface mentia.
 * Config ausente significa "nunca configurado", que tambem e "nao rodar".
 */
export function isEnabled(config: ModuleConfig | null): boolean {
  if (!config) return false;
  return bool(config, "enabled", true);
}

export function list(config: ModuleConfig | null, key: string): string[] {
  const value = config?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}
