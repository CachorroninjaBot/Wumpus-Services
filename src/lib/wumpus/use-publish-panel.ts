import { useState } from "react";
import {
  publishPanelAndWait,
  publishResultMessage,
  type PublishPanelTarget,
} from "./publish-panel";

export function usePublishPanel(guildId: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  async function publish(
    target: PublishPanelTarget,
    channelRef: string,
    options?: { verificationRoleId?: string },
  ) {
    if (!channelRef.trim()) {
      setMessage("Escolha o canal do painel.");
      setTone("error");
      return null;
    }
    if (target === "security-verification" && !options?.verificationRoleId?.trim()) {
      setMessage("Escolha o cargo verificado antes de publicar.");
      setTone("error");
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await publishPanelAndWait({
        guildId,
        target,
        channelRef: channelRef.trim(),
        ...(options?.verificationRoleId
          ? { verificationRoleId: options.verificationRoleId.trim() }
          : {}),
      });
      const msg = publishResultMessage(result);
      setMessage(msg);
      setTone(result?.status === "done" ? "success" : result?.status === "failed" ? "error" : "neutral");
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao publicar o painel.";
      setMessage(msg);
      setTone("error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, tone, publish };
}
