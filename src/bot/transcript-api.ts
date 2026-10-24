const TRANSCRIPT_API_URL = "https://haiz-transcript.shardweb.app/api/generate";
const TRANSCRIPT_ORIGIN = "https://haiz-transcript.shardweb.app";

function extractTranscriptUrl(body: string): string | null {
  if (body.length > 16_384) return null;

  let candidate = body.trim();
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed === "string") {
      candidate = parsed;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const value = record.transcript_url ?? record.transcriptUrl ?? record.url ?? record.link ?? record.transcript;
      if (typeof value === "string") candidate = value;
    }
  } catch {
    const url = candidate.match(/https:\/\/haiz-transcript\.shardweb\.app\/transcript\/\d{17,20}/)?.[0];
    candidate = url ?? candidate;
  }

  try {
    const parsedUrl = new URL(candidate);
    if (
      parsedUrl.origin !== TRANSCRIPT_ORIGIN ||
      parsedUrl.search ||
      parsedUrl.hash ||
      !/^\/transcript\/\d{17,20}$/.test(parsedUrl.pathname)
    ) return null;
    return parsedUrl.href;
  } catch {
    return null;
  }
}

export async function generateTranscriptUrl(channelId: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!/^\d{17,20}$/.test(channelId)) {
    throw new Error("O canal informado para gerar a transcrição não é válido.");
  }

  const response = await fetcher(TRANSCRIPT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_id: channelId }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`A API de transcrição respondeu com HTTP ${response.status}.`);
  }

  const url = extractTranscriptUrl(await response.text());
  if (!url || new URL(url).pathname !== `/transcript/${channelId}`) {
    throw new Error("A API de transcrição não retornou um link válido para este canal.");
  }
  return url;
}
