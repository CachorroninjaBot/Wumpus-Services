import { r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { c as string, n as array, o as object, r as boolean, s as record, u as unknown } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-validation-DKjJ331C.js
var moduleDefaults$2 = {
	servers: {
		announceJoinChannelId: "",
		joinMessage: "Bem-vindo(a) à Aurora, {user}. Leia as regras em #regras e abra um ticket se precisar.",
		announceLeaveChannelId: "",
		leaveMessage: "{user} saiu do servidor.",
		maintenanceMode: false,
		maintenanceMessage: "Estamos em manutenção. Voltamos em instantes.",
		defaultRoleIds: []
	},
	tickets: {
		panelChannelId: "",
		categoryId: "",
		panelFormat: "components_v2",
		panelTitle: "Central de atendimento",
		panelDescription: "Escolha o departamento. Um canal privado é criado só para você e a equipe.",
		panelAccentColor: "#28655b",
		staffRoleIds: [],
		transcriptChannelId: "",
		logChannelId: "",
		aiSupportEnabled: true,
		aiIncludeConversation: false,
		ticketMessageRetentionDays: 0,
		closeAfterHours: 48,
		autoCloseInactiveHours: 24,
		maxOpenPerUser: 1,
		pingStaffOnOpen: true,
		feedbackEnabled: true,
		reopenEnabled: true,
		priorityEnabled: true,
		slaWarningMinutes: 60,
		namingPattern: "atendimento-{user}",
		welcomeMessage: "Olá! Descreva o que você precisa com o máximo de detalhes. A equipe já foi notificada.",
		departments: [
			"Compras",
			"Suporte",
			"Denúncia"
		]
	},
	forms: {
		panelChannelId: "",
		reviewerRoleIds: [],
		reviewChannelId: "",
		useAiPreReview: true,
		panelFormat: "components_v2",
		panelTitle: "Candidaturas",
		panelDescription: "Envie sua candidatura pelo formulário. Respondemos em até 7 dias.",
		panelAccentColor: "#28655b",
		panelButtonLabel: "Preencher formulário",
		cooldownHours: 24,
		minAccountAgeDays: 7,
		notifyReviewers: true,
		requireReasonOnReject: true,
		maxSubmissionsPerUser: 3,
		questions: [
			"Qual o seu nome ou apelido?",
			"Por que quer fazer parte da equipe?",
			"Qual a sua experiência relevante?"
		],
		fields: [
			{
				id: "assunto",
				label: "Assunto",
				type: "select",
				required: true,
				options: [
					"Dúvida",
					"Denúncia",
					"Parceria"
				],
				maxLength: 500,
				minLength: 0,
				placeholder: "Escolha uma opção"
			},
			{
				id: "nome",
				label: "Qual o seu nome ou apelido?",
				type: "short",
				required: true,
				options: [],
				maxLength: 100,
				minLength: 0,
				placeholder: "Digite sua resposta"
			},
			{
				id: "motivo",
				label: "Por que quer fazer parte da equipe?",
				type: "paragraph",
				required: true,
				options: [],
				maxLength: 1e3,
				minLength: 0,
				placeholder: "Escreva com detalhes"
			}
		]
	},
	moderation: {
		logChannelId: "ch_mod",
		staffRoleIds: ["role_staff", "role_mod"],
		defaultTimeoutMinutes: 60,
		escalateAfterStrikes: 3,
		maxStrikesBeforeBan: 5,
		strikeExpiryDays: 30,
		banDeleteDays: 1,
		dmOnPunish: true,
		requireEvidence: false,
		pardonsEnabled: true,
		publicLogging: false
	},
	automod: {
		logChannelId: "ch_mod",
		ignoredChannelIds: ["ch_staff"],
		ignoredRoleIds: ["role_staff", "role_mod"],
		action: "delete",
		warnMessage: "Sua mensagem foi removida pelo filtro automático.",
		messageLimit: 6,
		windowSeconds: 10,
		duplicateLimit: 3,
		mentionLimit: 8,
		timeoutMinutes: 10,
		blockInvites: true,
		blockLinks: false,
		allowedDomains: [
			"aurora.store",
			"youtube.com",
			"youtu.be"
		],
		blockedTerms: [
			"golpe",
			"free nitro",
			"steamgift"
		],
		blockedDomains: [],
		capsThresholdPercent: 80,
		minLength: 0,
		maxLength: 0,
		antiGhostPing: true
	},
	security: {
		alertChannelId: "ch_alerts",
		alertStaffRoleIds: ["role_staff"],
		response: "lockdown_review",
		raidMode: "smart",
		raidJoinThreshold: 12,
		raidWindowSeconds: 60,
		minAccountAgeHours: 24,
		quarantineNewMembers: false,
		nukeActionThreshold: 5,
		nukeWindowSeconds: 30,
		timeoutMinutes: 60,
		trustedRoleIds: ["role_staff"],
		lockdownMessage: "O servidor está em modo de proteção. Aguarde a equipe resolver.",
		lockdown: false,
		autoBanRepeatOffenders: false,
		whitelistRoleIds: [],
		alertOnMassBan: true,
		alertOnMassChannelDelete: true,
		alertOnMassRoleDelete: true,
		alertOnMassWebhookCreate: true,
		alertOnMassInviteCreate: true,
		alertOnEveryoneMentions: true,
		autoResponseConfirmed: false,
		autoBanRepeatOffendersConfirmed: false,
		verificationChannelId: "",
		verifiedRoleId: "",
		verificationEnabled: false
	},
	logs: {
		channelId: "",
		retentionDays: 180,
		compactMode: false,
		logModeration: true,
		logMembers: true,
		logMessages: false,
		logVoice: false,
		logRoles: true,
		logChannels: true,
		logBans: true,
		logAutoMod: true,
		ignoreBotMessages: true,
		ignoreChannelIds: [],
		logThreadEvents: true,
		logStageEvents: true,
		logScheduledEvents: true,
		includeTimestamp: true,
		mentionOnCritical: false,
		ignoredUserIds: [],
		ignoredRoleIds: [],
		ignoredChannelIds: [],
		mentionRoleId: ""
	},
	staff: {
		staffRoleIds: [
			"role_staff",
			"role_suporte",
			"role_mod"
		],
		logChannelId: "ch_staff",
		responseTimeGoalMinutes: 30,
		maxConcurrentTickets: 5,
		inactivityDays: 14,
		requireReason: true,
		pingOnClaim: true,
		autoArchiveDays: 7
	},
	knowledge: {
		answerChannelId: "ch_geral",
		useAi: true,
		requireApprovedArticles: true,
		minQuestionLength: 12,
		cooldownSeconds: 20,
		autoSuggest: true,
		mentionRequired: false,
		suggestInAllChannels: false,
		respondInAllChannels: false,
		maxArticlesPerSearch: 5,
		similarityThreshold: .6,
		logSearches: false
	},
	statistics: {
		retentionDays: 180,
		anonymizeUsers: true,
		trackMessages: true,
		trackJoins: true,
		trackTickets: true,
		digestChannelId: "ch_staff",
		digestHourUtc: 12,
		highlightTopMembers: 5
	},
	roles: {
		defaultRoleIds: [],
		protectedRoleIds: ["role_owner", "role_staff"],
		allowAiDrafts: true
	}
};
function defaultsFor(module) {
	return { ...moduleDefaults$2[module] };
}
var presets = {
	community: {
		label: "Comunidade",
		blurb: "Spam e convites bloqueados, raid inteligente, tickets simples.",
		patch: {
			automod: {
				blockInvites: true,
				blockLinks: false,
				action: "delete",
				capsThresholdPercent: 85,
				mentionLimit: 6
			},
			security: {
				raidMode: "smart",
				raidJoinThreshold: 15,
				minAccountAgeHours: 12
			},
			tickets: {
				slaWarningMinutes: 120,
				departments: ["Suporte", "Denúncia"]
			}
		}
	},
	shop: {
		label: "Loja",
		blurb: "SLA curto, departamentos de compras, links permitidos só da loja.",
		patch: {
			automod: {
				blockInvites: true,
				blockLinks: true,
				allowedDomains: [
					"aurora.store",
					"mercadopago.com",
					"stripe.com"
				],
				action: "delete"
			},
			security: {
				raidMode: "strict",
				raidJoinThreshold: 8,
				minAccountAgeHours: 48
			},
			tickets: {
				slaWarningMinutes: 30,
				departments: [
					"Compras",
					"Suporte",
					"Reembolso"
				]
			}
		}
	},
	rp: {
		label: "Roleplay",
		blurb: "Mais permissivo no chat, anti-raid estrito, denúncias com prioridade.",
		patch: {
			automod: {
				blockInvites: true,
				blockLinks: false,
				capsThresholdPercent: 100,
				mentionLimit: 12,
				action: "warn"
			},
			security: {
				raidMode: "strict",
				quarantineNewMembers: true,
				minAccountAgeHours: 72
			},
			tickets: {
				slaWarningMinutes: 45,
				departments: [
					"Denúncia",
					"Whitelist",
					"Staff"
				]
			}
		}
	}
};
var moduleDefaults = Object.fromEntries(Object.entries({
	servers: {
		syncEveryMinutes: 60,
		syncRoles: true,
		syncChannels: true,
		announceJoinChannelId: "",
		announceLeaveChannelId: "",
		nicknameOnJoin: false,
		joinMessage: "Bem-vindo(a) ao servidor, {user}!",
		leaveMessage: "{user} saiu do servidor.",
		maintenanceMode: false,
		maintenanceMessage: "O servidor está em manutenção. Volte mais tarde."
	},
	statistics: {
		retentionDays: 180,
		trackMessages: true,
		trackVoice: false,
		trackJoins: true,
		trackTickets: true,
		anonymizeUsers: true,
		digestChannelId: "",
		digestHourUtc: 12,
		exportFormat: "json",
		highlightTopMembers: 5,
		trackReactions: false,
		trackCommands: true
	},
	staff: {
		staffRoleIds: [],
		logChannelId: "",
		performanceWindowDays: 30,
		requireReason: true,
		inactivityDays: 14,
		pingOnClaim: true,
		shiftLogChannelId: "",
		autoArchiveDays: 7,
		escalationRoleId: "",
		maxConcurrentTickets: 5,
		responseTimeGoalMinutes: 30
	},
	roles: {
		allowAiDrafts: true,
		protectedRoleIds: [],
		syncNames: true,
		autoRemoveOnLeave: false,
		mentionableByDefault: false,
		hoistNewRoles: false,
		maxRolesPerMember: 25,
		autoSyncIntervalHours: 24,
		hierarchyLimit: 10,
		defaultRoleIds: []
	},
	automations: {
		requireApprovalForDestructiveActions: true,
		logChannelId: "",
		dryRun: false,
		maxActionsPerHour: 30,
		allowChannelCreate: false,
		allowRoleAssign: true,
		notifyChannelId: "",
		retryOnFailure: true,
		maxRetries: 3,
		cooldownSeconds: 5,
		allowSendMessage: true,
		allowNicknameChange: false
	},
	integrations: {
		webhookAllowlist: [],
		signingSecretConfigured: false,
		allowIncoming: false,
		timeoutMs: 4e3,
		retryCount: 2,
		includeGuildId: true,
		rateLimitPerMinute: 60,
		healthCheckIntervalMinutes: 5,
		logPayloads: false,
		customHeaders: []
	},
	moderation: {
		logChannelId: "",
		staffRoleIds: [],
		defaultTimeoutMinutes: 60,
		escalateAfterStrikes: 3,
		banDeleteDays: 1,
		dmOnPunish: true,
		requireEvidence: false,
		appealChannelId: "",
		autoUnmuteAfterTimeout: true,
		strikeExpiryDays: 30,
		publicLogging: false,
		pardonsEnabled: true,
		maxStrikesBeforeBan: 5
	},
	automod: {
		logChannelId: "",
		messageLimit: 6,
		windowSeconds: 10,
		duplicateLimit: 3,
		blockInvites: true,
		action: "delete",
		timeoutMinutes: 10,
		blockedTerms: [],
		blockedDomains: [],
		ignoredChannelIds: [],
		ignoredRoleIds: [],
		mentionLimit: 8,
		scanImages: true,
		warnMessage: "Sua mensagem foi removida pelo filtro automático.",
		blockLinks: false,
		allowedDomains: [],
		capsThresholdPercent: 70,
		minLength: 0,
		maxLength: 0,
		antiGhostPing: true
	},
	security: {
		alertChannelId: "",
		raidJoinThreshold: 12,
		raidWindowSeconds: 60,
		nukeActionThreshold: 5,
		nukeWindowSeconds: 30,
		response: "lockdown_review",
		timeoutMinutes: 60,
		trustedRoleIds: [],
		minAccountAgeHours: 24,
		quarantineNewMembers: false,
		alertStaffRoleIds: [],
		raidMode: "smart",
		autoBanRepeatOffenders: false,
		whitelistRoleIds: [],
		alertOnMassBan: true,
		alertOnMassChannelDelete: true,
		lockdownMessage: "O servidor está em modo de proteção. Aguarde a equipe resolver.",
		autoResponseConfirmed: false,
		autoBanRepeatOffendersConfirmed: false,
		verificationChannelId: "",
		verifiedRoleId: "",
		verificationEnabled: false,
		alertOnMassRoleDelete: true,
		alertOnMassWebhookCreate: true,
		alertOnMassInviteCreate: true,
		alertOnEveryoneMentions: true
	},
	logs: {
		channelId: "",
		retentionDays: 180,
		logModeration: true,
		logMembers: true,
		logMessages: false,
		logVoice: false,
		logRoles: true,
		logChannels: true,
		logBans: true,
		ignoreBotMessages: true,
		ignoredUserIds: [],
		ignoredRoleIds: [],
		ignoredChannelIds: [],
		ignoreChannelIds: [],
		logThreadEvents: true,
		logStageEvents: true,
		logScheduledEvents: true,
		logAutoMod: true,
		compactMode: false,
		includeTimestamp: true,
		mentionOnCritical: false,
		mentionRoleId: ""
	},
	tickets: {
		panelChannelId: "",
		categoryId: "",
		staffRoleIds: [],
		transcriptChannelId: "",
		logChannelId: "",
		aiSupportEnabled: true,
		closeAfterHours: 48,
		panelFormat: "components_v2",
		panelTitle: "Central de atendimento",
		panelDescription: "Abra um atendimento privado e fale com a equipe.",
		panelAccentColor: "#28655b",
		feedbackEnabled: true,
		maxOpenPerUser: 1,
		pingStaffOnOpen: true,
		namingPattern: "atendimento-{user}",
		welcomeMessage: "Olá! Descreva o que você precisa. A equipe já foi notificada.",
		autoCloseInactiveHours: 24,
		reopenEnabled: true,
		satisfactionSurvey: true,
		priorityEnabled: true,
		tags: [],
		departments: [
			"Suporte geral",
			"Denuncias",
			"Parcerias"
		],
		slaWarningMinutes: 60,
		escalationRoleId: ""
	},
	forms: {
		panelChannelId: "",
		reviewerRoleIds: [],
		reviewChannelId: "",
		useAiPreReview: false,
		panelFormat: "components_v2",
		panelTitle: "Candidaturas",
		panelDescription: "Envie sua candidatura pelo formulario seguro.",
		panelAccentColor: "#28655b",
		panelButtonLabel: "Preencher formulário",
		cooldownHours: 24,
		minAccountAgeDays: 0,
		notifyReviewers: true,
		autoRejectAfterDays: 14,
		requireReasonOnReject: true,
		anonymousSubmissions: false,
		maxSubmissionsPerUser: 3,
		archiveApprovedAfterDays: 90,
		questions: [
			"Qual o seu nome ou apelido?",
			"Por que quer fazer parte da equipe?",
			"Qual a sua experiência relevante?"
		],
		fields: [
			{
				id: "assunto",
				label: "Assunto",
				type: "select",
				required: true,
				options: [
					"Duvida",
					"Denuncia",
					"Parceria",
					"Suporte tecnico"
				],
				maxLength: 500,
				minLength: 0,
				placeholder: "Escolha uma opção"
			},
			{
				id: "nome",
				label: "Qual o seu nome ou apelido?",
				type: "short",
				required: true,
				options: [],
				maxLength: 100,
				minLength: 0,
				placeholder: "Digite sua resposta"
			},
			{
				id: "motivo",
				label: "Por que quer fazer parte da equipe?",
				type: "paragraph",
				required: true,
				options: [],
				maxLength: 1e3,
				minLength: 0,
				placeholder: "Escreva com detalhes"
			},
			{
				id: "experiencia",
				label: "Qual a sua experiencia relevante?",
				type: "paragraph",
				required: true,
				options: [],
				maxLength: 1e3,
				minLength: 0,
				placeholder: "Conte sua experiência"
			}
		]
	},
	knowledge: {
		answerChannelId: "",
		useAi: true,
		requireApprovedArticles: true,
		mentionRequired: false,
		minQuestionLength: 12,
		cooldownSeconds: 20,
		preferFastModel: true,
		fallbackMessage: "",
		maxArticlesPerSearch: 5,
		similarityThreshold: .6,
		autoSuggest: true,
		suggestInAllChannels: false,
		respondInAllChannels: false,
		includeArticleLink: true,
		logSearches: false,
		logChannelId: ""
	},
	ocr: {
		provider: "hybrid",
		language: "pt",
		model: "",
		retainExtractedText: false,
		maxImageMb: 8,
		reviewChannelId: "",
		confidenceThreshold: .7,
		cacheResults: true,
		cacheTtlMinutes: 60,
		autoDeleteSuspicious: false,
		logChannelId: ""
	}
}).map(([moduleName, defaults]) => [moduleName, {
	...defaults,
	...moduleDefaults$2[moduleName]
}]));
var enumValues = {
	action: [
		"delete",
		"warn",
		"timeout",
		"review"
	],
	raidMode: [
		"smart",
		"strict",
		"passive"
	],
	response: [
		"alert",
		"lockdown_review",
		"auto"
	],
	panelFormat: ["components_v2", "embed"],
	type: [
		"short",
		"paragraph",
		"select"
	]
};
function matchesDefault(value, example, depth = 0, key = "", requireKeys = false) {
	if (depth > 8) return false;
	if (Array.isArray(example)) {
		if (!Array.isArray(value) || value.length > 100) return false;
		const itemExample = example[0];
		return itemExample === void 0 ? value.every((item) => typeof item === "string" && item.length <= 256) : value.every((item) => matchesDefault(item, itemExample, depth + 1, "", key !== "fields"));
	}
	if (example !== null && typeof example === "object") {
		if (!value || typeof value !== "object" || Array.isArray(value)) return false;
		const record = value;
		const keys = Object.keys(example);
		return Object.keys(record).every((key) => keys.includes(key)) && (!requireKeys || keys.every((key) => key in record)) && keys.every((childKey) => !(childKey in record) || matchesDefault(record[childKey], example[childKey], depth + 1, childKey));
	}
	if (typeof example === "string") return typeof value === "string" && value.length <= 4e3 && (!enumValues[key] || enumValues[key].includes(value));
	if (typeof example === "number") return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9;
	if (typeof example === "boolean") return typeof value === "boolean";
	return value === example;
}
var modulesSchema = record(string(), record(string(), unknown())).superRefine((modules, ctx) => {
	for (const [moduleName, config] of Object.entries(modules)) {
		const defaults = moduleDefaults[moduleName];
		if (!defaults) {
			ctx.addIssue({
				code: "custom",
				message: `Módulo desconhecido: ${moduleName}.`
			});
			continue;
		}
		if (Object.keys(config).some((key) => key !== "enabled" && !(key in defaults))) {
			ctx.addIssue({
				code: "custom",
				message: `A configuração de ${moduleName} contém campos desconhecidos.`
			});
			continue;
		}
		if ("enabled" in config && typeof config.enabled !== "boolean") ctx.addIssue({
			code: "custom",
			message: `O campo enabled de ${moduleName} precisa ser booleano.`
		});
		for (const [key, value] of Object.entries(config)) if (key !== "enabled" && !matchesDefault(value, defaults[key])) ctx.addIssue({
			code: "custom",
			message: `Valor inválido para ${moduleName}.${key}.`
		});
	}
});
var publishInputSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	name: string().max(100).optional(),
	modules: modulesSchema,
	articles: array(object({
		id: string().min(1).max(100),
		title: string().max(200),
		body: string().max(8e3),
		tags: array(string().max(64)).max(25),
		category: string().max(80).optional(),
		exampleQuestions: array(string().max(200)).max(12).optional(),
		approved: boolean()
	}).strict()).max(200).optional()
}).strict().superRefine((input, ctx) => {
	if (JSON.stringify(input).length > 64e3) ctx.addIssue({
		code: "custom",
		message: "A configuração excede o limite de tamanho."
	});
	const fields = input.modules.forms?.fields;
	if (!Array.isArray(fields)) return;
	const textFields = fields.filter((field) => field && typeof field === "object" && field.type !== "select");
	const selectFields = fields.filter((field) => field && typeof field === "object" && field.type === "select");
	if (fields.length > 10 || textFields.length > 5 || selectFields.length > 5) ctx.addIssue({
		code: "custom",
		message: "O Discord aceita até 5 perguntas de texto e 5 escolhas por formulário."
	});
	fields.forEach((field, index) => {
		if (!field || typeof field !== "object") return;
		const row = field;
		if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 45) ctx.addIssue({
			code: "custom",
			message: `A pergunta ${index + 1} precisa ter um rótulo de até 45 caracteres.`
		});
		if (typeof row.placeholder === "string" && row.placeholder.length > 100) ctx.addIssue({
			code: "custom",
			message: `O exemplo da pergunta ${index + 1} deve ter até 100 caracteres.`
		});
		if (row.type === "select") {
			const options = Array.isArray(row.options) ? row.options : [];
			if (options.length < 2 || options.length > 25 || options.some((option) => typeof option !== "string" || option.length > 100)) ctx.addIssue({
				code: "custom",
				message: `A pergunta ${index + 1} precisa ter de 2 a 25 opções de até 100 caracteres.`
			});
		} else {
			const minLength = typeof row.minLength === "number" ? row.minLength : 0;
			const maxLength = typeof row.maxLength === "number" ? row.maxLength : 1e3;
			if (minLength < 0 || minLength > maxLength || maxLength > 4e3) ctx.addIssue({
				code: "custom",
				message: `Confira o tamanho mínimo e máximo da pergunta ${index + 1}.`
			});
		}
	});
});
//#endregion
export { publishInputSchema as i, moduleDefaults$2 as n, presets as r, defaultsFor as t };
