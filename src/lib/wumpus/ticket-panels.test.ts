import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findTicketPanel,
  findTicketType,
  legacyTicketTypeId,
  normalizeTicketPanels,
  panelTicketTypes,
  ticketTypeList,
} from "./ticket-panels.ts";

const legacy = {
  panelChannelId: "canal-1",
  panelTitle: "Fale com a equipe",
  departmentDisplayMode: "buttons",
  departmentButtonStyle: 3,
  departmentSettings: [
    { id: "support", name: "Suporte", emoji: "🛟" },
    { id: "report", name: "Denúncia", emoji: "⚠️" },
  ],
};

test("config antiga vira um painel único com todos os tipos", () => {
  const panels = normalizeTicketPanels(legacy);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].id, "default");
  assert.equal(panels[0].channelId, "canal-1");
  assert.equal(panels[0].title, "Fale com a equipe");
  assert.equal(panels[0].displayMode, "buttons");
  assert.equal(panels[0].buttonDisplayStyle, 3);
  assert.deepEqual(panels[0].typeIds, ["support", "report"]);
});

test("paineis salvos têm prioridade e id ausente é descartado", () => {
  const panels = normalizeTicketPanels({
    ...legacy,
    ticketPanels: [
      { id: "loja", name: "Loja", channelId: "canal-loja", typeIds: ["support"] },
      { name: "Sem id", channelId: "x" },
    ],
  });
  assert.deepEqual(panels.map((panel) => panel.id), ["loja"]);
  assert.deepEqual(panels[0].typeIds, ["support"]);
  assert.equal(panels[0].buttonLabel, "Abrir atendimento");
});

test("painel salvo sem typeIds herda todos; lista vazia significa nenhum", () => {
  const all = normalizeTicketPanels({
    ...legacy,
    ticketPanels: [{ id: "a", name: "A", channelId: "c1" }],
  });
  assert.deepEqual(all[0].typeIds, ["support", "report"]);

  const none = normalizeTicketPanels({
    ...legacy,
    ticketPanels: [{ id: "a", name: "A", channelId: "c1", typeIds: [] }],
  });
  assert.deepEqual(none[0].typeIds, []);
  assert.deepEqual(panelTicketTypes(legacy, none[0]), []);
});

test("departments legados viram tipos mesmo sem departmentSettings", () => {
  const types = ticketTypeList({ departments: ["Compras", "Suporte"] });
  assert.deepEqual(types.map((type) => type.id), ["legacy-compras", "legacy-suporte"]);
  assert.equal(types[0].name, "Compras");
});

test("findTicketType aceita id, nome e id legado", () => {
  assert.equal(findTicketType(legacy, "support")?.name, "Suporte");
  assert.equal(findTicketType(legacy, " denúncia ")?.name, "Denúncia");
  assert.equal(findTicketType({ departments: ["Compras"] }, legacyTicketTypeId("Compras"))?.name, "Compras");
  assert.equal(findTicketType(legacy, "inexistente"), undefined);
});

test("panelTicketTypes respeita a ordem e ignora ids removidos", () => {
  const config = {
    departmentSettings: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ],
    ticketPanels: [{ id: "p", name: "P", channelId: "c", typeIds: ["c", "x", "a"] }],
  };
  const panel = findTicketPanel(config, "p");
  assert.ok(panel);
  assert.deepEqual(panelTicketTypes(config, panel).map((type) => type.id), ["c", "a"]);
});

test("findTicketPanel sem id devolve o primeiro", () => {
  const config = {
    ...legacy,
    ticketPanels: [
      { id: "one", name: "Um", channelId: "c1" },
      { id: "two", name: "Dois", channelId: "c2" },
    ],
  };
  assert.equal(findTicketPanel(config, undefined)?.id, "one");
  assert.equal(findTicketPanel(config, "two")?.channelId, "c2");
});
