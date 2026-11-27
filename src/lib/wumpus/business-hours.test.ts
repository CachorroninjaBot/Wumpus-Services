import assert from "node:assert/strict";
import { test } from "node:test";
import {
  businessHoursFrom,
  businessHoursLabel,
  isWithinBusinessHours,
} from "./business-hours.ts";

const monday10am = new Date("2026-11-23T10:00:00Z"); // segunda
const saturday10am = new Date("2026-11-28T10:00:00Z"); // sábado

test("desligado sempre está dentro do horário", () => {
  assert.equal(isWithinBusinessHours({}, saturday10am), true);
});

test("dia útil dentro da janela", () => {
  assert.equal(isWithinBusinessHours({ businessHoursEnabled: true }, monday10am), true);
});

test("fora da janela e fim de semana ficam fora", () => {
  const config = { businessHoursEnabled: true, businessHoursStart: 9, businessHoursEnd: 18 };
  assert.equal(isWithinBusinessHours(config, new Date("2026-11-23T19:00:00Z")), false);
  assert.equal(isWithinBusinessHours(config, saturday10am), false);
});

test("janela que vira a noite", () => {
  const config = {
    businessHoursEnabled: true,
    businessHoursStart: 22,
    businessHoursEnd: 6,
    businessHoursDays: [1, 2, 3, 4, 5],
  };
  assert.equal(isWithinBusinessHours(config, new Date("2026-11-23T23:30:00Z")), true);
  assert.equal(isWithinBusinessHours(config, new Date("2026-11-23T02:00:00Z")), true);
  assert.equal(isWithinBusinessHours(config, new Date("2026-11-23T12:00:00Z")), false);
});

test("dias personalizados são lidos com fallback", () => {
  assert.deepEqual(businessHoursFrom({ businessHoursDays: [6, 0] }).days, [0, 6]);
  assert.deepEqual(businessHoursFrom({}).days, [1, 2, 3, 4, 5]);
});

test("rodapé legível", () => {
  assert.equal(
    businessHoursLabel({ businessHoursEnabled: true, businessHoursStart: 9, businessHoursEnd: 18 }),
    "seg, ter, qua, qui, sex das 9h às 18h",
  );
});
