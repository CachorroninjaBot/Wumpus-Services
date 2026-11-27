import assert from "node:assert/strict";
import { test } from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { maybeCompress } from "./compression.ts";

const BR = new Headers({ "accept-encoding": "br" });
const LARGE = JSON.stringify({ payload: "x".repeat(4_096) });
const SMALL = JSON.stringify({ ok: true });

function get(path = "/", headers = BR): Request {
  return new Request(`http://localhost${path}`, { headers });
}

function json(body: string): Response {
  return new Response(body, { headers: { "content-type": "application/json" } });
}

test("corpo pequeno com Accept-Encoding continua legível", async () => {
  const original = json(SMALL);
  const response = await maybeCompress(get(), original);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), null);
  assert.equal(await response.text(), SMALL);
});

test("corpo pequeno continua legível com gzip anunciado", async () => {
  const response = await maybeCompress(
    get("/", new Headers({ "accept-encoding": "gzip" })),
    json(SMALL),
  );
  assert.equal(await response.text(), SMALL);
});

test("corpo grande é comprimido com brotli de forma reversível", async () => {
  const response = await maybeCompress(get(), json(LARGE));

  assert.equal(response.headers.get("content-encoding"), "br");
  const compressed = Buffer.from(await response.arrayBuffer());
  assert.equal(brotliDecompressSync(compressed).toString(), LARGE);
  assert.equal(Number(response.headers.get("content-length")), compressed.byteLength);
  assert.match(response.headers.get("vary") ?? "", /accept-encoding/i);
  assert.equal(response.headers.get("etag"), null);
});

test("corpo grande usa gzip quando brotli não é anunciado", async () => {
  const response = await maybeCompress(
    get("/", new Headers({ "accept-encoding": "gzip, deflate" })),
    json(LARGE),
  );

  assert.equal(response.headers.get("content-encoding"), "gzip");
  const compressed = Buffer.from(await response.arrayBuffer());
  assert.equal(gunzipSync(compressed).toString(), LARGE);
});

test("sem Accept-Encoding a resposta segue intocada", async () => {
  const original = json(LARGE);
  const response = await maybeCompress(get("/", new Headers()), original);

  assert.equal(response, original);
  assert.equal(await response.text(), LARGE);
});

test("resposta já comprimida não é reprocessada", async () => {
  const original = new Response("x", {
    headers: { "content-type": "application/json", "content-encoding": "br" },
  });
  assert.equal(await maybeCompress(get(), original), original);
});

test("streams e corpos vazios seguem intocados", async () => {
  const stream = new Response(new ReadableStream(), {
    headers: { "content-type": "text/event-stream" },
  });
  assert.equal(await maybeCompress(get(), stream), stream);

  const empty = new Response(null, { status: 204 });
  assert.equal(await maybeCompress(get(), empty), empty);
});
