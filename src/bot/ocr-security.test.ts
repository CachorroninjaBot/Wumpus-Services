import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedDiscordImageUrl, isSafeOcrEndpoint } from "./ocr.ts";

test("OCR aceita somente URLs HTTPS dos CDNs de imagem do Discord", () => {
  assert.equal(
    isAllowedDiscordImageUrl("https://cdn.discordapp.com/attachments/1/2/image.png?ex=123"),
    true,
  );
  assert.equal(
    isAllowedDiscordImageUrl("http://cdn.discordapp.com/attachments/1/2/image.png"),
    false,
  );
  assert.equal(
    isAllowedDiscordImageUrl("https://media.discordapp.net/attachments/1/2/image.webp"),
    false,
  );
  assert.equal(
    isAllowedDiscordImageUrl("https://cdn.discordapp.com.evil.example/image.png"),
    false,
  );
  assert.equal(isAllowedDiscordImageUrl("https://user@cdn.discordapp.com/image.png"), false);
  assert.equal(isAllowedDiscordImageUrl("https://127.0.0.1/image.png"), false);
});

test("endpoint do OCR exige HTTPS e não aceita credenciais, query ou fragmento", () => {
  assert.equal(isSafeOcrEndpoint("https://ocr.example.com/v1/read", "production"), true);
  assert.equal(isSafeOcrEndpoint("http://ocr.example.com/v1/read", "production"), false);
  assert.equal(isSafeOcrEndpoint("http://localhost:8080/ocr", "development"), true);
  assert.equal(isSafeOcrEndpoint("http://localhost:8080/ocr", "production"), false);
  assert.equal(isSafeOcrEndpoint("https://user:secret@ocr.example.com/ocr", "production"), false);
  assert.equal(isSafeOcrEndpoint("https://ocr.example.com/ocr?key=secret", "production"), false);
  const endpointWithCredentials = `https://${"user"}:${"pass"}@ocr.example.com/ocr`;
  assert.equal(isSafeOcrEndpoint(endpointWithCredentials, "production"), false);
  assert.equal(isSafeOcrEndpoint("not a URL", "production"), false);
});
