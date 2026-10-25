import { useState } from "react";
import { publishPanelAndWait, publishResultMessage } from "./publish-panel";
import { getStoredSessionToken } from "./session-token";

export function usePublishPanel(guildId: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  async function publish(target: "tickets" | "forms" = "tickets", channelRef?: string) {
    const token = getStoredSessionToken();
    if (!token) {
      setMessage("Entre novamente com Discord para publicar.");
      setTone("error");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await publishPanelAndWait({
        data: { token, guildId, ...(target === "forms" ? { target, channelRef } : {}) },
      });
      setMessage(publishResultMessage(result));
      setTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao publicar o painel.");
      setTone("error");
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, tone, publish };
}
