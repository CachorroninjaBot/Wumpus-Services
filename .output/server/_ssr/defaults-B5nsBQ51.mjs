//#region node_modules/.nitro/vite/services/ssr/assets/defaults-B5nsBQ51.js
var moduleDefaults = {
	servers: {
		announceJoinChannelId: "ch_geral",
		joinMessage: "Bem-vindo(a) à Aurora, {user}. Leia as regras em #regras e abra um ticket se precisar.",
		announceLeaveChannelId: "ch_logs",
		leaveMessage: "{user} saiu do servidor.",
		maintenanceMode: false,
		maintenanceMessage: "Estamos em manutenção. Voltamos em instantes.",
		defaultRoleIds: ["role_membro"]
	},
	tickets: {
		panelChannelId: "ch_atendimento",
		categoryId: "cat_tickets",
		panelFormat: "components_v2",
		panelTitle: "Central de atendimento",
		panelDescription: "Escolha o departamento. Um canal privado é criado só para você e a equipe.",
		panelAccentColor: "#7c5cff",
		staffRoleIds: ["role_staff", "role_suporte"],
		transcriptChannelId: "ch_transcripts",
		logChannelId: "ch_logs",
		aiSupportEnabled: true,
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
		reviewerRoleIds: ["role_staff"],
		reviewChannelId: "ch_forms",
		useAiPreReview: true,
		panelFormat: "components_v2",
		panelTitle: "Candidaturas",
		panelDescription: "Envie sua candidatura pelo formulário. Respondemos em até 7 dias.",
		panelAccentColor: "#7c5cff",
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
				maxLength: 500
			},
			{
				id: "nome",
				label: "Qual o seu nome ou apelido?",
				type: "short",
				required: true,
				options: [],
				maxLength: 100
			},
			{
				id: "motivo",
				label: "Por que quer fazer parte da equipe?",
				type: "paragraph",
				required: true,
				options: [],
				maxLength: 1e3
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
		lockdown: false
	},
	logs: {
		channelId: "ch_logs",
		retentionDays: 180,
		compactMode: false,
		logModeration: true,
		logMembers: true,
		logMessages: false,
		logRoles: true,
		logBans: true,
		logAutoMod: true,
		ignoreBotMessages: true
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
		autoSuggest: true
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
		defaultRoleIds: ["role_membro"],
		protectedRoleIds: ["role_owner", "role_staff"],
		allowAiDrafts: true
	}
};
function defaultsFor(module) {
	return { ...moduleDefaults[module] };
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
//#endregion
export { moduleDefaults as n, presets as r, defaultsFor as t };
