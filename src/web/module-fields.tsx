import type { ModuleId } from "../core/brand";

/* ------------------------------------------------------------------ *
 * Especificacao dos campos de cada modulo.
 *
 * Canais e cargos agora usam seletores visuais, alimentados pelo que o bot
 * sincroniza do Discord. O valor gravado continua sendo o ID numerico — o
 * que muda e como o usuario escolhe: em vez de colar um ID, ele ve o nome.
 * ------------------------------------------------------------------ */

export type GuildAssetsLite = {
  channels: Array<{ id: string; name: string; type: number; parentId: string | null; position: number }>;
  roles: Array<{ id: string; name: string; color: number; position: number; managed: boolean }>;
};

export type ChannelFilter = "text" | "category" | "any";

export type Field =
  | { key: string; label: string; type: "boolean"; help?: string }
  | { key: string; label: string; type: "number"; min?: number; max?: number; help?: string }
  | { key: string; label: string; type: "text"; maxLength?: number; placeholder?: string; help?: string }
  | { key: string; label: string; type: "longtext"; maxLength?: number; placeholder?: string; help?: string }
  | { key: string; label: string; type: "color"; help?: string }
  | { key: string; label: string; type: "select"; options: Array<{ value: string; label: string }>; help?: string }
  | { key: string; label: string; type: "list"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "channel"; filter?: ChannelFilter; help?: string }
  | { key: string; label: string; type: "role-list"; help?: string }
  | { key: string; label: string; type: "snowflake"; help?: string };

/** Tipos de canal do Discord que recebem mensagens (texto, anúncio, fórum). */
const TEXT_CHANNEL_TYPES = [0, 5, 15];
const CATEGORY_TYPE = 4;

const panelFormat: Field = {
  key: "panelFormat",
  label: "Formato do painel",
  type: "select",
  options: [
    { value: "components_v2", label: "Components V2 (moderno e interativo)" },
    { value: "embed", label: "Embed tradicional" }
  ],
  help: "Components V2 permite botões e layout mais rico."
};

const panelTitle: Field = { key: "panelTitle", label: "Título do painel", type: "text", maxLength: 100 };
const panelDescription: Field = {
  key: "panelDescription",
  label: "Descrição do painel",
  type: "longtext",
  maxLength: 800
};
const panelColor: Field = { key: "panelAccentColor", label: "Cor de destaque", type: "color" };

export const moduleFields: Record<ModuleId, Field[]> = {
  servers: [
    { key: "syncEveryMinutes", label: "Sincronizar a cada (minutos)", type: "number", min: 5, max: 1440 }
  ],
  statistics: [
    { key: "retentionDays", label: "Guardar histórico (dias)", type: "number", min: 30, max: 730 },
    { key: "trackMessages", label: "Contar mensagens", type: "boolean", help: "Apenas contagem. O conteúdo não é gravado." }
  ],
  staff: [
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list" },
    { key: "logChannelId", label: "Canal de registro", type: "channel" },
    { key: "performanceWindowDays", label: "Janela de desempenho (dias)", type: "number", min: 7, max: 180 }
  ],
  roles: [
    { key: "allowAiDrafts", label: "Permitir rascunhos com IA", type: "boolean", help: "A IA sugere; você aprova antes de aplicar." },
    { key: "syncNames", label: "Sincronizar nomes de cargos", type: "boolean" },
    { key: "protectedRoleIds", label: "Cargos protegidos", type: "role-list" }
  ],
  automations: [
    { key: "requireApprovalForDestructiveActions", label: "Exigir aprovação em ações destrutivas", type: "boolean" },
    { key: "logChannelId", label: "Canal de registro", type: "channel" }
  ],
  integrations: [
    { key: "webhookAllowlist", label: "Destinos permitidos", type: "list", placeholder: "https://exemplo.com/webhook" },
    { key: "signingSecretConfigured", label: "Assinatura configurada", type: "boolean", help: "Nunca coloque tokens aqui: apenas o indicador." }
  ],
  moderation: [
    { key: "logChannelId", label: "Canal de registros", type: "channel" },
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list" },
    { key: "defaultTimeoutMinutes", label: "Duração padrão do timeout (min)", type: "number", min: 1, max: 40320 }
  ],
  automod: [
    { key: "logChannelId", label: "Canal de registros", type: "channel" },
    { key: "action", label: "Ação ao detectar", type: "select", options: [
      { value: "delete", label: "Apagar a mensagem" },
      { value: "warn", label: "Avisar o autor" },
      { value: "timeout", label: "Aplicar timeout" },
      { value: "review", label: "Enviar para revisão" }
    ] },
    { key: "messageLimit", label: "Mensagens por janela", type: "number", min: 3, max: 30 },
    { key: "windowSeconds", label: "Janela (segundos)", type: "number", min: 3, max: 120 },
    { key: "duplicateLimit", label: "Repetições permitidas", type: "number", min: 2, max: 10 },
    { key: "timeoutMinutes", label: "Timeout ao punir (min)", type: "number", min: 1, max: 1440 },
    { key: "blockInvites", label: "Bloquear convites de outros servidores", type: "boolean" },
    { key: "blockedTerms", label: "Termos bloqueados", type: "list" },
    { key: "blockedDomains", label: "Domínios bloqueados", type: "list", placeholder: "exemplo.com" }
  ],
  security: [
    { key: "alertChannelId", label: "Canal de alertas", type: "channel" },
    { key: "response", label: "Resposta a incidentes", type: "select", options: [
      { value: "alert", label: "Apenas alertar a equipe" },
      { value: "timeout_suspect", label: "Timeout preventivo no suspeito" },
      { value: "lockdown_review", label: "Bloqueio preventivo e revisão" }
    ] },
    { key: "raidJoinThreshold", label: "Entradas para considerar raid", type: "number", min: 3, max: 500 },
    { key: "raidWindowSeconds", label: "Janela da raid (segundos)", type: "number", min: 10, max: 3600 },
    { key: "nukeActionThreshold", label: "Ações destrutivas para nuke", type: "number", min: 2, max: 100 },
    { key: "nukeWindowSeconds", label: "Janela do nuke (segundos)", type: "number", min: 10, max: 3600 },
    { key: "timeoutMinutes", label: "Timeout preventivo (min)", type: "number", min: 1, max: 1440 },
    { key: "trustedRoleIds", label: "Cargos confiáveis", type: "role-list", help: "Nunca entram em contenção automática." }
  ],
  logs: [
    { key: "channelId", label: "Canal de logs", type: "channel" },
    { key: "retentionDays", label: "Guardar logs (dias)", type: "number", min: 30, max: 730 },
    { key: "logModeration", label: "Registrar moderação", type: "boolean" },
    { key: "logMembers", label: "Registrar entradas e saídas", type: "boolean" },
    { key: "logMessages", label: "Registrar edições de mensagens", type: "boolean" }
  ],
  tickets: [
    { key: "panelChannelId", label: "Canal do painel", type: "channel" },
    { key: "categoryId", label: "Categoria dos atendimentos", type: "channel", filter: "category" },
    { key: "staffRoleIds", label: "Cargos de atendimento", type: "role-list" },
    { key: "transcriptChannelId", label: "Canal de transcrições", type: "channel" },
    { key: "logChannelId", label: "Canal dos logs de atendimento", type: "channel", help: "Onde o bot publica o resumo de cada atendimento com o botão de análise por IA." },
    { key: "aiSupportEnabled", label: "IA de apoio à equipe", type: "boolean", help: "Adiciona o botão de análise no log. A IA sugere; nunca responde ao cliente." },
    { key: "closeAfterHours", label: "Fechar após (horas)", type: "number", min: 1, max: 720 },
    { key: "feedbackEnabled", label: "Pedir feedback ao encerrar", type: "boolean" },
    panelFormat,
    panelTitle,
    panelDescription,
    panelColor
  ],
  forms: [
    { key: "reviewerRoleIds", label: "Cargos revisores", type: "role-list" },
    { key: "reviewChannelId", label: "Canal de revisão", type: "channel" },
    { key: "useAiPreReview", label: "Pré-análise com IA", type: "boolean" },
    panelFormat,
    panelTitle,
    panelDescription,
    panelColor
  ],
  knowledge: [
    { key: "answerChannelId", label: "Canal de respostas", type: "channel", help: "Só neste canal o bot responde usando artigos aprovados." },
    { key: "useAi", label: "Usar IA nas respostas", type: "boolean" },
    { key: "requireApprovedArticles", label: "Exigir artigos aprovados", type: "boolean" }
  ],
  ocr: [
    { key: "provider", label: "Provedor de leitura", type: "select", options: [
      { value: "hybrid", label: "Híbrido (leitura + revisão visual)" },
      { value: "haiz", label: "Somente leitura especializada" },
      { value: "groq", label: "Somente visão" }
    ] },
    { key: "language", label: "Idioma", type: "select", options: [
      { value: "pt", label: "Português" },
      { value: "en", label: "Inglês" },
      { value: "es", label: "Espanhol" }
    ] },
    { key: "model", label: "Modelo de visão", type: "text", maxLength: 120 },
    { key: "retainExtractedText", label: "Guardar o texto extraído", type: "boolean", help: "Desligado por padrão, por privacidade." }
  ]
};

/* ------------------------------------------------------------------ *
 * Seletores visuais
 * ------------------------------------------------------------------ */

export function readField(config: Record<string, unknown>, key: string): unknown {
  return config[key];
}

function matchesFilter(type: number, filter: ChannelFilter): boolean {
  if (filter === "category") return type === CATEGORY_TYPE;
  if (filter === "text") return TEXT_CHANNEL_TYPES.includes(type);
  return type !== CATEGORY_TYPE;
}

function roleColor(color: number): string {
  if (!color) return "var(--text-3)";
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Seletor de canal agrupado por categoria.
 *
 * Detalhe que evita perda de dado: se o valor atual nao estiver na lista
 * sincronizada (canal apagado, ou bot ainda sem sincronizar), ele vira uma
 * opcao propria. Assim abrir a tela nunca apaga uma configuracao valida.
 */
function ChannelSelect({
  id,
  value,
  assets,
  filter,
  disabled,
  onChange
}: {
  id: string;
  value: string;
  assets: GuildAssetsLite | null;
  filter: ChannelFilter;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const channels = (assets?.channels ?? []).filter((channel) => matchesFilter(channel.type, filter));

  if (!assets || (!channels.length && !value)) {
    return (
      <input
        id={id}
        value={value}
        placeholder="ID numérico do Discord"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const categories = [...channels]
    .filter((channel) => channel.type === CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position);
  const leaves = [...channels]
    .filter((channel) => channel.type !== CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position);
  const known = new Set(channels.map((channel) => channel.id));

  return (
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">— não definir —</option>
      {value && !known.has(value) ? <option value={value}>ID atual: {value}</option> : null}
      {categories.map((category) => {
        const children = leaves.filter((channel) => channel.parentId === category.id);
        return (
          <optgroup key={category.id} label={`# ${category.name}`}>
            <option value={category.id}># {category.name} (categoria)</option>
            {children.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {leaves.some((channel) => !channel.parentId || !categories.some((c) => c.id === channel.parentId)) ? (
        <optgroup label="Sem categoria">
          {leaves
            .filter((channel) => !channel.parentId || !categories.some((c) => c.id === channel.parentId))
            .map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
        </optgroup>
      ) : null}
    </select>
  );
}

/**
 * Seletor de cargos por marcacao.
 *
 * Cargos gerenciados por integracao aparecem desabilitados: nao fazem sentido
 * para equipe nem para confianca, e escolher um deles seria um erro silencioso.
 */
function RolePicker({
  value,
  assets,
  disabled,
  onChange
}: {
  value: string[];
  assets: GuildAssetsLite | null;
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  if (!assets || !assets.roles.length) {
    return (
      <input
        value={value.join(", ")}
        placeholder="IDs separados por vírgula"
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        }
      />
    );
  }

  const roles = [...assets.roles].sort((a, b) => b.position - a.position);
  const known = new Set(roles.map((role) => role.id));
  const unknown = value.filter((id) => !known.has(id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  }

  return (
    <div className="role-picker">
      {roles.map((role) => (
        <label key={role.id} className={role.managed ? "is-managed" : ""}>
          <input
            type="checkbox"
            checked={value.includes(role.id)}
            disabled={disabled || role.managed}
            onChange={() => toggle(role.id)}
          />
          <span className="role-dot" style={{ background: roleColor(role.color) }} />
          <span className="role-name">{role.name}</span>
          {role.managed ? <em>gerenciado</em> : null}
        </label>
      ))}
      {unknown.map((id) => (
        <label key={id}>
          <input type="checkbox" checked disabled={disabled} onChange={() => toggle(id)} />
          <span className="role-dot" style={{ background: "var(--text-3)" }} />
          <span className="role-name">ID atual: {id}</span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Renderizador
 * ------------------------------------------------------------------ */

export function ModuleFieldsForm({
  module,
  config,
  disabled,
  assets,
  scope = "server",
  onChange
}: {
  module: ModuleId;
  config: Record<string, unknown>;
  disabled: boolean;
  assets?: GuildAssetsLite | null;
  scope?: "server" | "group";
  onChange: (key: string, value: unknown) => void;
}) {
  const fields = moduleFields[module] ?? [];
  const hasAssets = Boolean(assets && (assets.channels.length || assets.roles.length));

  return (
    <div className="field-grid">
      {fields.map((field) => {
        const value = config[field.key];
        const id = `field-${field.key}`;

        if (field.type === "boolean") {
          return (
            <label className="field field-toggle" key={field.key}>
              <input
                type="checkbox"
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.checked)}
              />
              <span className="switch">
                <i />
              </span>
              <span className="field-text">
                <strong>{field.label}</strong>
                {field.help ? <small>{field.help}</small> : null}
              </span>
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <label className="field" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <select
                id={id}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        }

        if (field.type === "number") {
          return (
            <label className="field" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <input
                id={id}
                type="number"
                min={field.min}
                max={field.max}
                value={typeof value === "number" ? value : ""}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value === "" ? "" : Number(event.target.value))}
              />
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        }

        if (field.type === "color") {
          return (
            <label className="field" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <div className="color-field">
                <input
                  id={id}
                  type="color"
                  value={typeof value === "string" ? value : "#7c5cff"}
                  disabled={disabled}
                  onChange={(event) => onChange(field.key, event.target.value)}
                />
                <b>{typeof value === "string" ? value.toUpperCase() : "#7C5CFF"}</b>
              </div>
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        }

        if (field.type === "channel") {
          const filter = field.filter ?? "text";
          const text = typeof value === "string" ? value : "";

          // No escopo de GRUPO o valor e o NOME do canal. Um grupo cobre varios
          // servidores, e um ID fixo so valeria em um deles; com o nome, cada
          // servidor resolve para o seu proprio canal.
          if (scope === "group") {
            return (
              <label className="field" key={field.key} htmlFor={id}>
                <span>{field.label}</span>
                <div className="channel-name-field">
                  <b>{filter === "category" ? "🗂️" : "#"}</b>
                  <input
                    id={id}
                    value={text}
                    placeholder={filter === "category" ? "nome-da-categoria" : "logs"}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                  />
                </div>
                <small>
                  {field.help ? `${field.help} ` : ""}
                  Cada servidor usa o seu próprio canal com este nome. Se não existir, o bot fica sem canal.
                </small>
              </label>
            );
          }

          return (
            <label className="field" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <ChannelSelect
                id={id}
                value={text}
                assets={assets ?? null}
                filter={filter}
                disabled={disabled}
                onChange={(next) => onChange(field.key, next)}
              />
              <small>
                {field.help ? `${field.help} ` : ""}
                {hasAssets ? "" : "O bot ainda não sincronizou os canais deste servidor."}
              </small>
            </label>
          );
        }

        if (field.type === "role-list") {
          const list = Array.isArray(value) ? (value as unknown[]).map(String) : [];

          // No escopo de GRUPO o valor e o NOME dos cargos. Mesmo motivo dos
          // canais: cada servidor tem os seus proprios cargos, entao o grupo
          // guarda nomes e cada servidor resolve para os seus IDs.
          if (scope === "group") {
            return (
              <label className="field field-wide" key={field.key} htmlFor={id}>
                <span>{field.label}</span>
                <div className="channel-name-field">
                  <b>@</b>
                  <input
                    id={id}
                    value={list.join(", ")}
                    placeholder="equipe, moderador"
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(
                        field.key,
                        event.target.value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean)
                  )
                }
                  />
                </div>
                <small>
                  {field.help ? `${field.help} ` : ""}
                  Cada servidor usa os seus próprios cargos com estes nomes. Cargos de integração são ignorados.
                </small>
              </label>
            );
          }

          return (
            <div className="field field-wide" key={field.key}>
              <span>{field.label}</span>
              <RolePicker
                value={list}
                assets={assets ?? null}
                disabled={disabled}
                onChange={(next) => onChange(field.key, next)}
              />
              <small>
                {field.help ? `${field.help} ` : ""}
                {hasAssets ? "" : "O bot ainda não sincronizou os cargos deste servidor."}
              </small>
            </div>
          );
        }

        if (field.type === "list") {
          const list = Array.isArray(value) ? (value as unknown[]).map(String) : [];
          return (
            <label className="field field-wide" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <input
                id={id}
                value={list.join(", ")}
                placeholder={field.placeholder ?? "Separe por vírgula"}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    field.key,
                    event.target.value
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                  )
                }
              />
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        }

        if (field.type === "longtext") {
          const text = typeof value === "string" ? value : "";
          return (
            <label className="field field-wide" key={field.key} htmlFor={id}>
              <span>{field.label}</span>
              <textarea
                id={id}
                rows={3}
                value={text}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
              <small>
                {text.length}
                {field.maxLength ? `/${field.maxLength}` : ""}
              </small>
            </label>
          );
        }

        return (
          <label className="field" key={field.key} htmlFor={id}>
            <span>{field.label}</span>
            <input
              id={id}
              value={typeof value === "string" ? value : ""}
              placeholder={field.placeholder ?? (field.type === "snowflake" ? "ID numérico do Discord" : "")}
              maxLength={field.type === "text" ? field.maxLength : undefined}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            {field.help ? <small>{field.help}</small> : null}
          </label>
        );
      })}
    </div>
  );
}
