import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TRANSCRIPT_MESSAGES, buildTranscript, buildTranscriptHtml, escapeHtml } from "./tickets-sla.ts";

const baseTicket = {
  id: 42,
  subject: "Pedido #99",
  createdAt: "2026-01-02T10:00:00.000Z",
  department: "Compras",
  openedBy: "Ana <script>",
  claimedBy: "Bia",
  closedBy: "Bia",
  closedAt: "2026-01-02T12:00:00.000Z",
};

test("escapa HTML de nomes e mensagens", () => {
  assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");

  const html = buildTranscriptHtml({
    ticket: baseTicket,
    guildName: "Servidor & Cia",
    messages: [
      { authorName: `<img src=x onerror=alert(1)>`, content: "<script>alert('xss')</script>", at: "2026-01-02T10:01:00.000Z" },
    ],
  });

  assert.match(html, /Servidor &amp; Cia/);
  assert.match(html, /Ana &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert/);
});

test("cabeçalho mostra quem abriu, assumiu e encerrou", () => {
  const html = buildTranscriptHtml({
    ticket: baseTicket,
    guildName: "Servidor",
    messages: [{ authorName: "Ana", content: "oi", at: "2026-01-02T10:01:00.000Z" }],
  });

  assert.match(html, /Aberto por<\/span><strong>Ana/);
  assert.match(html, /Assumido por<\/span><strong>Bia/);
  assert.match(html, /Encerrado por<\/span><strong>Bia/);
  assert.match(html, /Pedido #99/);
});

test("mantém apenas as últimas mensagens e avisa sobre o corte", () => {
  const messages = Array.from({ length: MAX_TRANSCRIPT_MESSAGES + 5 }, (_, index) => ({
    authorName: "Ana",
    content: `mensagem ${index + 1}`,
    at: "2026-01-02T10:01:00.000Z",
  }));

  const html = buildTranscriptHtml({ ticket: baseTicket, guildName: "Servidor", messages });

  assert.doesNotMatch(html, /mensagem 1</);
  assert.match(html, new RegExp(`mensagem ${MAX_TRANSCRIPT_MESSAGES + 5}<`));
  assert.match(html, /5 mensagens mais antigas ficam de fora/);
});

test("transcrição em texto também identifica quem abriu", () => {
  const text = buildTranscript({
    ticket: baseTicket,
    guildName: "Servidor",
    messages: [{ authorName: "Ana", content: "oi", at: "2026-01-02T10:01:00.000Z" }],
  });

  assert.match(text, /Aberto por: Ana <script>/);
  assert.match(text, /Assumido por: Bia/);
  assert.match(text, /Encerrado por: Bia/);
});
