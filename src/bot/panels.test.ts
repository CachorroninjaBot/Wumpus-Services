/**
 * Testes dos payloads de Components V2.
 *
 * Uma mensagem com o flag V2 NAO pode ter `content` nem `embeds`: misturar os
 * dois formatos e erro 400 no Discord. O payload precisa ter o flag e o
 * container, e o container precisa carregar o conteudo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLogPayload, buildPanelPayload, hexToInt, IS_COMPONENTS_V2 } from "./panels.ts";

test("hexToInt converte cor do painel", () => {
  assert.equal(hexToInt("#7c5cff"), 0x7c5cff);
});

test("hexToInt cai no padrao quando o valor e invalido", () => {
  assert.equal(hexToInt("nada"), 0x7c5cff);
  assert.equal(hexToInt(""), 0x7c5cff);
});

test("log sai com o flag de Components V2", () => {
  const payload = buildLogPayload({ title: "PUNICAO", description: "alguem foi banido" });
  assert.equal(payload.flags, IS_COMPONENTS_V2);
  assert.equal(payload.components.length, 1);
});

test("log nao mistura content nem embeds", () => {
  const payload = buildLogPayload({ title: "T", description: "D" }) as Record<string, unknown>;
  assert.equal(payload.content, undefined);
  assert.equal(payload.embeds, undefined);
});

test("campos vazios do log sao descartados", () => {
  const semCampos = buildLogPayload({ title: "T", description: "D", fields: [] });
  const comVazio = buildLogPayload({
    title: "T",
    description: "D",
    fields: [{ name: "Motivo", value: "   " }],
  });
  assert.equal(semCampos.components[0].components.length, comVazio.components[0].components.length);
});

test("painel sem botoes continua valido", () => {
  const payload = buildPanelPayload({ title: "Aviso", description: "Sem acao aqui." });
  assert.equal(payload.flags, IS_COMPONENTS_V2);
  assert.equal(payload.components.length, 1);
});

test("painel com botoes inclui uma action row", () => {
  const payload = buildPanelPayload({
    title: "Atendimento",
    description: "Abra um ticket",
    buttons: [{ label: "Abrir", customId: "wumpus:v1:ticket:open", style: 1 }],
  });
  const children = payload.components[0].components as Array<{ type: number }>;
  assert.ok(children.some((child) => child.type === 1), "esperava uma action row");
});

test("painel limita a 5 botoes por action row", () => {
  const buttons = Array.from({ length: 8 }, (_, index) => ({
    label: `b${index}`,
    customId: `wumpus:v1:x:y:${index}`,
  }));
  const payload = buildPanelPayload({ title: "T", description: "D", buttons });
  const row = (payload.components[0].components as Array<{ type: number; components: unknown[] }>).find(
    (child) => child.type === 1
  );
  assert.equal(row?.components.length, 5);
});

/* ------------------------------------------------- cabecalho e orcamento --- */

/** Soma o texto de todos os text displays — o Discord soma e recusa acima de 4000. */
function textTotal(payload: { components: Array<{ components: unknown[] }> }): number {
  return (payload.components[0].components as Array<{ type: number; content?: string }>)
    .filter((child) => child.type === 10)
    .reduce((sum, child) => sum + (child.content?.length ?? 0), 0);
}

test("painel nunca mistura content nem embeds", () => {
  // Guarda contra o defeito que impedia a candidatura de ser publicada.
  const payload = buildPanelPayload({
    header: "Candidatura de <@1> · **#7**",
    title: "Candidatura",
    description: "Pergunta e resposta",
  }) as Record<string, unknown>;

  assert.equal(payload.content, undefined);
  assert.equal(payload.embeds, undefined);
  assert.equal(payload.flags, IS_COMPONENTS_V2);
});

test("cabecalho entra dentro do container, antes do titulo", () => {
  const payload = buildPanelPayload({
    header: "Candidatura de <@1> · **#7**",
    title: "Candidatura",
    description: "corpo",
  });

  const children = payload.components[0].components as Array<{ type: number; content?: string }>;
  assert.equal(children[0]?.type, 10);
  assert.match(children[0]?.content ?? "", /#7/);
  assert.match(children[1]?.content ?? "", /## Candidatura/);
});

test("cabecalho vazio nao cria bloco", () => {
  const comVazio = buildPanelPayload({ header: "   ", title: "T", description: "D" });
  const semNada = buildPanelPayload({ title: "T", description: "D" });
  assert.equal(comVazio.components[0].components.length, semNada.components[0].components.length);
});

test("soma do texto cabe no teto de 4000 mesmo com tudo gigante", () => {
  const payload = buildPanelPayload({
    header: "h".repeat(5000),
    title: "t".repeat(5000),
    description: "d".repeat(5000),
    footer: "f".repeat(5000),
    buttons: [{ label: "ok", customId: "wumpus:v1:x:y" }],
  });

  assert.ok(textTotal(payload) <= 4000, `soma ficou em ${textTotal(payload)} caracteres`);
});

test("cabecalho longo e cortado sem apagar o corpo", () => {
  const payload = buildPanelPayload({
    header: "h".repeat(5000),
    title: "Titulo",
    description: "corpo importante",
  });

  const children = payload.components[0].components as Array<{ type: number; content?: string }>;
  const body = children.find((child) => (child.content ?? "").includes("## Titulo"));
  assert.ok(body, "o corpo precisa sobreviver ao corte do cabecalho");
  assert.match(body?.content ?? "", /corpo importante/);
});
