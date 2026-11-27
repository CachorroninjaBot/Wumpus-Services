import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";
import { promisify } from "node:util";

/**
 * Compressão das respostas dinâmicas (JSON das server functions e HTML do SSR).
 *
 * O Nitro já pré-comprime os assets estáticos (`compressPublicAssets` no
 * vite.config.ts), mas as respostas dinâmicas saíam sem compressão nenhuma —
 * o payload JSON da dashboard é o maior custo de banda do painel. Aqui a
 * resposta é comprimida com brotli (ou gzip) quando:
 *
 *   - o cliente anuncia suporte no `Accept-Encoding`;
 *   - o `Content-Type` é compactável (JSON, HTML, texto, JS, SVG);
 *   - a resposta ainda não tem `Content-Encoding` e tem corpo;
 *   - o corpo passa de 1 KiB — abaixo disso a compressão custa mais do que economiza.
 *
 * Ler `response.arrayBuffer()` consome o stream original: devolver a MESMA
 * `Response` depois disso fecha a conexão sem corpo. Por isso todo retorno
 * após a leitura remonta uma `Response` com os bytes já lidos.
 *
 * Streams (SSE) e respostas vazias (204/304/HEAD) não passam pelo filtro de
 * `Content-Type`/corpo, então seguem intocados. Falhas na compressão devolvem
 * o corpo original em vez de derrubar a request.
 */
const MIN_COMPRESS_BYTES = 1_024;
const COMPRESSIBLE_CONTENT_TYPE = /^(?:text\/(?:html|plain|css|javascript)|application\/(?:json|javascript)|image\/svg\+xml)/i;

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

function rebuild(body: Uint8Array<ArrayBuffer>, response: Response): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

export async function maybeCompress(request: Request, response: Response): Promise<Response> {
  if (!response.body) return response;
  if (response.headers.get("content-encoding")) return response;
  if (!COMPRESSIBLE_CONTENT_TYPE.test(response.headers.get("content-type") ?? "")) return response;

  const acceptEncoding = request.headers.get("accept-encoding") ?? "";
  const useBrotli = /(?:^|[,\s])br(?:\s*;|,|$)/.test(acceptEncoding);
  const useGzip = !useBrotli && /(?:^|[,\s])gzip(?:\s*;|,|$)/.test(acceptEncoding);
  if (!useBrotli && !useGzip) return response;

  let body: Uint8Array<ArrayBuffer>;
  try {
    body = new Uint8Array(await response.arrayBuffer());
  } catch {
    return response;
  }
  if (body.byteLength < MIN_COMPRESS_BYTES) return rebuild(body, response);

  try {
    const compressed = useBrotli
      ? await brotli(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })
      : await gzipAsync(body);

    const headers = new Headers(response.headers);
    headers.set("content-encoding", useBrotli ? "br" : "gzip");
    headers.set("content-length", String(compressed.byteLength));
    headers.delete("etag");
    const vary = headers.get("vary");
    if (!vary) headers.set("vary", "Accept-Encoding");
    else if (!/accept-encoding/i.test(vary)) headers.set("vary", `${vary}, Accept-Encoding`);
    return new Response(compressed, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return rebuild(body, response);
  }
}
