/**
 * Testes de SLA, fechamento automatico, transcricao e metricas por atendente.
 *
 * O defeito que isto cobre e o mais caro do atendimento: o `checkSla` antigo
 * MUDAVA o ticket para nao repetir o alerta (fingia claim), entao o alerta era
 * raro demais para testar de rede e caro demais para errar. Aqui a decisao e
 * pura e roda sem Discord: o que entra e um ticket de mentira, o que sai e
 * warning/breach/candidato/relatorio.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoCloseCandidate,
  buildTranscript,
  MAX_TRANSCRIPT_MESSAGES,
  slaNotice,
  slaState,
  transcriptLine,
  type SlaTicket
} from "./tickets-sla.ts";
import { aggregateStaffReport, reportLines, type StaffTicketInput } from "./tickets-metrics.ts";

/** Ponto fixo no tempo: nenhum teste depende de `Date.now()`. */
const T0 = 1_800_000_000_000;

const iso = (ms: number): string => new Date(ms).toISOString();

function slaTicket(over: Partial<SlaTicket> = {}): SlaTicket {
  return {
    id: 1,
    status: "open",
    createdAt: iso(T0),
    firstResponseAt: null,
    claimedBy: null,
    lastActivityAt: null,
    ...over
  };
}

/* ------------------------------------------------------------------ SLA --- */

test("ticket fechado nunca esta fora do SLA", () => {
  const row = slaTicket({ status: "closed", createdAt: iso(T0 - 10 * 86_400_000) });
  assert.equal(slaState(row, 60), "ok");
});

test("SLA zerado significa desligado", () => {
  assert.equal(slaState(slaTicket(), 0, T0 + 90 * 60_000), "ok");
});

test("dentro da meta e ok", () => {
  assert.equal(slaState(slaTicket(), 60, T0 + 30 * 60_000), "ok");
});

test("acima da meta sem resposta e warning", () => {
  assert.equal(slaState(slaTicket(), 60, T0 + 90 * 60_000), "warning");
});

test("acima de 2x a meta e breach", () => {
  assert.equal(slaState(slaTicket(), 60, T0 + 130 * 60_000), "breach");
});

test("claim sem resposta nenhuma continua contando no SLA", () => {
  const row = slaTicket({ claimedBy: "s1" });
  assert.equal(slaState(row, 60, T0 + 130 * 60_000), "breach");
});

test("resposta rapida mantem ok mesmo com ticket velho", () => {
  const row = slaTicket({ firstResponseAt: iso(T0 + 10 * 60_000) });
  assert.equal(slaState(row, 60, T0 + 10 * 86_400_000), "ok");
});

test("resposta lenta fica marcada no historico do SLA", () => {
  assert.equal(slaState(slaTicket({ firstResponseAt: iso(T0 + 90 * 60_000) }), 60, T0 + 130 * 60_000), "warning");
  assert.equal(slaState(slaTicket({ firstResponseAt: iso(T0 + 130 * 60_000) }), 60, T0 + 200 * 60_000), "breach");
});

test("abertura ilegivel nao explode — vale ok, nunca alerta falso", () => {
  assert.equal(slaState(slaTicket({ createdAt: "not-a-date" }), 60, T0), "ok");
});

test("primeira resposta ilegivel cai no tempo corrido", () => {
  assert.equal(slaState(slaTicket({ firstResponseAt: "junk" }), 60, T0 + 130 * 60_000), "breach");
});

/* --------------------------------------------------- fechamento automatico --- */

test("ticket fechado nunca e candidato a fechamento automatico", () => {
  const row = slaTicket({ status: "closed", createdAt: iso(T0 - 100 * 3_600_000) });
  assert.equal(autoCloseCandidate(row, 6, 24, T0), null);
});

test("zero e zero desligam o automatico", () => {
  const row = slaTicket({ createdAt: iso(T0 - 500 * 3_600_000) });
  assert.equal(autoCloseCandidate(row, 0, 0, T0), null);
});

test("vencimento total vence inatividade", () => {
  const row = slaTicket({
    createdAt: iso(T0 - 30 * 3_600_000),
    lastActivityAt: iso(T0 - 5 * 60_000)
  });
  assert.equal(autoCloseCandidate(row, 6, 24, T0), "expired");
});

test("inatividade usa a ultima mensagem de qualquer um (autor ou staff)", () => {
  const conversando = slaTicket({
    createdAt: iso(T0 - 20 * 3_600_000),
    lastActivityAt: iso(T0 - 30 * 60_000)
  });
  assert.equal(autoCloseCandidate(conversando, 6, 0, T0), null);

  const ocioso = slaTicket({
    createdAt: iso(T0 - 20 * 3_600_000),
    lastActivityAt: iso(T0 - 7 * 3_600_000)
  });
  assert.equal(autoCloseCandidate(ocioso, 6, 0, T0), "inactive");
});

test("ticket antigo sem lastActivityAt cai para a abertura", () => {
  const row = slaTicket({ createdAt: iso(T0 - 30 * 3_600_000) });
  assert.equal(autoCloseCandidate(row, 6, 0, T0), "inactive");
});

/* ------------------------------------------------- texto de aviso e transcript --- */

test("aviso de breach fala em 2x a meta; warning fala na meta", () => {
  assert.match(slaNotice(slaTicket({ id: 7 }), "breach", 30), /2x a meta de SLA \(30 min\)/);
  assert.match(slaNotice(slaTicket({ id: 7 }), "warning", 60), /meta de SLA \(60 min\)/);
});

test("linha do transcript tem data, autor e conteudo", () => {
  const line = transcriptLine(iso(T0), "Ana", "ola, preciso de ajuda");
  assert.match(line, /Ana: ola, preciso de ajuda/);
  assert.match(line, /^\[/);
});

test("cabecalho do transcript traz quem abriu, assumiu e encerrou", () => {
  const out = buildTranscript({
    ticket: {
      id: 7,
      createdAt: iso(T0),
      department: "Compras",
      claimedBy: "Ana",
      closedBy: "Beto",
      closedAt: iso(T0 + 3_600_000)
    },
    guildName: "Aurora",
    messages: [
      { authorName: "Joao", content: "ola", at: iso(T0 + 60_000) },
      { authorName: "Ana", content: "oi, como posso ajudar?", at: iso(T0 + 120_000) }
    ]
  });

  assert.match(out, /Atendimento #7 — Aurora/);
  assert.match(out, /Departamento: Compras/);
  assert.match(out, /Assumido por: Ana/);
  assert.match(out, /Encerrado por: Beto/);
  assert.match(out, /Mensagens registradas: 2/);
  assert.match(out, /Joao: ola/);
});

test("transcript sem mensagens deixa a lacuna explicita", () => {
  const out = buildTranscript({
    ticket: { id: 8, createdAt: iso(T0), closedAt: iso(T0) },
    guildName: "Aurora",
    messages: []
  });
  assert.match(out, /\(sem mensagens registradas\)/);
});

test("transcript muito longo corta o COMECO e avisa a lacuna", () => {
  const messages = Array.from({ length: MAX_TRANSCRIPT_MESSAGES + 10 }, (_, index) => ({
    authorName: `membro${index}`,
    content: `m${index + 1}`,
    at: iso(T0 + index * 60_000)
  }));

  const out = buildTranscript({
    ticket: { id: 9, createdAt: iso(T0) },
    guildName: "Aurora",
    messages
  });

  assert.match(out, /as 10 mensagens mais antigas ficam de fora/);
  assert.equal(out.includes("membro0: m1"), false, "o comeco sai, o fim fica");
  assert.equal(out.includes("membro509: m510"), true);
});

/* ------------------------------------------------- metricas por atendente --- */

function ticket(over: Partial<StaffTicketInput> = {}): StaffTicketInput {
  return {
    id: "t1",
    guildId: "g1",
    number: 1,
    openerId: "u1",
    claimedBy: null,
    department: "Suporte",
    status: "open",
    createdAt: iso(T0),
    claimedAt: null,
    closedAt: null,
    firstResponseAt: null,
    feedback: null,
    ...over
  };
}

test("ticket sem atendente nao gera linha nenhuma", () => {
  assert.deepEqual(aggregateStaffReport([ticket({ claimedBy: null })], 30), []);
});

test("agrupa por atendente e separa abertos de encerrados", () => {
  const rows = aggregateStaffReport(
    [
      ticket({ claimedBy: "s1", status: "claimed" }),
      ticket({ claimedBy: "s1", status: "closed", number: 2 }),
      ticket({ claimedBy: "s2", status: "open" })
    ],
    30
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.staffId, "s1");
  assert.equal(rows[0]!.claimed, 2);
  assert.equal(rows[0]!.open, 1);
  assert.equal(rows[0]!.closed, 1);
  assert.equal(rows[1]!.staffId, "s2");
  assert.equal(rows[1]!.open, 1);
});

test("1a resposta e a media entre abrir e responder", () => {
  const rows = aggregateStaffReport(
    [
      ticket({
        claimedBy: "s1",
        createdAt: iso(T0),
        firstResponseAt: iso(T0 + 10 * 60_000),
        claimedAt: iso(T0 + 5 * 60_000),
        closedAt: iso(T0 + 60 * 60_000),
        status: "closed"
      }),
      ticket({
        claimedBy: "s1",
        number: 2,
        createdAt: iso(T0),
        firstResponseAt: iso(T0 + 20 * 60_000),
        claimedAt: iso(T0 + 5 * 60_000),
        closedAt: iso(T0 + 90 * 60_000),
        status: "closed"
      })
    ],
    30
  );

  assert.equal(rows[0]!.averageFirstResponseMinutes, 15);
  assert.equal(rows[0]!.averageResolveMinutes, 70);
});

test("resposta anterior a abertura nao entra na media", () => {
  const rows = aggregateStaffReport(
    [ticket({ claimedBy: "s1", createdAt: iso(T0), firstResponseAt: iso(T0 - 60_000) })],
    30
  );
  assert.equal(rows[0]!.averageFirstResponseMinutes, null);
});

test("resolucao e medida de assumir ate encerrar", () => {
  const rows = aggregateStaffReport(
    [
      ticket({
        claimedBy: "s1",
        createdAt: iso(T0),
        claimedAt: iso(T0 + 30 * 60_000),
        closedAt: iso(T0 + 75 * 60_000),
        status: "closed"
      }),
      ticket({
        claimedBy: "s1",
        number: 2,
        createdAt: iso(T0),
        claimedAt: iso(T0 + 30 * 60_000),
        closedAt: iso(T0 + 105 * 60_000),
        status: "closed"
      })
    ],
    30
  );
  // (45 + 75) / 2 = 60 — resolucao conta de ASSUMIR ate encerrar.
  assert.equal(rows[0]!.averageResolveMinutes, 60);
});

test("CSAT e a media das notas dos tickets com feedback", () => {
  const rows = aggregateStaffReport(
    [
      ticket({
        claimedBy: "s1",
        feedback: { rating: 4, comment: "ok" },
        status: "closed",
        createdAt: iso(T0),
        closedAt: iso(T0 + 60_000)
      }),
      ticket({
        claimedBy: "s1",
        number: 2,
        feedback: { rating: 5, comment: "" },
        status: "closed",
        createdAt: iso(T0),
        closedAt: iso(T0 + 120_000)
      })
    ],
    30
  );
  assert.equal(rows[0]!.csat, 4.5);
});

test("ticket fora da janela sai da conta", () => {
  const old = iso(Date.now() - 31 * 86_400_000);
  const rows = aggregateStaffReport([ticket({ claimedBy: "s1", createdAt: old })], 30);
  assert.deepEqual(rows, []);
});

test("linhas do relatorio trazem mencao, meta e marcacao", () => {
  const lines = reportLines(
    [
      {
        staffId: "s1",
        claimed: 3,
        open: 1,
        closed: 2,
        averageFirstResponseMinutes: 30,
        averageResolveMinutes: null,
        csat: 4.5
      },
      {
        staffId: "s2",
        claimed: 1,
        open: 1,
        closed: 0,
        averageFirstResponseMinutes: 45,
        averageResolveMinutes: null,
        csat: null
      }
    ],
    30
  );

  assert.match(lines[0]!, /<@s1>/);
  assert.match(lines[0]!, /assumidos: 3/);
  assert.match(lines[0]!, /1a resposta: 30 min \(meta 30\)/);
  assert.match(lines[0]!, /✅/);
  assert.match(lines[0]!, /CSAT: 4\.5/);

  assert.match(lines[1]!, /⚠️/);
  assert.equal(lines[1]!.includes("CSAT"), false, "sem feedback, sem numero inventado");
});
