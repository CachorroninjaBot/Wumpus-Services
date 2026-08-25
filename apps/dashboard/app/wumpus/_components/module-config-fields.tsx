"use client";

import type { WumpusModule } from "@huborder/core";
import { useState } from "react";
import type { WumpusChannel } from "../../../lib/wumpus-api";

type RoleOption = { roleId: string; name: string; color: number };
type ConfigScope = "server" | "group" | "exception";
type FieldKind = "toggle" | "number" | "text" | "textarea" | "list" | "channel" | "roles" | "select" | "color";
type FieldSection = "Essencial" | "Canais e equipe" | "Comportamento" | "Conteúdo e painel" | "Avançado";

type FieldDefinition = {
  label: string;
  description: string;
  section: FieldSection;
  kind?: FieldKind;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  disabled?: boolean;
};

type Props = {
  module: WumpusModule;
  config: Record<string, unknown>;
  channels?: WumpusChannel[];
  roles?: RoleOption[];
  scope?: ConfigScope;
};

const sectionOrder: FieldSection[] = ["Essencial", "Canais e equipe", "Comportamento", "Conteúdo e painel", "Avançado"];

const fields: Record<string, FieldDefinition> = {
  syncEveryMinutes: { label: "Frequência de sincronização", description: "Intervalo para atualizar membros, canais, cargos e saúde do servidor.", section: "Essencial", kind: "number", min: 5, max: 1440, unit: "min" },
  retentionDays: { label: "Retenção do histórico", description: "Por quanto tempo métricas e registros ficam disponíveis.", section: "Essencial", kind: "number", min: 30, max: 730, unit: "dias" },
  logChannelId: { label: "Canal de registros", description: "Recebe ações, alertas e mudanças feitas por este módulo.", section: "Canais e equipe", kind: "channel" },
  channelId: { label: "Canal de auditoria", description: "Canal onde os registros deste módulo serão enviados.", section: "Canais e equipe", kind: "channel" },
  alertChannelId: { label: "Canal de alertas", description: "Recebe incidentes de raid, nuke e contenções preventivas.", section: "Canais e equipe", kind: "channel" },
  reviewChannelId: { label: "Canal de revisão", description: "Fila privada para a equipe revisar itens pendentes.", section: "Canais e equipe", kind: "channel" },
  answerChannelId: { label: "Canal de respostas", description: "Canal autorizado para respostas da base de conhecimento.", section: "Canais e equipe", kind: "channel" },
  panelChannelId: { label: "Canal padrão do painel", description: "Destino sugerido ao publicar o painel para os membros.", section: "Canais e equipe", kind: "channel" },
  transcriptChannelId: { label: "Canal de transcrições", description: "Recebe o histórico dos atendimentos encerrados.", section: "Canais e equipe", kind: "channel" },
  categoryId: { label: "Categoria dos tickets", description: "Categoria onde novos canais privados serão criados.", section: "Canais e equipe", kind: "channel" },
  staffRoleIds: { label: "Cargos da equipe", description: "Cargos autorizados a operar e revisar este módulo.", section: "Canais e equipe", kind: "roles" },
  reviewerRoleIds: { label: "Cargos revisores", description: "Equipe que pode avaliar e decidir sobre envios.", section: "Canais e equipe", kind: "roles" },
  protectedRoleIds: { label: "Cargos protegidos", description: "Nunca serão alterados automaticamente pelo Wumpus.", section: "Canais e equipe", kind: "roles" },
  trustedRoleIds: { label: "Cargos confiáveis", description: "Ignorados pela contenção automática de segurança.", section: "Canais e equipe", kind: "roles" },
  defaultTimeoutMinutes: { label: "Timeout padrão", description: "Duração sugerida ao aplicar uma suspensão temporária.", section: "Comportamento", kind: "number", min: 1, max: 40320, unit: "min" },
  timeoutMinutes: { label: "Duração do timeout", description: "Tempo de contenção quando a ação escolhida usar timeout.", section: "Comportamento", kind: "number", min: 1, max: 1440, unit: "min" },
  messageLimit: { label: "Limite de mensagens", description: "Quantidade de mensagens permitida dentro da janela abaixo.", section: "Comportamento", kind: "number", min: 3, max: 30, unit: "mensagens" },
  windowSeconds: { label: "Janela de detecção", description: "Período usado para identificar flood e spam.", section: "Comportamento", kind: "number", min: 3, max: 120, unit: "seg" },
  duplicateLimit: { label: "Mensagens repetidas", description: "Repetições necessárias antes de considerar conteúdo duplicado.", section: "Comportamento", kind: "number", min: 2, max: 10, unit: "vezes" },
  blockInvites: { label: "Bloquear convites", description: "Remove convites de outros servidores conforme as exceções permitidas.", section: "Essencial", kind: "toggle" },
  action: { label: "Resposta automática", description: "O que fazer quando uma regra de AutoMod for acionada.", section: "Essencial", kind: "select", options: [
    { value: "delete", label: "Apagar mensagem", description: "Remove o conteúdo sem punir o membro." },
    { value: "warn", label: "Apagar e advertir", description: "Registra uma advertência no histórico." },
    { value: "timeout", label: "Aplicar timeout", description: "Contém o membro pelo tempo configurado." },
    { value: "review", label: "Enviar para revisão", description: "A equipe decide antes de qualquer punição." }
  ] },
  blockedTerms: { label: "Termos bloqueados", description: "Palavras ou expressões, uma por linha. Evite filtros amplos demais.", section: "Comportamento", kind: "list", placeholder: "termo proibido\noutra expressão" },
  blockedDomains: { label: "Domínios bloqueados", description: "Sites que não podem ser enviados, sem https://.", section: "Comportamento", kind: "list", placeholder: "site-suspeito.com\noutro-dominio.net" },
  provider: { label: "Motor de análise", description: "Escolha velocidade, custo e profundidade da leitura de imagens.", section: "Essencial", kind: "select", options: [
    { value: "hybrid", label: "Híbrido · recomendado", description: "Haiz extrai e a Groq revisa riscos e divergências." },
    { value: "haiz", label: "Haiz API", description: "Extração rápida de texto e links." },
    { value: "groq", label: "Visão Groq", description: "Análise visual completa pela IA." }
  ] },
  language: { label: "Idioma principal", description: "Ajuda o OCR a interpretar melhor o conteúdo.", section: "Essencial", kind: "select", options: [
    { value: "pt", label: "Português" }, { value: "en", label: "Inglês" }, { value: "es", label: "Espanhol" }, { value: "fr", label: "Francês" },
    { value: "de", label: "Alemão" }, { value: "it", label: "Italiano" }, { value: "ja", label: "Japonês" }, { value: "ko", label: "Coreano" },
    { value: "zh-cn", label: "Chinês simplificado" }, { value: "zh-tw", label: "Chinês tradicional" }, { value: "ar", label: "Árabe" }, { value: "ru", label: "Russo" }
  ] },
  model: { label: "Modelo da Groq", description: "Modelo visual usado quando a análise Groq estiver ativa.", section: "Avançado", kind: "text" },
  haizRequestsPerMinute: { label: "Limite da Haiz API", description: "Protege sua API contra excesso de chamadas simultâneas.", section: "Avançado", kind: "number", min: 1, max: 50, unit: "req/min" },
  retainExtractedText: { label: "Guardar texto extraído", description: "Salva o resultado do OCR para auditoria. Ative apenas se necessário.", section: "Avançado", kind: "toggle" },
  performanceWindowDays: { label: "Período de desempenho", description: "Janela usada nos indicadores de atividade da equipe.", section: "Comportamento", kind: "number", min: 7, max: 180, unit: "dias" },
  allowAiDrafts: { label: "Permitir rascunhos com IA", description: "A IA pode sugerir cargos, cores, ordem e permissões para revisão.", section: "Essencial", kind: "toggle" },
  allowAutomaticApply: { label: "Aplicação automática", description: "Bloqueada por segurança: rascunhos sempre exigem aprovação humana.", section: "Avançado", kind: "toggle", disabled: true },
  raidJoinThreshold: { label: "Limite de entradas", description: "Número de membros entrando na janela para abrir um incidente.", section: "Comportamento", kind: "number", min: 3, max: 500, unit: "entradas" },
  raidWindowSeconds: { label: "Janela de raid", description: "Período observado para detectar entradas em massa.", section: "Comportamento", kind: "number", min: 10, max: 3600, unit: "seg" },
  nukeActionThreshold: { label: "Limite de ações destrutivas", description: "Exclusões ou mudanças suspeitas necessárias para conter um nuke.", section: "Comportamento", kind: "number", min: 2, max: 100, unit: "ações" },
  nukeWindowSeconds: { label: "Janela de nuke", description: "Período observado para agrupar ações destrutivas.", section: "Comportamento", kind: "number", min: 10, max: 3600, unit: "seg" },
  response: { label: "Resposta de segurança", description: "Ação máxima permitida quando o risco for confirmado.", section: "Essencial", kind: "select", options: [
    { value: "alert", label: "Somente alertar", description: "Registra o incidente e chama a equipe." },
    { value: "timeout_suspect", label: "Timeout preventivo", description: "Contém temporariamente o suspeito e alerta a equipe." },
    { value: "lockdown_review", label: "Preparar lockdown", description: "Bloqueia o risco imediato e exige revisão humana." }
  ] },
  allowAnonymous: { label: "Aceitar denúncias anônimas", description: "Oculta a identidade do denunciante da visualização comum da equipe.", section: "Essencial", kind: "toggle" },
  appealCooldownDays: { label: "Intervalo entre apelações", description: "Tempo mínimo antes de uma nova apelação do mesmo membro.", section: "Comportamento", kind: "number", min: 0, max: 365, unit: "dias" },
  closeAfterHours: { label: "Encerramento por inatividade", description: "Sugere ou encerra tickets parados após este período.", section: "Comportamento", kind: "number", min: 1, max: 720, unit: "horas" },
  useAiPreReview: { label: "Pré-análise com IA", description: "Resume respostas e aponta riscos, sempre para decisão humana.", section: "Essencial", kind: "toggle" },
  panelFormat: { label: "Formato do painel", description: "Components V2 oferece uma experiência mais moderna no Discord.", section: "Conteúdo e painel", kind: "select", options: [
    { value: "components_v2", label: "Components V2 · recomendado" }, { value: "embed", label: "Embed tradicional" }
  ] },
  panelTitle: { label: "Título do painel", description: "Título exibido aos membros no Discord.", section: "Conteúdo e painel", kind: "text" },
  panelDescription: { label: "Descrição do painel", description: "Explique em poucas palavras o que acontece ao iniciar o fluxo.", section: "Conteúdo e painel", kind: "textarea" },
  panelAccentColor: { label: "Cor de destaque", description: "Cor usada no painel e na prévia.", section: "Conteúdo e painel", kind: "color" },
  requireApprovalForDestructiveActions: { label: "Exigir aprovação em ações destrutivas", description: "Impede automações de banir ou alterar estruturas sem revisão.", section: "Essencial", kind: "toggle" },
  webhookAllowlist: { label: "Destinos permitidos", description: "URLs autorizadas a receber webhooks, uma por linha.", section: "Canais e equipe", kind: "list", placeholder: "https://seu-sistema.com/webhook" },
  signingSecretConfigured: { label: "Assinatura configurada", description: "Indica se os webhooks possuem uma chave de verificação no servidor.", section: "Avançado", kind: "toggle" },
  useGroq: { label: "Usar Groq nas respostas", description: "Permite compor respostas usando apenas a base aprovada.", section: "Essencial", kind: "toggle" },
  requireApprovedArticles: { label: "Somente artigos aprovados", description: "Bloqueia rascunhos e conteúdo pendente nas respostas.", section: "Essencial", kind: "toggle" }
};

const presets: Partial<Record<WumpusModule, Array<{ name: string; description: string; values: Record<string, unknown> }>>> = {
  automod: [
    { name: "Equilibrado", description: "Boa proteção sem atrapalhar conversas normais.", values: { messageLimit: 6, windowSeconds: 10, duplicateLimit: 3, blockInvites: true, action: "delete", timeoutMinutes: 10 } },
    { name: "Comunidade aberta", description: "Mais tolerante para servidores sociais movimentados.", values: { messageLimit: 10, windowSeconds: 8, duplicateLimit: 5, blockInvites: false, action: "review", timeoutMinutes: 5 } },
    { name: "Proteção alta", description: "Resposta rápida para comunidades sob ataque.", values: { messageLimit: 4, windowSeconds: 10, duplicateLimit: 2, blockInvites: true, action: "timeout", timeoutMinutes: 30 } }
  ],
  security: [
    { name: "Recomendado", description: "Detecta ataques cedo e mantém revisão humana.", values: { raidJoinThreshold: 12, raidWindowSeconds: 60, nukeActionThreshold: 5, nukeWindowSeconds: 30, response: "lockdown_review", timeoutMinutes: 60 } },
    { name: "Servidor pequeno", description: "Limites ajustados para comunidades menores.", values: { raidJoinThreshold: 6, raidWindowSeconds: 90, nukeActionThreshold: 3, nukeWindowSeconds: 45, response: "timeout_suspect", timeoutMinutes: 30 } },
    { name: "Somente alertas", description: "Monitora tudo sem aplicar contenção automática.", values: { raidJoinThreshold: 12, raidWindowSeconds: 60, nukeActionThreshold: 5, nukeWindowSeconds: 30, response: "alert" } }
  ],
  ocr: [
    { name: "Híbrido", description: "Melhor equilíbrio entre extração e revisão visual.", values: { provider: "hybrid", language: "pt", haizRequestsPerMinute: 30, retainExtractedText: false } },
    { name: "Econômico", description: "Usa apenas sua API Haiz e não guarda o texto.", values: { provider: "haiz", language: "pt", haizRequestsPerMinute: 20, retainExtractedText: false } }
  ],
  tickets: [
    { name: "Atendimento padrão", description: "Fluxo seguro com encerramento após dois dias.", values: { closeAfterHours: 48, panelFormat: "components_v2", panelTitle: "Central de atendimento", panelDescription: "Abra um atendimento privado e fale com a equipe.", panelAccentColor: "#8175FF" } },
    { name: "Suporte rápido", description: "Para equipes com resposta e resolução no mesmo dia.", values: { closeAfterHours: 24, panelFormat: "components_v2", panelTitle: "Precisa de ajuda?", panelDescription: "Escolha um setor e converse em particular com nossa equipe.", panelAccentColor: "#4F8CFF" } }
  ],
  logs: [
    { name: "Essencial", description: "Mantém 90 dias de histórico.", values: { retentionDays: 90 } },
    { name: "Completo", description: "Mantém seis meses para auditorias longas.", values: { retentionDays: 180 } }
  ]
};

function inferredKind(value: unknown): FieldKind {
  if (typeof value === "boolean") return "toggle";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  return "text";
}

export function ModuleConfigFields({ module, config, channels = [], roles = [], scope = "server" }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...config }));
  const entries = Object.entries(config)
    .filter(([key]) => key !== "enabled")
    .map(([key, originalValue]) => ({ key, value: values[key] ?? originalValue, definition: fields[key] ?? { label: "Opção complementar", description: "Ajuste adicional disponibilizado para este recurso.", section: "Avançado" as const } }));
  const booleanKeys = entries.filter(({ value, definition }) => (definition.kind ?? inferredKind(value)) === "toggle").map(({ key }) => key);

  function update(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return <div className="config-builder">
    <input type="hidden" name="quickBooleanKeys" value={JSON.stringify(booleanKeys)} />

    {presets[module]?.length ? <section className="preset-section">
      <div className="config-section-heading"><div><span>Pronto</span><h3>Começar com uma configuração recomendada</h3></div><small>Todos os campos continuam editáveis.</small></div>
      <div className="preset-grid">{presets[module]!.map((preset) => <button type="button" key={preset.name} onClick={() => setValues((current) => ({ ...current, ...preset.values }))}><strong>{preset.name}</strong><span>{preset.description}</span><i>Usar esta configuração</i></button>)}</div>
    </section> : null}

    {sectionOrder.map((section) => {
      const sectionEntries = entries.filter(({ definition }) => definition.section === section);
      if (!sectionEntries.length) return null;
      return <section className="config-section" key={section}>
        <div className="config-section-heading"><div><span>{section === "Essencial" ? "01" : section === "Canais e equipe" ? "02" : section === "Comportamento" ? "03" : section === "Conteúdo e painel" ? "04" : "05"}</span><h3>{section}</h3></div><small>{sectionEntries.length} {sectionEntries.length === 1 ? "opção" : "opções"}</small></div>
        <div className="field-grid">{sectionEntries.map(({ key, value, definition }) => <ConfigField key={key} fieldKey={key} value={value} definition={definition} channels={channels} roles={roles} scope={scope} onChange={update} />)}</div>
      </section>;
    })}
  </div>;
}

type ConfigFieldProps = {
  fieldKey: string;
  value: unknown;
  definition: FieldDefinition;
  channels: WumpusChannel[];
  roles: RoleOption[];
  scope: ConfigScope;
  onChange: (key: string, value: unknown) => void;
};

function ConfigField({ fieldKey, value, definition, channels, roles, scope, onChange }: ConfigFieldProps) {
  const kind = definition.kind ?? inferredKind(value);
  const isResource = kind === "channel" || kind === "roles";
  if (scope === "group" && isResource) {
    const serialized = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    return <div className="resource-binding-field">
      <input type="hidden" name={`quick:${kind === "roles" ? "array" : "string"}:${fieldKey}`} value={serialized} />
      <span className="field-icon">LOCAL</span><div><strong>{definition.label}</strong><p>Escolha este recurso dentro de cada servidor, pois canais e cargos não são compartilhados pelo Discord.</p></div><span className="resource-badge">Por servidor</span>
    </div>;
  }

  if (kind === "toggle") return <label className="setting-toggle">
    <input type="checkbox" name={`quick:boolean:${fieldKey}`} checked={value === true} disabled={definition.disabled} onChange={(event) => onChange(fieldKey, event.target.checked)} />
    <span className="switch" aria-hidden="true"><i /></span>
    <span className="field-copy"><strong>{definition.label}</strong><small>{definition.description}</small></span>
  </label>;

  if (kind === "select") return <label className="setting-field">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <select name={`quick:string:${fieldKey}`} value={String(value ?? "")} onChange={(event) => onChange(fieldKey, event.target.value)}>
      {definition.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {definition.options?.find((option) => option.value === value)?.description ? <em>{definition.options.find((option) => option.value === value)!.description}</em> : null}
  </label>;

  if (kind === "channel") return <label className="setting-field">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <select name={`quick:string:${fieldKey}`} value={String(value ?? "")} onChange={(event) => onChange(fieldKey, event.target.value)}>
      <option value="">Nenhum canal selecionado</option>
      {channels.filter((channel) => fieldKey === "categoryId" ? channel.type === 4 : channel.type === 0 || channel.type === 5).map((channel) => <option key={channel.channelId} value={channel.channelId}>{fieldKey === "categoryId" ? "Categoria —" : "#"} {channel.name}</option>)}
    </select>
    {!channels.length ? <em>Os canais ainda não foram sincronizados. Atualize a página em alguns segundos.</em> : null}
  </label>;

  if (kind === "roles") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset className="role-picker">
      <legend><strong>{definition.label}</strong><small>{definition.description}</small></legend>
      <input type="hidden" name={`quick:array:${fieldKey}`} value={selected.join("\n")} />
      {roles.length ? <div>{roles.map((role) => {
        const checked = selected.includes(role.roleId);
        return <label key={role.roleId} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} onChange={() => onChange(fieldKey, checked ? selected.filter((id) => id !== role.roleId) : [...selected, role.roleId])} /><i style={{ background: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#7d8499" }} /><span>{role.name}</span></label>;
      })}</div> : <em>Nenhum cargo sincronizado ainda.</em>}
    </fieldset>;
  }

  if (kind === "list") {
    const list = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <label className="setting-field full-width">
      <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
      <textarea name={`quick:array:${fieldKey}`} value={list.join("\n")} onChange={(event) => onChange(fieldKey, event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} rows={Math.min(10, Math.max(4, list.length + 2))} placeholder={definition.placeholder ?? "Um item por linha"} />
      <em>{list.length} item(ns) configurado(s) · um por linha</em>
    </label>;
  }

  if (kind === "textarea") return <label className="setting-field full-width">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <textarea name={`quick:string:${fieldKey}`} value={String(value ?? "")} onChange={(event) => onChange(fieldKey, event.target.value)} rows={4} placeholder={definition.placeholder} />
    <em>{String(value ?? "").length} caracteres</em>
  </label>;

  if (kind === "color") return <label className="setting-field color-field">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <span><input name={`quick:string:${fieldKey}`} type="color" value={String(value ?? "#8175FF")} onChange={(event) => onChange(fieldKey, event.target.value)} /><b>{String(value ?? "#8175FF").toUpperCase()}</b></span>
  </label>;

  if (kind === "number") return <label className="setting-field number-field">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <span><input name={`quick:number:${fieldKey}`} type="number" min={definition.min} max={definition.max} step={definition.step ?? 1} value={Number(value ?? 0)} onChange={(event) => onChange(fieldKey, Number(event.target.value))} /><b>{definition.unit}</b></span>
    {definition.min !== undefined && definition.max !== undefined ? <em>Permitido: {definition.min}–{definition.max} {definition.unit}</em> : null}
  </label>;

  return <label className="setting-field">
    <span className="field-label"><strong>{definition.label}</strong><small>{definition.description}</small></span>
    <input name={`quick:string:${fieldKey}`} value={String(value ?? "")} onChange={(event) => onChange(fieldKey, event.target.value)} placeholder={definition.placeholder} />
  </label>;
}
