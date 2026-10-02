/**
 * Matematica de SLA, fechamento automatico e transcript — tudo PURO.
 *
 * Separado de `tickets.ts` de proposito: nenhuma funcao aqui toca o Discord
 * ou o disco, entao os testes exercitam as regras sem subir nada. O bot antigo
 * tinha essa regra colada no handler (o `checkSla` "assumia" o ticket para nao
 * repetir o alerta — mentia no painel, roubava o ticket do atendente e
 * escondia o estouro para sempre); aqui a decisao e testavel e o efeito fica
 * no modulo que conhece o Discord.
 *
 * Estados de SLA, iguais ao que o painel mostra:
 *   - `warning`: passou da meta (`slaWarningMinutes`) sem primeira resposta.
 *   - `breach`: passou de 2x a meta.
 *   - `ok`: dentro da meta, ou ja respondido dentro da meta, ou fechado.
 */

/** Recorte estrutural do ticket — evita importar o modulo do Discord por um tipo. */
export type SlaTicket = {
  id: number;
  status: string;
  createdAt: string;
  firstResponseAt?: string | null;
  claimedBy?: string | null;
  lastActivityAt?: string | null;
};

export type SlaState = "ok" | "warning" | "breach";

/** Transcript anexado como .txt: este limite evita arquivo de megabytes. */
export const MAX_TRANSCRIPT_MESSAGES = 500;

/** Estado de SLA de um ticket agora. */
export function slaState(ticket: SlaTicket, slaMinutes: number, now = Date.now()): SlaState {
  if (ticket.status === "closed") return "ok";
  if (!Number.isFinite(slaMinutes) || slaMinutes <= 0) return "ok";

  const opened = Date.parse(ticket.createdAt);
  if (!Number.isFinite(opened)) return "ok";

  // Depois da primeira resposta o SLA mede a QUALIDADE da resposta, nao o
  // tempo corrido: uma resposta rapida nunca volta a estourar por idade.
  if (ticket.firstResponseAt) {
    const responded = Date.parse(ticket.firstResponseAt);
    if (Number.isFinite(responded)) {
      const responseMinutes = (responded - opened) / 60_000;
      if (responseMinutes > slaMinutes * 2) return "breach";
      if (responseMinutes > slaMinutes) return "warning";
      return "ok";
    }
  }

  const elapsed = (now - opened) / 60_000;
  if (elapsed > slaMinutes * 2) return "breach";
  if (elapsed > slaMinutes) return "warning";
  return "ok";
}

/**
 * O que o ciclo automatico faz com o ticket agora:
 *   - `"expired"`: passou de `maxHours` desde a abertura — vence sempre;
 *   - `"inactive"`: `inactiveHours` sem NENHUMA mensagem (autor ou staff);
 *   - `null`: nada a fazer.
 *
 * `lastActivityAt` ausente (ticket gravado antes do campo existir) cai para
 * `createdAt`: fechar um pouco tarde e preferivel a fechar ticket novo.
 */
export function autoCloseCandidate(
  ticket: SlaTicket,
  inactiveHours: number,
  maxHours: number,
  now = Date.now()
): "inactive" | "expired" | null {
  if (ticket.status === "closed") return null;

  const opened = Date.parse(ticket.createdAt);
  if (!Number.isFinite(opened)) return null;

  const last = Date.parse(ticket.lastActivityAt ?? ticket.createdAt);
  const idleSource = Number.isFinite(last) ? last : opened;

  if (maxHours > 0 && (now - opened) / 3_600_000 > maxHours) return "expired";
  if (inactiveHours > 0 && (now - idleSource) / 3_600_000 > inactiveHours) return "inactive";
  return null;
}

/** Texto do alerta — usado no canal de logs e no ping de estouro. */
export function slaNotice(ticket: SlaTicket, state: "warning" | "breach", slaMinutes: number): string {
  return state === "breach"
    ? `O atendimento **#${ticket.id}** passou de 2x a meta de SLA (${slaMinutes} min) sem resposta da equipe.`
    : `O atendimento **#${ticket.id}** passou da meta de SLA (${slaMinutes} min) sem resposta da equipe.`;
}

/** Linha do transcript — formato pt-BR, o mesmo do bot antigo. */
export function transcriptLine(at: string, authorName: string, content: string): string {
  return `[${new Date(at).toLocaleString("pt-BR")}] ${authorName}: ${content}`;
}

/**
 * Transcript completo em texto.
 *
 * Vai como ANEXO `.txt` no canal de transcricao: nao disputa o teto de
 * caracteres de mensagem e permite cabecalho de verdade (quem abriu, quem
 * assumiu, quem fechou). As mensagens sao as gravadas em `ticket_messages` —
 * anexos e embeds nao sao transcriptos, so texto.
 */
export function buildTranscript(input: {
  ticket: {
    id: number;
    createdAt: string;
    department?: string | null;
    claimedBy?: string | null;
    closedBy?: string | null;
    closedAt?: string | null;
  };
  guildName: string;
  messages: Array<{ authorName: string; content: string; at: string }>;
}): string {
  const { ticket, messages, guildName } = input;

  const header = [
    `Atendimento #${ticket.id} — ${guildName}`,
    `Aberto em: ${new Date(ticket.createdAt).toLocaleString("pt-BR")}`,
    ticket.department ? `Departamento: ${ticket.department}` : null,
    ticket.claimedBy ? `Assumido por: ${ticket.claimedBy}` : "Assumido por: ninguem",
    ticket.closedBy ? `Encerrado por: ${ticket.closedBy}` : null,
    ticket.closedAt ? `Encerrado em: ${new Date(ticket.closedAt).toLocaleString("pt-BR")}` : null,
    `Mensagens registradas: ${messages.length}`
  ]
    .filter(Boolean)
    .join("\n");

  if (!messages.length) return `${header}\n\n(sem mensagens registradas)`;

  // Mantem as ULTIMAS mensagens: o fim do atendimento e o que resolve o caso.
  const shown = messages.slice(-MAX_TRANSCRIPT_MESSAGES);
  const gap =
    messages.length > shown.length
      ? `(as ${messages.length - shown.length} mensagens mais antigas ficam de fora deste arquivo)\n`
      : "";

  const body = shown.map((message) => transcriptLine(message.at, message.authorName, message.content)).join("\n");
  return `${header}\n\n${gap}${body}`;
}
