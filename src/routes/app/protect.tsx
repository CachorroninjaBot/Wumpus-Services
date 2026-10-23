import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, BadgeCheck, Check, ChevronRight, CircleAlert, CircleCheck,
  Eye, LockKeyhole, MessageSquareWarning, RefreshCw, Shield, ShieldAlert,
  ShieldCheck, Siren,
} from "lucide-react";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { asList, asString, evaluateNuke, planAllows, scanMessage } from "@/lib/wumpus/engine";
import { presets, type PresetId } from "@/lib/wumpus/defaults";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import {
  acknowledgeGuildSecurityIncident,
  getGuildProtectionReadiness,
  getGuildSecurityActionStatus,
  getGuildSecurityIncidents,
  requestPanelPublish,
  requestSecurityLockdown,
  requestSecurityRestore,
} from "@/lib/wumpus/runtime-store";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/app/protect")({ component: ProtectPage });

type ProtectSection = "overview" | "automod" | "entry" | "verification" | "antinuke" | "incidents";
type SecurityEvent = Awaited<ReturnType<typeof getGuildSecurityIncidents>>[number];
type PermissionKey = "manageMessages" | "manageChannels" | "manageRoles" | "moderateMembers" | "viewAuditLog" | "banMembers";
type ConfirmAction = "lockdown_on" | "lockdown_off" | "restore_verification";

function verificationFailureAdvice(detail: string): string | null {
  const normalized = detail.toLocaleLowerCase("pt-BR");
  if (normalized.includes("onboarding")) {
    return "Em Configurações do servidor > Onboarding, remova esse canal da lista de canais do Onboarding. Se preferir mantê-lo lá, selecione outro canal para a verificação.";
  }
  if (normalized.includes("gerenciado por uma integração")) {
    return "Escolha outro cargo, criado diretamente neste servidor. Cargos de bots e integrações não podem ser concedidos pelo painel.";
  }
  if (normalized.includes("não foi encontrado neste servidor")) {
    return "Atualize a página para recarregar os cargos do Discord e escolha novamente o cargo que será dado após a verificação.";
  }
  if (
    normalized.includes("acima ou na mesma posição") ||
    normalized.includes("cargo verificado inválido ou acima do cargo do bot")
  ) {
    return "No Discord, abra Configurações do servidor > Cargos e arraste o cargo do Wumpus para uma posição acima do cargo verificado. Depois, tente publicar novamente.";
  }
  return null;
}

const sections: Array<{ id: ProtectSection; label: string; icon: typeof Shield }> = [
  { id: "overview", label: "Visão geral", icon: ShieldCheck },
  { id: "automod", label: "Mensagens", icon: MessageSquareWarning },
  { id: "entry", label: "Entradas e raid", icon: Siren },
  { id: "verification", label: "Verificação", icon: BadgeCheck },
  { id: "antinuke", label: "Anti-nuke", icon: ShieldAlert },
  { id: "incidents", label: "Incidentes", icon: Activity },
];

const permissionLabels: Record<PermissionKey, string> = {
  manageMessages: "Gerenciar mensagens",
  manageChannels: "Gerenciar canais",
  manageRoles: "Gerenciar cargos",
  moderateMembers: "Moderar membros",
  viewAuditLog: "Ver registro de auditoria",
  banMembers: "Banir membros",
};

const presetModuleLabels: Record<string, string> = {
  automod: "AutoMod",
  security: "Proteção contra raid e nuke",
  tickets: "Atendimento",
};

const configFieldLabels: Record<string, string> = {
  blockInvites: "Bloqueio de convites",
  blockLinks: "Bloqueio de links",
  allowedDomains: "Domínios permitidos",
  blockedTerms: "Termos bloqueados",
  action: "Ação do AutoMod",
  capsThresholdPercent: "Limite de letras maiúsculas",
  mentionLimit: "Limite de menções",
  raidMode: "Modo anti-raid",
  raidJoinThreshold: "Limite de entradas",
  minAccountAgeHours: "Idade mínima da conta",
  quarantineNewMembers: "Isolamento de contas novas",
  slaWarningMinutes: "Aviso de prazo do atendimento",
  departments: "Departamentos de atendimento",
};

function ProtectPage() {
  const guild = useActiveGuild();
  const guildId = useWumpus((state) => state.activeGuildId);
  const automod = useModule("automod");
  const security = useModule("security");
  const tickets = useModule("tickets");
  const updateConfig = useWumpus((state) => state.updateConfig);
  const setModuleEnabled = useWumpus((state) => state.setModuleEnabled);
  const applyPreset = useWumpus((state) => state.applyPreset);
  const members = useGuildMembers();
  const channels = useWumpus((state) => state.channels[state.activeGuildId] ?? []);
  const runtimeSyncStatus = useWumpus((state) => state.runtimeSyncStatus);
  const runtimeSyncError = useWumpus((state) => state.runtimeSyncError);
  const [section, setSection] = useState<ProtectSection>("overview");
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof getGuildProtectionReadiness>> | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<PresetId | "">("");
  const [presetNote, setPresetNote] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [verificationChannelId, setVerificationChannelId] = useState(asString(security.config.verificationChannelId));
  const [verifiedRoleId, setVerifiedRoleId] = useState(asString(security.config.verifiedRoleId));
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [testText, setTestText] = useState("entra no meu server discord.gg/nitrofree");
  const [testVerdict, setTestVerdict] = useState<ReturnType<typeof scanMessage> | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "open" | "reviewed">("open");
  const [eventSeverity, setEventSeverity] = useState("all");
  const [raidTestCount, setRaidTestCount] = useState(14);
  const [nukeTestCount, setNukeTestCount] = useState(6);
  const [raidTestResult, setRaidTestResult] = useState<string | null>(null);
  const [nukeTestResult, setNukeTestResult] = useState<string | null>(null);

  useEffect(() => {
    setVerificationChannelId(asString(security.config.verificationChannelId));
    setVerifiedRoleId(asString(security.config.verifiedRoleId));
  }, [guildId, security.config.verificationChannelId, security.config.verifiedRoleId]);

  useEffect(() => {
    if (!members.some((member) => member.id === memberId)) setMemberId(members[0]?.id ?? "");
  }, [members, memberId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const token = getStoredSessionToken();
      if (!token || !guildId) return;
      const [nextReadiness, nextEvents] = await Promise.allSettled([
        getGuildProtectionReadiness({ data: { token, guildId } }),
        getGuildSecurityIncidents({ data: { token, guildId, limit: 100 } }),
      ]);
      if (!active) return;
      if (nextReadiness.status === "fulfilled") {
        setReadiness(nextReadiness.value);
        setReadinessError(null);
      } else {
        setReadinessError(nextReadiness.reason instanceof Error ? nextReadiness.reason.message : "Não foi possível verificar o bot.");
      }
      if (nextEvents.status === "fulfilled") {
        setEvents(nextEvents.value);
        setEventError(null);
      } else {
        setEventError(nextEvents.reason instanceof Error ? nextEvents.reason.message : "Não foi possível carregar os alertas reais do bot.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [guildId]);

  const permissions = readiness?.permissions ?? null;
  const lockdownActive = readiness?.lockdown ?? Boolean(security.config.lockdown);
  const requiredPermissions = useMemo(() => {
    const required = new Set<PermissionKey>();
    if (automod.enabled) {
      required.add("manageMessages");
      if (asString(automod.config.action) === "timeout") required.add("moderateMembers");
    }
    if (security.enabled) {
      required.add("viewAuditLog");
      if (asString(security.config.response, "lockdown_review") === "lockdown_review" || lockdownActive) required.add("manageChannels");
      if (security.config.quarantineNewMembers || asString(security.config.response) === "auto") required.add("moderateMembers");
      if (security.config.autoBanRepeatOffenders) required.add("banMembers");
      if (security.config.verificationEnabled) {
        required.add("manageChannels");
        required.add("manageRoles");
      }
    }
    return [...required];
  }, [automod.enabled, automod.config.action, security.enabled, security.config, lockdownActive]);

  const openEvents = events.filter((event) => !event.acknowledged).length;
  const filteredEvents = events.filter((event) => {
    if (eventFilter === "open" && event.acknowledged) return false;
    if (eventFilter === "reviewed" && !event.acknowledged) return false;
    if (eventSeverity !== "all" && event.severity !== eventSeverity) return false;
    return true;
  });
  const activePreset = guild.preset;
  const presetChanges = presetDraft ? getPresetChanges(presetDraft, automod.config, security.config, tickets.config) : [];
  const confirmPermissionMissing = confirmAction === "restore_verification"
    ? permissions?.manageChannels === false || permissions?.manageRoles === false
    : (confirmAction === "lockdown_on" || confirmAction === "lockdown_off") && permissions?.manageChannels === false;

  const markReviewed = async (eventId: number) => {
    try {
      await acknowledgeGuildSecurityIncident({ data: { token: getStoredSessionToken(), guildId, eventId } });
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, acknowledged: true } : event));
    } catch (error) {
      setEventError(error instanceof Error ? error.message : "Não foi possível marcar o alerta como revisado.");
    }
  };

  const waitForAction = async (jobId: string, successText: string) => {
    setActionBusy(true);
    setActionFailed(false);
    setActionNote("Pedido recebido. Aguardando o bot executar no Discord…");
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const result = await getGuildSecurityActionStatus({ data: { token: getStoredSessionToken(), guildId, jobId } });
        if (result.status === "done") {
          setActionFailed(false);
          setActionNote(result.detail || successText);
          return true;
        }
        if (result.status === "failed") {
          setActionFailed(true);
          setActionNote(result.detail || "O bot não conseguiu concluir a ação. Confira as permissões e tente novamente.");
          return false;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setActionFailed(true);
      setActionNote("O pedido continua na fila. Consulte o estado do bot e tente novamente se ele não concluir.");
      return false;
    } catch (error) {
      setActionFailed(true);
      setActionNote(error instanceof Error ? error.message : "Não foi possível consultar o resultado da ação.");
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction || !guildId) return;
    if (confirmPermissionMissing) {
      setActionFailed(true);
      setActionNote("O bot não tem as permissões necessárias para essa ação. Corrija o checklist antes de tentar novamente.");
      setConfirmAction(null);
      return;
    }
    const action = confirmAction;
    setConfirmAction(null);
    setActionBusy(true);
    setActionFailed(false);
    setActionNote("Enviando pedido ao bot…");
    try {
      if (action === "restore_verification") {
        const result = await requestSecurityRestore({ data: { token: getStoredSessionToken(), guildId } });
        const restored = await waitForAction(result.jobId, "Permissões de verificação restauradas.");
        if (restored) await useWumpus.getState().updateConfig("security", { verificationEnabled: false });
      } else {
        const enabled = action === "lockdown_on";
        const result = await requestSecurityLockdown({ data: { token: getStoredSessionToken(), guildId, enabled } });
        const applied = await waitForAction(result.jobId, enabled ? "Lockdown aplicado pelo bot." : "Lockdown encerrado pelo bot.");
        if (applied) {
          await useWumpus.getState().updateConfig("security", { lockdown: enabled });
          setReadiness((current) => current ? { ...current, lockdown: enabled } : current);
        }
      }
    } catch (error) {
      setActionFailed(true);
      setActionNote(error instanceof Error ? error.message : "Não foi possível enviar a ação ao bot.");
      setActionBusy(false);
    }
  };

  const publishVerification = async () => {
    if (!guildId || !verificationChannelId || !verifiedRoleId) {
      setActionNote("Escolha o canal e o cargo verificado antes de publicar.");
      return;
    }
    setActionBusy(true);
    setActionFailed(false);
    setActionNote("Enviando o painel de verificação ao bot…");
    try {
      const result = await requestPanelPublish({ data: { token: getStoredSessionToken(), guildId, target: "security-verification", channelRef: verificationChannelId, verificationRoleId: verifiedRoleId } });
      const sent = await waitForAction(result.jobId, "Painel publicado no Discord.");
      if (sent) await useWumpus.getState().updateConfig("security", { verificationChannelId, verifiedRoleId, verificationEnabled: true });
    } catch (error) {
      setActionFailed(true);
      setActionNote(error instanceof Error ? error.message : "Não foi possível publicar o painel.");
      setActionBusy(false);
    }
  };

  const applySelectedPreset = () => {
    if (!presetDraft) return;
    const preset = presetDraft;
    applyPreset(preset);
    setPresetNote(`Modelo “${presets[preset].label}” aplicado. Os campos mostrados foram atualizados e estão sendo sincronizados com o bot.`);
    setPresetDraft("");
  };

  const runMessagePreview = () => {
    const member = members.find((entry) => entry.id === memberId);
    if (!automod.enabled) {
      setTestVerdict({ ok: true, detail: "AutoMod está pausado; esta mensagem não seria filtrada." });
      return;
    }
    setTestVerdict(scanMessage(automod.config, testText, member ?? { roleIds: [], username: "membro" }));
  };

  const goToEventModule = (event: SecurityEvent) => {
    setSection(event.module === "automod" ? "automod" : event.eventType.includes("lockdown") ? "overview" : ["raid", "young_account", "auto_timeout", "quarantine", "auto_response"].some((term) => event.eventType.includes(term)) ? "entry" : "antinuke");
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Proteção do servidor</h1>
          <p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Veja o que está ativo, corrija o que falta e escolha como o Wumpus deve reagir.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <span className={`size-2 rounded-full ${runtimeSyncStatus === "failed" ? "bg-destructive" : runtimeSyncStatus === "syncing" ? "animate-pulse bg-warn" : runtimeSyncStatus === "synced" ? "bg-ok" : "bg-muted-foreground/50"}`} />
          {runtimeSyncStatus === "syncing" ? "Salvando no bot…" : runtimeSyncStatus === "failed" ? "Falha ao sincronizar" : runtimeSyncStatus === "synced" ? "Configuração sincronizada" : "Salvamento automático"}
        </div>
      </header>

      {lockdownActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3" role="alert">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div><p className="m-0 text-sm font-semibold text-destructive">Lockdown configurado para este servidor</p><p className="m-0 mt-1 text-xs text-muted-foreground">O bot restringe o envio de mensagens nos canais públicos enquanto essa proteção estiver ativa.</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("lockdown_off")} disabled={actionBusy}>Encerrar lockdown</Button>
        </div>
      ) : null}

      {runtimeSyncError ? <p className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{runtimeSyncError}</p> : null}
      {actionNote ? (
        <div className={`rounded-lg px-4 py-3 text-sm ${actionFailed ? "border border-destructive/25 bg-destructive/10" : "bg-muted"}`} role={actionFailed ? "alert" : "status"} aria-live={actionFailed ? "assertive" : "polite"}>
          <p className="m-0 font-semibold">{actionFailed ? "Não foi possível concluir a ação" : actionNote}</p>
          {actionFailed ? <p className="mb-0 mt-1">{actionNote}</p> : null}
          {actionFailed && section === "verification" && verificationFailureAdvice(actionNote) ? (
            <p className="mb-0 mt-2 text-muted-foreground">{verificationFailureAdvice(actionNote)}</p>
          ) : null}
        </div>
      ) : null}

      <Tabs value={section} onValueChange={(value) => setSection(value as ProtectSection)}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-transparent p-0">
          {sections.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="min-h-10 shrink-0 rounded-lg border border-transparent px-3 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-border">
              <Icon className="mr-2 size-4" aria-hidden="true" />{label}{id === "incidents" && openEvents > 0 ? <span className="ml-2 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">{openEvents}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
          <section aria-labelledby="protection-state-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 id="protection-state-heading" className="m-0 text-lg font-semibold">Estado das proteções</h2><span className="text-xs text-muted-foreground">Servidor: {guild.name}</span></div>
            <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              <ModuleStatusRow label="Filtro de mensagens" detail={automod.enabled ? "Convites, links, termos e spam" : "O Wumpus não está filtrando mensagens"} enabled={automod.enabled} onChange={(value) => setModuleEnabled("automod", value)} icon={MessageSquareWarning} />
              <ModuleStatusRow label="Proteção contra raid e nuke" detail={security.enabled ? raidResponseDescription(asString(security.config.response, "lockdown_review")) : "Alertas e respostas automáticas pausados"} enabled={security.enabled} onChange={(value) => setModuleEnabled("security", value)} icon={ShieldAlert} />
              <ReadinessRow label="Verificação de membros" detail={security.config.verificationEnabled ? channelLabel(channels, verificationChannelId) : "Ainda não publicada"} tone={security.config.verificationEnabled ? "ok" : "warn"} status={security.config.verificationEnabled ? "Ativa" : "Opcional"} />
              <ReadinessRow label="Incidentes aguardando revisão" detail={eventError ? "Não foi possível ler a auditoria do bot" : `${openEvents} alerta(s) real(is) sem revisão`} tone={openEvents ? "warn" : "ok"} status={openEvents ? "Atenção" : "Em dia"} onClick={() => setSection("incidents")} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-base font-semibold">Conexão e permissões do Wumpus</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Verificado pelo bot no Discord. Atualiza a cada 30 segundos.</p></div><Button variant="ghost" size="sm" onClick={() => window.location.reload()} aria-label="Atualizar estado do bot"><RefreshCw className="size-4" />Atualizar</Button></div>
              <BotConnectionStatus readiness={readiness} error={readinessError} />
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                {requiredPermissions.length ? requiredPermissions.map((key) => <PermissionStatus key={key} label={permissionLabels[key]} value={permissions?.[key] ?? null} botStatus={readiness?.status ?? "unknown"} />) : <p className="m-0 py-3 text-sm text-muted-foreground">Ligue uma proteção para ver as permissões necessárias.</p>}
              </div>
              {readiness?.status === "online" && permissions === null ? <p className="m-0 rounded-lg bg-warn/10 px-3 py-2 text-xs text-muted-foreground">O bot ainda não publicou o diagnóstico de permissões. Reinicie/atualize o bot para habilitar essa verificação.</p> : null}
              {readinessError ? <p className="m-0 text-xs text-destructive" role="alert">{readinessError}</p> : null}
            </Card>

            <Card className="space-y-4">
              <div><h2 className="m-0 text-base font-semibold">Começar com um modelo</h2><p className="m-0 mt-1 text-sm text-muted-foreground">O modelo altera apenas os campos listados e mantém os demais ajustes.</p></div>
              <NativeSelect aria-label="Modelo de proteção" value={presetDraft || activePreset} onChange={(event) => { setPresetNote(null); setPresetDraft(event.target.value as PresetId); }}>
                {(Object.keys(presets) as PresetId[]).map((id) => <option key={id} value={id}>{presets[id].label}{id === activePreset ? " · atual" : ""}</option>)}
              </NativeSelect>
              <p className="m-0 text-sm text-muted-foreground">{presets[presetDraft || activePreset].blurb}</p>
              <ul className="m-0 space-y-2 border-y border-border py-3 pl-5 text-sm">
                {(presetDraft ? presetChanges : []).length ? presetChanges.map((change) => <li key={change.key}><span className="font-medium">{presetModuleLabels[change.module] ?? change.module}:</span> {change.label} → {change.value}</li>) : <li>Este modelo já corresponde às opções exibidas.</li>}
              </ul>
              <div className="flex flex-wrap items-center gap-2"><Button onClick={applySelectedPreset} disabled={!presetDraft || !presetChanges.length}>Aplicar modelo</Button><span className="text-xs text-muted-foreground">O atendimento também pode ser ajustado pelo modelo.</span></div>
              {presetNote ? <p className="m-0 text-sm text-ok" role="status">{presetNote}</p> : null}
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-2"><div><h2 className="m-0 text-lg font-semibold">Precisa de atenção</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Alertas reais registrados pelo bot e ações da equipe.</p></div><Button variant="ghost" size="sm" onClick={() => setSection("incidents")}>Ver todos<ArrowRight className="size-4" /></Button></div>
            {eventError ? <p className="m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm" role="status">{eventError}. Os eventos aparecem quando o bot está conectado.</p> : <SecurityEventList events={events.filter((event) => !event.acknowledged).slice(0, 5)} onReview={markReviewed} onOpen={goToEventModule} onLockdown={() => setConfirmAction("lockdown_on")} lockdown={lockdownActive} compact />}
          </section>
        </TabsContent>

        <TabsContent value="automod" className="mt-5 space-y-5">
          <SectionHeading title="Filtro de mensagens" description="Escolha o que o Wumpus deve filtrar e como reagir. As mudanças são salvas automaticamente." enabled={automod.enabled} onEnabledChange={(value) => setModuleEnabled("automod", value)} />
          {!automod.enabled ? <PausedNotice name="AutoMod" onResume={() => setModuleEnabled("automod", true)} /> : null}
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <Card className="space-y-4">
                <SectionTitle title="O que filtrar" />
                <div className="divide-y divide-border">
                  <ToggleRow label="Convites de outros servidores" description="Remove links de convite do Discord." checked={Boolean(automod.config.blockInvites)} onChange={(value) => updateConfig("automod", { blockInvites: value })} disabled={!automod.enabled} />
                  <ToggleRow label="Links fora da lista permitida" description="Só deixa passar domínios adicionados à lista abaixo." checked={Boolean(automod.config.blockLinks)} onChange={(value) => updateConfig("automod", { blockLinks: value })} disabled={!automod.enabled} />
                  <ToggleRow label="Menções em excesso" description="Bloqueia uma mensagem acima do limite definido." checked={Number(automod.config.mentionLimit ?? 8) > 0} onChange={(value) => updateConfig("automod", { mentionLimit: value ? 8 : 0 })} disabled={!automod.enabled} />
                  <ToggleRow label="Mensagens em letras maiúsculas" description="Detecta texto escrito quase todo em caixa alta." checked={Number(automod.config.capsThresholdPercent ?? 80) < 100} onChange={(value) => updateConfig("automod", { capsThresholdPercent: value ? 80 : 100 })} disabled={!automod.enabled} />
                  <ToggleRow label="Ghost ping" description="Registra quando alguém apaga uma mensagem após mencionar outra pessoa." checked={Boolean(automod.config.antiGhostPing)} onChange={(value) => updateConfig("automod", { antiGhostPing: value })} disabled={!automod.enabled} />
                  <ToggleRow label="Texto dentro de imagens" description="Usa o leitor de imagem configurado para procurar termos bloqueados." checked={automod.config.scanImages !== false} onChange={(value) => updateConfig("automod", { scanImages: value })} disabled={!automod.enabled} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="automod-action" label="Quando encontrar uma mensagem"><NativeSelect id="automod-action" value={asString(automod.config.action, "delete")} onChange={(event) => updateConfig("automod", { action: event.target.value })} disabled={!automod.enabled}><option value="delete">Apagar</option><option value="warn">Avisar a pessoa</option><option value="timeout">Apagar e aplicar timeout</option></NativeSelect></Field>
                  {asString(automod.config.action) === "timeout" ? <NumberField id="automod-timeout" label="Duração do timeout (minutos)" value={Number(automod.config.timeoutMinutes ?? 10)} min={1} max={40320} onChange={(value) => updateConfig("automod", { timeoutMinutes: value })} disabled={!automod.enabled} /> : null}
                </div>
                {asString(automod.config.action) === "warn" ? <Field id="automod-warn-message" label="Aviso enviado à pessoa"><Input id="automod-warn-message" value={asString(automod.config.warnMessage)} maxLength={500} onChange={(event) => updateConfig("automod", { warnMessage: event.target.value })} disabled={!automod.enabled} /></Field> : null}
              </Card>

              <Card className="space-y-4">
                <SectionTitle title="Termos e links" />
                <ListField id="blocked-terms" label="Termos bloqueados" hint="Um termo por linha. O bot procura correspondências dentro da mensagem." value={asList(automod.config.blockedTerms)} onChange={(blockedTerms) => updateConfig("automod", { blockedTerms })} disabled={!automod.enabled} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ListField id="blocked-domains" label="Domínios bloqueados" hint="Ex.: golpe.example" value={asList(automod.config.blockedDomains)} onChange={(blockedDomains) => updateConfig("automod", { blockedDomains })} disabled={!automod.enabled} />
                  <ListField id="allowed-domains" label="Domínios liberados" hint="Usado quando o bloqueio de links está ligado." value={asList(automod.config.allowedDomains)} onChange={(allowedDomains) => updateConfig("automod", { allowedDomains })} disabled={!automod.enabled} />
                </div>
              </Card>

              <Card className="space-y-4">
                <div><SectionTitle title="Spam e limites" /><p className="m-0 mt-1 text-sm text-muted-foreground">Flood e repetição usam o histórico de mensagens do servidor.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField id="mention-limit" label="Menções por mensagem" value={Number(automod.config.mentionLimit ?? 8)} min={0} max={100} onChange={(value) => updateConfig("automod", { mentionLimit: value })} disabled={!automod.enabled} hint="0 desliga" />
                  <NumberField id="caps-limit" label="Limite de maiúsculas (%)" value={Number(automod.config.capsThresholdPercent ?? 80)} min={0} max={100} onChange={(value) => updateConfig("automod", { capsThresholdPercent: value })} disabled={!automod.enabled} hint="100 desliga" />
                  <NumberField id="flood-count" label="Mensagens na janela" value={Number(automod.config.messageLimit ?? 6)} min={1} max={100} onChange={(value) => updateConfig("automod", { messageLimit: value })} disabled={!automod.enabled} />
                  <NumberField id="flood-window" label="Janela do flood (s)" value={Number(automod.config.windowSeconds ?? 10)} min={1} max={3600} onChange={(value) => updateConfig("automod", { windowSeconds: value })} disabled={!automod.enabled} />
                  <NumberField id="duplicate-limit" label="Repetições da mesma mensagem" value={Number(automod.config.duplicateLimit ?? 3)} min={1} max={100} onChange={(value) => updateConfig("automod", { duplicateLimit: value })} disabled={!automod.enabled} />
                  <NumberField id="min-length" label="Tamanho mínimo" value={Number(automod.config.minLength ?? 0)} min={0} max={2000} onChange={(value) => updateConfig("automod", { minLength: value })} disabled={!automod.enabled} hint="0 desliga" />
                  <NumberField id="max-length" label="Tamanho máximo" value={Number(automod.config.maxLength ?? 0)} min={0} max={4000} onChange={(value) => updateConfig("automod", { maxLength: value })} disabled={!automod.enabled} hint="0 desliga" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><div><Label>Canais ignorados</Label><DiscordMultiSelect kind="text" value={asList(automod.config.ignoredChannelIds)} onChange={(ignoredChannelIds) => updateConfig("automod", { ignoredChannelIds })} placeholder="Adicionar canal…" /></div><div><Label>Cargos ignorados</Label><DiscordMultiSelect value={asList(automod.config.ignoredRoleIds)} onChange={(ignoredRoleIds) => updateConfig("automod", { ignoredRoleIds })} placeholder="Adicionar cargo…" /></div></div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="space-y-4">
                <div><SectionTitle title="Prévia de uma mensagem" /><p className="m-0 mt-1 text-sm text-muted-foreground">Simulação local das regras atuais. Não envia nem apaga mensagens no Discord.</p></div>
                <Field id="automod-test-member" label="Simular como"><NativeSelect id="automod-test-member" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Membro sem cargo</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</NativeSelect></Field>
                <Field id="automod-test-message" label="Mensagem para testar"><Textarea id="automod-test-message" value={testText} rows={4} onChange={(event) => setTestText(event.target.value)} placeholder="Cole uma mensagem de exemplo…" /></Field>
                <Button onClick={runMessagePreview} disabled={!testText.trim()}>Verificar mensagem</Button>
                {testVerdict ? <div className={`rounded-lg px-3 py-3 text-sm ${testVerdict.ok ? "bg-ok/10 text-ok" : "bg-warn/10 text-foreground"}`} role="status"><p className="m-0 flex items-center gap-2 font-semibold">{testVerdict.ok ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}{testVerdict.ok ? "A mensagem passaria" : `O AutoMod aplicaria: ${actionLabel(testVerdict.action)}`}</p><p className="m-0 mt-1 text-muted-foreground">{testVerdict.detail}{testVerdict.rule ? ` · Regra: ${testVerdict.rule}` : ""}</p></div> : null}
                <p className="m-0 text-xs text-muted-foreground">A prévia não inclui flood ou repetição, pois essas regras dependem do histórico real de mensagens.</p>
              </Card>
              <Card className="space-y-3"><div className="flex items-start justify-between gap-3"><div><SectionTitle title="Atividade recente do AutoMod" /><p className="m-0 mt-1 text-sm text-muted-foreground">Eventos reais registrados pelo bot.</p></div><Button variant="ghost" size="sm" onClick={() => setSection("incidents")}>Abrir fila<ChevronRight className="size-4" /></Button></div><SecurityEventList events={events.filter((event) => event.module === "automod").slice(0, 8)} onReview={markReviewed} onOpen={goToEventModule} onLockdown={() => setConfirmAction("lockdown_on")} lockdown={lockdownActive} compact /></Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="entry" className="mt-5 space-y-5">
          <SectionHeading title="Entradas e proteção contra raid" description="Defina quando uma entrada parece suspeita e como o Wumpus deve responder." enabled={security.enabled} onEnabledChange={(value) => setModuleEnabled("security", value)} />
          <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <div className="space-y-5">
              <Card className="space-y-4">
                <SectionTitle title="Detectar uma raid" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField id="raid-join-limit" label="Entradas suspeitas" value={Number(security.config.raidJoinThreshold ?? 12)} min={2} max={500} onChange={(value) => updateConfig("security", { raidJoinThreshold: value })} />
                  <NumberField id="raid-window" label="Dentro de (segundos)" value={Number(security.config.raidWindowSeconds ?? 60)} min={5} max={3600} onChange={(value) => updateConfig("security", { raidWindowSeconds: value })} />
                </div>
                <p className="m-0 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{raidResponseDescription(asString(security.config.response, "lockdown_review"))} O alerta começa em {Number(security.config.raidJoinThreshold ?? 12)} entradas em {Number(security.config.raidWindowSeconds ?? 60)} segundos.</p>
                <Field id="raid-response" label="Resposta ao detectar"><NativeSelect id="raid-response" value={asString(security.config.response, "lockdown_review")} onChange={(event) => updateConfig("security", { response: event.target.value })}><option value="alert">Enviar alerta para a equipe</option><option value="lockdown_review">Ativar lockdown e pedir revisão</option><option value="auto">Aplicar timeout automaticamente</option></NativeSelect></Field>
                {asString(security.config.response) === "auto" ? <div className="rounded-lg border border-warn/30 bg-warn/10 p-3"><ToggleRow label="Confirmo o timeout automático de raid" description="O bot pode limitar membros que entrarem durante a detecção. Confira hierarquia e permissões antes de ativar." checked={Boolean(security.config.autoResponseConfirmed)} onChange={(value) => updateConfig("security", { autoResponseConfirmed: value })} /></div> : null}
                <div className="grid gap-3 sm:grid-cols-2"><NumberField id="account-age" label="Idade mínima da conta (horas)" value={Number(security.config.minAccountAgeHours ?? 24)} min={0} max={87600} onChange={(value) => updateConfig("security", { minAccountAgeHours: value })} hint="0 desliga" /><NumberField id="quarantine-duration" label="Timeout da quarentena (minutos)" value={Number(security.config.timeoutMinutes ?? 60)} min={1} max={40320} onChange={(value) => updateConfig("security", { timeoutMinutes: value })} /></div>
                <ToggleRow label="Isolar contas abaixo da idade mínima" description="Registra o alerta e aplica timeout às contas novas demais." checked={Boolean(security.config.quarantineNewMembers)} onChange={(value) => updateConfig("security", { quarantineNewMembers: value })} />
              </Card>
              <Card className="space-y-4"><SectionTitle title="Quem recebe e quem é confiável" /><Field id="alert-channel" label="Canal de alertas"><DiscordSelect id="alert-channel" kind="text" value={asString(security.config.alertChannelId)} onChange={(alertChannelId) => updateConfig("security", { alertChannelId })} placeholder="Selecione um canal" /></Field><div><Label>Cargos avisados</Label><DiscordMultiSelect value={asList(security.config.alertStaffRoleIds)} onChange={(alertStaffRoleIds) => updateConfig("security", { alertStaffRoleIds })} placeholder="Adicionar cargo da equipe…" /></div><div><Label>Cargos confiáveis</Label><DiscordMultiSelect value={asList(security.config.trustedRoleIds)} onChange={(trustedRoleIds) => updateConfig("security", { trustedRoleIds })} placeholder="Adicionar cargo confiável…" /></div></Card>
            </div>
            <div className="space-y-5">
              <Card className="space-y-4"><div><SectionTitle title="Teste de cenário" /><p className="m-0 mt-1 text-sm text-muted-foreground">Simulação local dos limites. Não altera permissões nem publica alertas no Discord.</p></div><NumberField id="raid-sim-count" label="Quantas pessoas entram" value={raidTestCount} min={0} max={1000} onChange={setRaidTestCount} /><Button variant="outline" onClick={() => { const threshold = Number(security.config.raidJoinThreshold ?? 12); const response = asString(security.config.response, "lockdown_review"); setRaidTestResult(raidTestCount < threshold ? `Não atingiria o limite de ${threshold} entradas.` : response === "lockdown_review" ? `Atingiria o limite de ${threshold}; o bot ativaria o lockdown.` : response === "auto" ? security.config.autoResponseConfirmed ? `Atingiria o limite; o bot aplicaria timeout aos membros que entrarem durante a detecção.` : "Atingiria o limite, mas timeout automático está aguardando confirmação." : `Atingiria o limite; o bot enviaria um alerta para a equipe.`); }}>Simular detecção de raid</Button>{raidTestResult ? <p className="m-0 rounded-lg bg-muted px-3 py-2 text-sm" role="status">{raidTestResult}</p> : null}</Card>
              <Card className="space-y-3"><SectionTitle title="Checklist de configuração" /><CheckLine ok={Boolean(asString(security.config.alertChannelId))} label="Canal para receber alertas selecionado" /><CheckLine ok={asList(security.config.trustedRoleIds).length > 0} label="Cargos da equipe definidos como confiáveis" /><CheckLine ok={asString(security.config.response) !== "auto" || Boolean(security.config.autoResponseConfirmed)} label="Timeout automático de raid confirmado, se selecionado" /></Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="verification" className="mt-5 space-y-5">
          <SectionHeading title="Verificação de membros" description="Restrinja o acesso de novos membros até que confirmem pelo painel no Discord." enabled={Boolean(security.config.verificationEnabled)} onEnabledChange={(value) => { if (value) void publishVerification(); else setConfirmAction("restore_verification"); }} />
          <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <Card className="space-y-4">
              <SectionTitle title="Preparar a verificação" />
              <p className="m-0 text-sm text-muted-foreground">Na ativação, o Wumpus registra as permissões atuais para poder restaurá-las depois. Escolha os destinos antes de publicar.</p>
              <Field id="verification-channel" label="Canal do painel"><DiscordSelect id="verification-channel" kind="text" value={verificationChannelId} onChange={setVerificationChannelId} placeholder="Selecione um canal" /></Field>
              <Field id="verified-role" label="Cargo concedido após a confirmação"><DiscordSelect id="verified-role" kind="role" value={verifiedRoleId} onChange={setVerifiedRoleId} placeholder="Selecione um cargo" /></Field>
              <div className="rounded-lg border border-border px-3 py-3"><SectionTitle title="Antes de ativar" /><div className="mt-2 space-y-2"><CheckLine ok={Boolean(verificationChannelId)} label="Canal de verificação escolhido" /><CheckLine ok={Boolean(verifiedRoleId)} label="Cargo verificado escolhido" /><PermissionCheckInline label="Gerenciar canais" value={permissions?.manageChannels ?? null} botStatus={readiness?.status ?? "unknown"} /><PermissionCheckInline label="Gerenciar cargos" value={permissions?.manageRoles ?? null} botStatus={readiness?.status ?? "unknown"} /></div></div>
              <div className="flex flex-wrap gap-2"><Button onClick={() => void publishVerification()} disabled={actionBusy || !verificationChannelId || !verifiedRoleId || permissions?.manageChannels === false || permissions?.manageRoles === false}>{security.config.verificationEnabled ? "Publicar painel novamente" : "Ativar e publicar painel"}</Button>{security.config.verificationEnabled ? <Button variant="outline" onClick={() => setConfirmAction("restore_verification")} disabled={actionBusy}>Restaurar permissões</Button> : null}</div>
              {security.config.verificationEnabled ? <p className="m-0 flex items-center gap-2 text-sm text-ok"><CircleCheck className="size-4" />Verificação marcada como ativa na configuração.</p> : null}
            </Card>
            <div className="space-y-4"><Card className="space-y-3"><SectionTitle title="O que muda no Discord" /><p className="m-0 text-sm leading-6 text-muted-foreground">O bot restringe a visualização dos canais para @everyone e libera o cargo selecionado após a confirmação. Canais criados enquanto a verificação estiver ativa também recebem a regra.</p><p className="m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm">Confira o acesso dos cargos de equipe antes de ativar. Use “Restaurar permissões” para desfazer as alterações salvas pelo Wumpus.</p></Card><Card className="space-y-3"><SectionTitle title="Permissões do bot" /><PermissionStatus label="Gerenciar canais" value={permissions?.manageChannels ?? null} botStatus={readiness?.status ?? "unknown"} /><PermissionStatus label="Gerenciar cargos" value={permissions?.manageRoles ?? null} botStatus={readiness?.status ?? "unknown"} /><p className="m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm">Para conceder o cargo, o cargo mais alto do Wumpus precisa ficar acima do cargo verificado. No Discord, ajuste essa ordem em Configurações do servidor &gt; Cargos.</p></Card></div>
          </div>
        </TabsContent>

        <TabsContent value="antinuke" className="mt-5 space-y-5">
          <SectionHeading title="Anti-nuke" description="Receba alertas sobre mudanças destrutivas e configure uma resposta proporcional." enabled={security.enabled} onEnabledChange={(value) => setModuleEnabled("security", value)} />
          <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <div className="space-y-5">
              <Card className="space-y-4"><SectionTitle title="O que monitorar" /><div className="divide-y divide-border"><ToggleRow label="Banimentos em massa" description="Conta banimentos realizados em sequência." checked={security.config.alertOnMassBan !== false} onChange={(value) => updateConfig("security", { alertOnMassBan: value })} /><ToggleRow label="Exclusão de canais" checked={security.config.alertOnMassChannelDelete !== false} onChange={(value) => updateConfig("security", { alertOnMassChannelDelete: value })} /><ToggleRow label="Exclusão de cargos" checked={security.config.alertOnMassRoleDelete !== false} onChange={(value) => updateConfig("security", { alertOnMassRoleDelete: value })} /><ToggleRow label="Criação de webhooks" checked={security.config.alertOnMassWebhookCreate !== false} onChange={(value) => updateConfig("security", { alertOnMassWebhookCreate: value })} /><ToggleRow label="Criação de convites" checked={security.config.alertOnMassInviteCreate !== false} onChange={(value) => updateConfig("security", { alertOnMassInviteCreate: value })} /><ToggleRow label="Menções repetidas a @everyone" checked={security.config.alertOnEveryoneMentions !== false} onChange={(value) => updateConfig("security", { alertOnEveryoneMentions: value })} /></div></Card>
              <Card className="space-y-4"><SectionTitle title="Limites de detecção" /><div className="grid gap-3 sm:grid-cols-2"><NumberField id="nuke-threshold" label="Ações suspeitas" value={Number(security.config.nukeActionThreshold ?? 5)} min={2} max={100} onChange={(value) => updateConfig("security", { nukeActionThreshold: value })} /><NumberField id="nuke-window" label="Dentro de (segundos)" value={Number(security.config.nukeWindowSeconds ?? 30)} min={5} max={3600} onChange={(value) => updateConfig("security", { nukeWindowSeconds: value })} /></div><Field id="lockdown-message" label="Mensagem durante o lockdown"><Textarea id="lockdown-message" value={asString(security.config.lockdownMessage)} maxLength={1000} rows={3} onChange={(event) => updateConfig("security", { lockdownMessage: event.target.value })} /></Field></Card>
              <Card className="space-y-4"><SectionTitle title="Confiança e alertas" /><div><Label>Cargos protegidos contra alertas</Label><DiscordMultiSelect value={asList(security.config.trustedRoleIds)} onChange={(trustedRoleIds) => updateConfig("security", { trustedRoleIds })} placeholder="Adicionar cargo confiável…" /></div><div><Label>Cargos liberados de verificações de @everyone</Label><DiscordMultiSelect value={asList(security.config.whitelistRoleIds)} onChange={(whitelistRoleIds) => updateConfig("security", { whitelistRoleIds })} placeholder="Adicionar cargo liberado…" /></div><Field id="nuke-alert-channel" label="Canal de alertas"><DiscordSelect id="nuke-alert-channel" kind="text" value={asString(security.config.alertChannelId)} onChange={(alertChannelId) => updateConfig("security", { alertChannelId })} placeholder="Selecione um canal" /></Field><div><Label>Cargos avisados</Label><DiscordMultiSelect value={asList(security.config.alertStaffRoleIds)} onChange={(alertStaffRoleIds) => updateConfig("security", { alertStaffRoleIds })} placeholder="Adicionar cargo da equipe…" /></div></Card>
            </div>
            <div className="space-y-5">
              <Card className="space-y-4"><div><SectionTitle title="Banimento automático" /><p className="m-0 mt-1 text-sm text-muted-foreground">O Wumpus pode banir o autor quando detecta ações destrutivas repetidas. Essa ação é irreversível pelo painel.</p></div><ToggleRow label="Banir autores reincidentes automaticamente" description="Ative apenas depois de revisar os cargos confiáveis e o limiar de detecção." checked={Boolean(security.config.autoBanRepeatOffenders)} onChange={(value) => updateConfig("security", { autoBanRepeatOffenders: value, ...(value ? {} : { autoBanRepeatOffendersConfirmed: false }) })} /><div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2"><ToggleRow label="Confirmo o banimento automático do anti-nuke" description="Confirma apenas o banimento automático; não habilita timeout automático de raid." checked={Boolean(security.config.autoBanRepeatOffendersConfirmed)} onChange={(value) => updateConfig("security", { autoBanRepeatOffendersConfirmed: value })} disabled={!security.config.autoBanRepeatOffenders} /></div><PermissionCheckInline label="Banir membros" value={permissions?.banMembers ?? null} botStatus={readiness?.status ?? "unknown"} /></Card>
              <Card className="space-y-4"><div><SectionTitle title="Teste de cenário" /><p className="m-0 mt-1 text-sm text-muted-foreground">Prévia local dos limiares. Não cria incidente nem executa ação no Discord.</p></div><NumberField id="nuke-sim-count" label="Ações destrutivas simuladas" value={nukeTestCount} min={0} max={1000} onChange={setNukeTestCount} /><Button variant="outline" onClick={() => { const result = evaluateNuke(nukeTestCount, security.config, planAllows(guild.plan, "antiNuke")); setNukeTestResult(result.triggered ? result.lockdown ? "O limite seria atingido e o lockdown seria acionado pelo anti-nuke." : "O limite seria atingido; o plano atual só permite registrar o alerta." : "O limite não seria atingido."); }}>Simular detecção</Button>{nukeTestResult ? <p className="m-0 rounded-lg bg-muted px-3 py-2 text-sm" role="status">{nukeTestResult}</p> : null}{!planAllows(guild.plan, "antiNuke") ? <p className="m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm text-muted-foreground">O plano atual registra o alerta; não aplica contenção automática anti-nuke.</p> : null}</Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">Alertas e incidentes</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Eventos de segurança e AutoMod lidos da auditoria real do bot. Revisões ficam salvas por servidor.</p></div><div className="flex flex-wrap gap-2"><NativeSelect aria-label="Filtrar alertas por estado" className="w-auto min-w-36" value={eventFilter} onChange={(event) => setEventFilter(event.target.value as typeof eventFilter)}><option value="open">Aguardando revisão</option><option value="reviewed">Revisados</option><option value="all">Todos os eventos</option></NativeSelect><NativeSelect aria-label="Filtrar alertas por gravidade" className="w-auto min-w-36" value={eventSeverity} onChange={(event) => setEventSeverity(event.target.value)}><option value="all">Todas as gravidades</option><option value="critical">Críticos</option><option value="warning">Avisos</option><option value="info">Informativos</option></NativeSelect></div></div>
          {eventError ? <p className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{eventError}</p> : <SecurityEventList events={filteredEvents} onReview={markReviewed} onOpen={goToEventModule} onLockdown={() => setConfirmAction("lockdown_on")} lockdown={lockdownActive} />}
          <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground"><Eye className="size-3.5" />“Revisado” registra que a equipe viu o evento; não altera o estado do incidente no Discord.</p>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open && !actionBusy) setConfirmAction(null); }}>
        <DialogContent>
          <DialogTitle>{confirmAction === "lockdown_on" ? "Ativar lockdown neste servidor?" : confirmAction === "lockdown_off" ? "Encerrar o lockdown?" : "Restaurar permissões da verificação?"}</DialogTitle>
          <DialogDesc>{confirmAction === "lockdown_on" ? "O bot vai restringir o envio de mensagens nos canais públicos. A equipe ainda poderá orientar as pessoas pela mensagem de lockdown configurada." : confirmAction === "lockdown_off" ? "O bot vai restaurar as permissões de envio anteriores que foram salvas ao ativar o lockdown." : "O bot vai desfazer as restrições de visualização que foram salvas ao configurar a verificação de membros."} A ação só será considerada concluída quando o bot confirmar a execução.{confirmPermissionMissing ? " O Wumpus não possui as permissões necessárias neste servidor; corrija-as antes de continuar." : ""}</DialogDesc>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionBusy}>Cancelar</Button><Button variant={confirmAction === "lockdown_on" ? "destructive" : "default"} onClick={() => void executeConfirmedAction()} disabled={actionBusy || confirmPermissionMissing}>{actionBusy ? "Aguardando…" : confirmAction === "lockdown_on" ? "Ativar lockdown" : confirmAction === "lockdown_off" ? "Encerrar lockdown" : "Restaurar permissões"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeading({ title, description, enabled, onEnabledChange }: { title: string; description: string; enabled: boolean; onEnabledChange: (value: boolean) => void }) {
  return <header className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="m-0 text-xl font-semibold">{title}</h2><p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div><label className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm"><span>{enabled ? "Ligado" : "Pausado"}</span><Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label={`${enabled ? "Pausar" : "Ativar"} ${title}`} /></label></header>;
}

function SectionTitle({ title }: { title: string }) { return <h3 className="m-0 text-base font-semibold">{title}</h3>; }

function ToggleRow({ label, description, checked, onChange, disabled = false }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className={`flex min-h-12 items-center justify-between gap-4 py-2 ${disabled ? "opacity-55" : ""}`}><div className="min-w-0"><p className="m-0 text-sm font-medium">{label}</p>{description ? <p className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}</div><Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} /></div>;
}

function Field({ id, label, children, hint }: { id?: string; label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint ? <p className="m-0 text-xs text-muted-foreground">{hint}</p> : null}</div>;
}

function NumberField({ id, label, value, min, max, onChange, disabled = false, hint }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void; disabled?: boolean; hint?: string }) {
  return <Field id={id} label={label} hint={hint}><Input id={id} type="number" min={min} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} /></Field>;
}

function ListField({ id, label, hint, value, onChange, disabled }: { id: string; label: string; hint: string; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  const serialized = value.join("\n");
  const [draft, setDraft] = useState(serialized);
  useEffect(() => setDraft(serialized), [serialized]);
  return <Field id={id} label={label} hint={hint}><Textarea id={id} rows={4} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={() => onChange(draft.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))} /></Field>;
}

function ModuleStatusRow({ label, detail, enabled, onChange, icon: Icon }: { label: string; detail: string; enabled: boolean; onChange: (value: boolean) => void; icon: typeof Shield }) {
  return <div className="flex min-h-[4.4rem] items-center gap-3 py-3"><Icon className="size-4 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="m-0 text-sm font-medium">{label}</p><p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{detail}</p></div><Badge tone={enabled ? "ok" : "default"}>{enabled ? "Ligado" : "Pausado"}</Badge><Switch checked={enabled} onCheckedChange={onChange} aria-label={`${enabled ? "Pausar" : "Ativar"} ${label}`} /></div>;
}

function ReadinessRow({ label, detail, status, tone, onClick }: { label: string; detail: string; status: string; tone: "ok" | "warn"; onClick?: () => void }) {
  const content = <><div className="min-w-0 flex-1"><p className="m-0 text-sm font-medium">{label}</p><p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{detail}</p></div><Badge tone={tone}>{status}</Badge>{onClick ? <ChevronRight className="size-4 text-muted-foreground" /> : null}</>;
  return onClick ? <button type="button" onClick={onClick} className="flex min-h-[4.4rem] w-full items-center gap-3 py-3 text-left">{content}</button> : <div className="flex min-h-[4.4rem] items-center gap-3 py-3">{content}</div>;
}

function BotConnectionStatus({ readiness, error }: { readiness: Awaited<ReturnType<typeof getGuildProtectionReadiness>> | null; error: string | null }) {
  const status = readiness?.status ?? "unknown";
  const label = status === "online" ? "Conectado ao servidor" : status === "offline" ? "Sem conexão recente" : status === "not_installed" ? "Bot não está neste servidor" : "Estado indisponível";
  return <div className="flex items-start gap-3"><span className={`mt-1 size-2.5 rounded-full ${status === "online" ? "bg-ok" : status === "offline" || status === "not_installed" ? "bg-destructive" : "bg-warn"}`} /><div><p className="m-0 text-sm font-medium">{label}</p><p className="m-0 mt-1 text-xs text-muted-foreground">{readiness?.lastSeenAt ? `Último sinal ${formatRelative(readiness.lastSeenAt)}${readiness.pingMs == null ? "" : ` · ${readiness.pingMs} ms`}` : error ?? "Aguardando o primeiro sinal do bot."}</p></div></div>;
}

function PermissionStatus({ label, value, botStatus }: { label: string; value: boolean | null; botStatus: string }) {
  const missing = botStatus === "online" && value === false;
  const status = botStatus !== "online" || value === null ? "Aguardando" : value ? "Disponível" : "Falta permissão";
  return <div className="flex min-h-10 items-center justify-between gap-3 py-2"><span className="text-sm">{label}</span><Badge tone={missing ? "danger" : value ? "ok" : "default"}>{status}</Badge></div>;
}

function PermissionCheckInline({ label, value, botStatus }: { label: string; value: boolean | null; botStatus: string }) {
  const missing = botStatus === "online" && value === false;
  return <p className={`m-0 flex items-center gap-2 text-sm ${missing ? "text-destructive" : "text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${missing ? "bg-destructive" : value ? "bg-ok" : "bg-muted-foreground/50"}`} />{label}: {botStatus !== "online" || value === null ? "a confirmar" : value ? "disponível" : "falta ao bot"}</p>;
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) { return <p className={`m-0 flex items-center gap-2 text-sm ${ok ? "text-ok" : "text-muted-foreground"}`}><span className={`grid size-4 place-items-center rounded-full ${ok ? "bg-ok/15" : "bg-muted"}`}>{ok ? <Check className="size-3" /> : null}</span>{label}</p>; }

function PausedNotice({ name, onResume }: { name: string; onResume: () => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn/10 px-3 py-2.5"><p className="m-0 text-sm">{name} está pausado. As regras abaixo não estão sendo aplicadas pelo bot.</p><Button size="sm" variant="outline" onClick={onResume}>Ativar agora</Button></div>; }

function SecurityEventList({ events, onReview, onOpen, onLockdown, lockdown, compact = false }: { events: SecurityEvent[]; onReview: (id: number) => void; onOpen: (event: SecurityEvent) => void; onLockdown: () => void; lockdown: boolean; compact?: boolean }) {
  if (!events.length) return <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center"><ShieldCheck className="mx-auto size-6 text-ok" aria-hidden="true" /><p className="mb-0 mt-2 text-sm font-medium">Nenhum alerta nesta lista</p><p className="m-0 mt-1 text-xs text-muted-foreground">Os eventos reais do AutoMod e da proteção aparecem aqui.</p></div>;
  return <ul className="m-0 divide-y divide-border rounded-xl border border-border bg-card p-0">{events.map((event) => <li key={event.id} className="flex flex-wrap items-start gap-3 px-4 py-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${event.severity === "critical" ? "bg-destructive" : event.severity === "warning" ? "bg-warn" : "bg-info"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="m-0 text-sm font-semibold">{event.title}</p><Badge tone={event.severity === "critical" ? "danger" : event.severity === "warning" ? "warn" : "info"}>{severityLabel(event.severity)}</Badge><Badge>{event.module === "automod" ? "AutoMod" : "Segurança"}</Badge>{event.acknowledged ? <Badge tone="ok">Revisado</Badge> : null}</div><p className="m-0 mt-1 text-sm text-muted-foreground">{event.detail}</p><p className="m-0 mt-1 text-xs text-muted-foreground">{formatRelative(event.at)}{event.targetId ? ` · usuário ${event.targetId}` : ""}{event.channelId ? ` · canal ${event.channelId}` : ""}</p>{!compact || !event.acknowledged ? <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onOpen(event)}>Ver configuração<ArrowRight className="size-3.5" /></Button>{!event.acknowledged ? <Button size="sm" variant="ghost" onClick={() => onReview(event.id)}>Marcar como revisado</Button> : null}{event.eventType.startsWith("security_") && !lockdown && event.severity === "critical" ? <Button size="sm" variant="destructive" onClick={onLockdown}>Ativar lockdown</Button> : null}</div> : null}</div><span className="shrink-0 text-xs text-muted-foreground">{event.acknowledged ? "Visto" : "Pendente"}</span></li>)}</ul>;
}

function getPresetChanges(preset: PresetId, automodConfig: Record<string, unknown>, securityConfig: Record<string, unknown>, ticketsConfig: Record<string, unknown>) {
  const configs: Record<string, Record<string, unknown>> = { automod: automodConfig, security: securityConfig, tickets: ticketsConfig };
  return Object.entries(presets[preset].patch).flatMap(([module, patch]) => Object.entries(patch ?? {}).flatMap(([key, value]) => {
    const current = configs[module]?.[key];
    if (JSON.stringify(current) === JSON.stringify(value)) return [];
    return [{ key: `${module}.${key}`, module, label: configFieldLabels[key] ?? key, value: formatConfigValue(value) }];
  }));
}

function formatConfigValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "ligado" : "desligado";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "lista limpa";
  if (typeof value === "number") return String(value);
  if (value === "smart") return "Inteligente";
  if (value === "strict") return "Estrito";
  if (value === "passive") return "Só avisar";
  if (value === "delete") return "Apagar";
  if (value === "warn") return "Avisar";
  return String(value);
}

function severityLabel(severity: string) { return severity === "critical" ? "Crítico" : severity === "warning" ? "Aviso" : "Informativo"; }
function actionLabel(action?: string) { return action === "timeout" || action === "mute" ? "apagar e aplicar timeout" : action === "warn" ? "avisar" : "apagar"; }
function raidResponseDescription(response: string) { return response === "alert" ? "O bot avisa a equipe e não aplica restrições automaticamente." : response === "auto" ? "O bot aplica timeout a membros que entrarem durante a detecção; exige confirmação separada." : "Ao detectar uma raid, o bot ativa o lockdown e envia um alerta para revisão da equipe."; }
function channelLabel(channels: Array<{ id: string; name: string }>, id: string) { return channels.find((channel) => channel.id === id || channel.name === id)?.name ? `Painel em #${channels.find((channel) => channel.id === id || channel.name === id)?.name}` : "Canal não encontrado na lista sincronizada"; }

export default ProtectPage;
