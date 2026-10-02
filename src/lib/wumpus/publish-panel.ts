import { getStoredSessionToken } from "./session-token";
import { getPublishStatus, requestPanelPublish, type PublishStatus } from "./runtime-store";

export async function publishPanelAndWait(input: {
  guildId: string;
  target: "tickets" | "forms";
  channelRef: string;
}): Promise<PublishStatus | null> {
  const token = getStoredSessionToken();
  if (!token) throw new Error("Entre novamente com Discord para publicar este painel.");
  const request = await requestPanelPublish({ data: { token, ...input } });

  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const rows = await getPublishStatus({ data: { token, guildId: input.guildId } });
    const result = rows.find((row) => row.id === request.jobId);
    if (result && result.status !== "queued") return result;
  }
  return null;
}

export function publishResultMessage(result: PublishStatus | null): string {
  if (!result) return "Pedido enviado ao bot; o resultado ainda não chegou.";
  if (result.status === "done") return `Publicado no canal "${result.channelRef}".`;
  if (result.status === "failed") return result.detail ?? "O bot não conseguiu publicar o painel.";
  return "O bot ainda está processando a publicação.";
}
