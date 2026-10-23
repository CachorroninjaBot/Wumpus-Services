import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedDiscordImageUrl, OCR_SPACE_API_URL, parseOcrSpaceResponse } from "./ocr.ts";

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

test("usa o endpoint oficial do OCR.space", () => {
  assert.equal(OCR_SPACE_API_URL, "https://api.ocr.space/parse/image");
});

test("OCR.space retorna texto apenas para resultados de parsing bem-sucedidos", () => {
  assert.deepEqual(
    parseOcrSpaceResponse({
      OCRExitCode: 1,
      IsErroredOnProcessing: false,
      ParsedResults: [{ FileParseExitCode: 1, ParsedText: "  texto reconhecido \n" }],
    }),
    { text: "texto reconhecido", confidence: null },
  );
  assert.equal(
    parseOcrSpaceResponse({
      OCRExitCode: 2,
      IsErroredOnProcessing: false,
      ParsedResults: [{ FileParseExitCode: "1", ParsedText: "resultado parcial válido" }],
    })?.text,
    "resultado parcial válido",
  );
  assert.equal(
    parseOcrSpaceResponse({
      OCRExitCode: 3,
      IsErroredOnProcessing: false,
      ParsedResults: [{ FileParseExitCode: 1, ParsedText: "não confiável" }],
    }),
    null,
  );
  assert.equal(
    parseOcrSpaceResponse({
      OCRExitCode: 1,
      IsErroredOnProcessing: true,
      ParsedResults: [{ FileParseExitCode: 1, ParsedText: "erro" }],
    }),
    null,
  );
  assert.equal(
    parseOcrSpaceResponse({
      OCRExitCode: 1,
      IsErroredOnProcessing: false,
      ParsedResults: [{ FileParseExitCode: 3, ParsedText: "falha" }],
    }),
    null,
  );
  assert.equal(parseOcrSpaceResponse(null), null);
});
