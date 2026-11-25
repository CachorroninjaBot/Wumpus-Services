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
    openedBy?: string | null;
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
    ticket.openedBy ? `Aberto por: ${ticket.openedBy}` : null,
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

/** Escapa conteúdo de membros: transcrição é HTML e nunca deve executar nada dela. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Transcrição em HTML, anexada `.html` no canal de transcripts.
 *
 * O `.txt` era legível, mas evidências (prints, links) e a separação entre quem
 * abriu/atendeu/encerrou ficavam perdidas. O HTML mantém o mesmo conteúdo com
 * um cabeçalho de verdade, e continua sendo um arquivo local — nada é enviado
 * para um serviço externo.
 */
export function buildTranscriptHtml(input: {
  ticket: {
    id: number;
    subject?: string | null;
    createdAt: string;
    department?: string | null;
    openedBy?: string | null;
    claimedBy?: string | null;
    closedBy?: string | null;
    closedAt?: string | null;
  };
  guildName: string;
  messages: Array<{ authorName: string; content: string; at: string }>;
  generatedAt?: Date;
}): string {
  const { ticket, messages, guildName } = input;
  const shown = messages.slice(-MAX_TRANSCRIPT_MESSAGES);
  const date = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("pt-BR") : escapeHtml(value);
  };

  const meta = [
    ["Aberto em", date(ticket.createdAt)],
    ["Aberto por", ticket.openedBy],
    ["Departamento", ticket.department],
    ["Assumido por", ticket.claimedBy ?? "ninguém"],
    ["Encerrado por", ticket.closedBy],
    ["Encerrado em", date(ticket.closedAt)],
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="meta"><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`,
    )
    .join("");

  const header = messages.length
    ? ""
    : `<p class="empty">Sem mensagens registradas neste atendimento.</p>`;
  const gap =
    messages.length > shown.length
      ? `<p class="empty">As ${messages.length - shown.length} mensagens mais antigas ficam de fora deste arquivo.</p>`
      : "";

  const body = shown
    .map((message, index) => {
      const initial = escapeHtml(message.authorName.trim().slice(0, 1).toLocaleUpperCase("pt-BR") || "?");
      return `<article class="message">
  <div class="avatar" aria-hidden="true">${initial}</div>
  <div class="bubble">
    <header><strong>${escapeHtml(message.authorName)}</strong><time>${escapeHtml(date(message.at) ?? message.at)}</time></header>
    <div class="content">${escapeHtml(message.content)}</div>
    <span class="index">#${index + 1}</span>
  </div>
</article>`;
    })
    .join("\n");

  const generated = (input.generatedAt ?? new Date()).toLocaleString("pt-BR");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atendimento #${ticket.id} — ${escapeHtml(guildName)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #1e1f22; color: #dbdee1; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 20px 56px; }
  .card { background: #2b2d31; border: 1px solid #3f4147; border-radius: 14px; padding: 22px; }
  h1 { margin: 0; font-size: 22px; color: #f2f3f5; }
  .subtitle { margin: 4px 0 0; color: #949ba4; font-size: 14px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; border-top: 1px solid #3f4147; font-size: 13px; }
  .meta span { color: #949ba4; }
  .meta strong { color: #f2f3f5; font-weight: 500; text-align: right; }
  .meta:first-of-type { margin-top: 18px; }
  .messages { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
  .message { display: flex; gap: 10px; align-items: flex-start; }
  .avatar { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 50%; display: grid; place-items: center; background: #5865f2; color: #fff; font-weight: 700; }
  .bubble { flex: 1; min-width: 0; background: #313338; border: 1px solid #3f4147; border-radius: 10px; padding: 10px 12px; }
  .bubble header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
  .bubble strong { color: #f2f3f5; font-size: 14px; }
  .bubble time { color: #949ba4; font-size: 12px; }
  .content { margin-top: 4px; color: #dbdee1; white-space: pre-wrap; overflow-wrap: anywhere; }
  .index { display: block; margin-top: 6px; color: #6d6f78; font-size: 11px; text-align: right; }
  .empty { color: #949ba4; font-size: 14px; }
  footer { margin-top: 18px; color: #6d6f78; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<main>
  <section class="card">
    <h1>Atendimento #${ticket.id}${ticket.subject ? ` · ${escapeHtml(ticket.subject)}` : ""}</h1>
    <p class="subtitle">${escapeHtml(guildName)} · ${messages.length} mensagem(ns)</p>
    ${meta}
    ${header}${gap}
    <div class="messages">${body}</div>
  </section>
  <footer>Transcrição gerada pelo Wumpus em ${escapeHtml(generated)}</footer>
</main>
</body>
</html>`;
}
