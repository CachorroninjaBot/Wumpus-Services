import { useState } from "react";
import { publishPanelAndWait, publishResultMessage } from "./publish-panel";
import { getGuildSecurityActionStatus, requestPanelPublish } from "./runtime-store";
import { getStoredSessionToken } from "./session-token";

export function usePublishPanel(guildId: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  async function waitForSecurityJob(jobId: string, successText: string) {
    const token = getStoredSessionToken();
    if (!token) throw new Error("Entre novamente com Discord para publicar.");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await getGuildSecurityActionStatus({ data: { token, guildId, jobId } });
      if (result.status === "done") return { ok: true as const, detail: result.detail ?? successText };
      if (result.status === "failed") {
        return {
          ok: false as const,
          detail: result.detail ?? "O bot não conseguiu concluir a publicação.",
        };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    return { ok: false as const, detail: "O pedido continua na fila. Tente novamente se o bot não concluir." };
  }

  async function publish(target: "tickets" | "forms", channelRef: string) {
    if (!channelRef.trim()) {
      setMessage("Escolha o canal do painel.");
      setTone("error");
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await publishPanelAndWait({ guildId, target, channelRef: channelRef.trim() });
      const msg = publishResultMessage(result);
      setMessage(msg);
      setTone(result?.status === "done" ? "success" : "neutral");
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

  async function publishVerification(channelRef: string, verificationRoleId: string) {
    if (!channelRef.trim() || !verificationRoleId.trim()) {
      setMessage("Escolha o canal e o cargo verificado antes de publicar.");
      setTone("error");
      return null;
    }
    const token = getStoredSessionToken();
    if (!token) {
      setMessage("Entre novamente com Discord para publicar.");
      setTone("error");
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const request = await requestPanelPublish({
        data: {
          token,
          guildId,
          target: "security-verification",
          channelRef: channelRef.trim(),
          verificationRoleId: verificationRoleId.trim(),
        },
      });
      const outcome = await waitForSecurityJob(request.jobId, "Painel publicado no Discord.");
      setMessage(outcome.detail);
      setTone(outcome.ok ? "success" : "error");
      return outcome;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Não foi possível publicar o painel.";
      setMessage(msg);
      setTone("error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, tone, publish, publishVerification };
}
