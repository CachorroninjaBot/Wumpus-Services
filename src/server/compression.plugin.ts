import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { definePlugin } from "nitro";

/**
 * Compressão das respostas dinâmicas (JSON das server functions e HTML do SSR).
 *
 * O Nitro já pré-comprime os assets estáticos (`compressPublicAssets` no
 * vite.config.ts), mas as respostas dinâmicas saíam sem compressão nenhuma —
 * o payload JSON da dashboard é o maior custo de banda do painel. Este plugin
 * embrulha o handler do Nitro e comprime com brotli (ou gzip) quando:
 *
 *   - o cliente anuncia suporte no `Accept-Encoding`;
 *   - o `Content-Type` é compactável (JSON, HTML, texto, SVG);
 *   - a resposta ainda não tem `Content-Encoding` e tem corpo;
 *   - o corpo passa de 1 KiB — abaixo disso a compressão custa mais do que economiza.
 *
 * Streams (SSE) e respostas vazias (204/304/HEAD) não passam pelo filtro de
 * `Content-Type`/corpo, então seguem intocados. Falhas na compressão devolvem
 * a resposta original em vez de derrubar a request.
 */
const MIN_COMPRESS_BYTES = 1_024;
const COMPRESSIBLE_CONTENT_TYPE = /^(?:text\/(?:html|plain|css|javascript)|application\/(?:json|javascript)|image\/svg\+xml)/i;

export default definePlugin((nitro) => {
  const handler = nitro.fetch;
  nitro.fetch = async (request) => {
    const response = await handler(request);
    try {
      if (!response.body) return response;
      if (response.headers.get("content-encoding")) return response;
      if (!COMPRESSIBLE_CONTENT_TYPE.test(response.headers.get("content-type") ?? "")) return response;

      const acceptEncoding = request.headers.get("accept-encoding") ?? "";
      const useBrotli = /(?:^|[,\s])br(?:\s*;|,|$)/.test(acceptEncoding);
      const useGzip = !useBrotli && /(?:^|[,\s])gzip(?:\s*;|,|$)/.test(acceptEncoding);
      if (!useBrotli && !useGzip) return response;

      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength < MIN_COMPRESS_BYTES) return response;

      const compressed = useBrotli
        ? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })
        : gzipSync(body);

      const headers = new Headers(response.headers);
      headers.set("content-encoding", useBrotli ? "br" : "gzip");
      headers.set("content-length", String(compressed.byteLength));
      headers.append("vary", "Accept-Encoding");
      return new Response(compressed, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };
});
