import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRelative } from "./utils.ts";

test("formatRelative usa unidades relativas nativas em pt-BR", () => {
  const now = 1_800_000_000_000;

  assert.equal(formatRelative(now, now), "agora");
  assert.equal(formatRelative(now - 60_000, now), "há 1 min.");
  assert.equal(formatRelative(now - 3_600_000, now), "há 1 h");
  assert.equal(formatRelative(now - 86_400_000, now), "há 1 dia");
});

test("formatRelative usa data local para eventos com sete dias ou mais", () => {
  const now = 1_800_000_000_000;
  const timestamp = now - 7 * 86_400_000;

  assert.equal(
    formatRelative(timestamp, now),
    new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  );
});
