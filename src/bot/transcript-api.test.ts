import assert from "node:assert/strict";
import { test } from "node:test";
import { generateTranscriptUrl } from "./transcript-api.ts";

const channelId = "1291885299059916800";
const transcriptUrl = `https://haiz-transcript.shardweb.app/transcript/${channelId}`;

test("solicita a transcrição com channel_id e retorna o link fornecido", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const url = await generateTranscriptUrl(channelId, async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ url: transcriptUrl }), { status: 200 });
  });
  assert.equal(requestUrl, "https://haiz-transcript.shardweb.app/api/generate");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.headers && (requestInit.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { channel_id: channelId });
  assert.equal(url, transcriptUrl);
});

test("aceita a URL como texto puro", async () => {
  assert.equal(
    await generateTranscriptUrl(channelId, async () => new Response(transcriptUrl)),
    transcriptUrl,
  );
});

test("recusa IDs que não são snowflakes de canal", async () => {
  await assert.rejects(() => generateTranscriptUrl("https://example.com", async () => new Response(transcriptUrl)));
});

test("recusa respostas HTTP malsucedidas", async () => {
  await assert.rejects(
    () => generateTranscriptUrl(channelId, async () => new Response("erro", { status: 503 })),
    /HTTP 503/,
  );
});

test("não confia em URL de transcript de outra origem ou de outro canal", async () => {
  await assert.rejects(
    () => generateTranscriptUrl(channelId, async () => new Response(JSON.stringify({ url: "https://attacker.example/transcript/12345678901234567" }))),
    /link válido/,
  );
  await assert.rejects(
    () => generateTranscriptUrl(channelId, async () => new Response(JSON.stringify({ url: "https://haiz-transcript.shardweb.app/transcript/12345678901234567" }))),
    /link válido/,
  );
  await assert.rejects(
    () => generateTranscriptUrl(channelId, async () => new Response(JSON.stringify({ url: `${transcriptUrl}?token=secret` }))),
    /link válido/,
  );
});
