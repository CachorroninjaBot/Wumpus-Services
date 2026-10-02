import { i as __toESM } from "../_runtime.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-C1p7zOu_.mjs";
import { t as defaultsFor } from "./defaults-B5nsBQ51.mjs";
import { t as SESSION_TOKEN_KEY } from "./session-token-DcjIUwvY.mjs";
import { n as Route } from "./router-BRZ_yPpT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.discord.callback-UaAf8-HM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Monta o workspace de quem entrou com Discord.
*
* O que este arquivo fazia de errado, e que deixava o painel sem qualquer
* checagem:
*   - `isAdmin: true` para todo mundo → qualquer login virava admin;
*   - `plan: "pro"` fixo → todo servidor vinha com o plano pago liberado;
*   - `installed: true` fixo → servidor sem o bot aparecia como instalado;
*   - licencas todas `"active"` → nada refletia assinatura real.
*
* Agora quem decide e `resolveEntitlements`, e aqui so montamos o estado a
* partir dessa decisao. Se a pessoa nao tem assinatura ativa, ela entra com a
* lista de servidores VAZIA — nao com tudo liberado.
*/
var MODULES = [
	"servers",
	"tickets",
	"forms",
	"moderation",
	"automod",
	"security",
	"logs",
	"staff",
	"knowledge",
	"statistics",
	"roles"
];
function emptyModules() {
	const out = {};
	for (const key of MODULES) out[key] = {
		enabled: true,
		config: defaultsFor(key)
	};
	return out;
}
function buildWorkspace(user, guilds, entitlements) {
	const allowed = new Set(entitlements.guildIds);
	const entitled = guilds.filter((g) => allowed.has(g.id));
	const plan = entitlements.plan ?? "essencial";
	const list = entitled.map((g) => ({
		id: g.id,
		name: g.name,
		tag: g.name.slice(0, 2).toUpperCase(),
		memberCount: 0,
		online: 0,
		plan,
		preset: "community",
		installed: true,
		region: "Discord",
		iconUrl: g.iconUrl ?? null
	}));
	const modules = {};
	const channels = {};
	const roles = {};
	const formQuestions = {};
	for (const g of list) {
		modules[g.id] = emptyModules();
		channels[g.id] = [];
		roles[g.id] = [{
			id: `owner-${g.id}`,
			name: "Dono",
			color: "#f5d76e",
			position: 50,
			staff: true
		}];
		formQuestions[g.id] = [
			{
				id: "q1",
				label: "Qual o seu nome ou apelido?",
				required: true
			},
			{
				id: "q2",
				label: "Por que quer fazer parte da equipe?",
				required: true
			},
			{
				id: "q3",
				label: "Qual a sua experiência relevante?",
				required: true
			}
		];
	}
	const sessionUser = {
		id: user.id,
		username: user.username,
		globalName: user.globalName,
		isAdmin: entitlements.isOwner,
		signedIn: true,
		avatar: user.avatar ?? null
	};
	const licenses = list.map((g) => ({
		id: `lic-${g.id}`,
		guildName: g.name,
		plan,
		seats: 5,
		expires: "—",
		status: "active"
	}));
	const first = list[0];
	return {
		activeGuildId: first?.id ?? "",
		guilds: list,
		members: first ? [{
			id: user.id,
			guildId: first.id,
			username: user.username,
			displayName: user.globalName,
			hue: 262,
			roleIds: [`owner-${first.id}`],
			joinedAt: Date.now(),
			strikes: 0,
			status: "online",
			accountCreatedAt: Date.now(),
			timedOutUntil: null,
			banned: false
		}] : [],
		tickets: [],
		formQuestions,
		submissions: [],
		cases: [],
		automodHits: [],
		incidents: [],
		articles: [],
		logs: [{
			id: "l-login",
			guildId: first?.id ?? "",
			at: Date.now(),
			actor: user.globalName,
			category: "auth",
			summary: entitlements.isOwner ? "Entrou com Discord. Acesso de dono da plataforma." : `Entrou com Discord. ${entitlements.planName ?? "Sem assinatura"} · ${list.length} servidor(es).`
		}],
		modules,
		channels,
		roles,
		dashboardMembers: [{
			id: user.id,
			username: user.username,
			role: "owner",
			addedAt: Date.now()
		}],
		licenses,
		posts: [],
		publishQueue: [],
		recentMessages: [],
		sessionUser,
		theme: "dark"
	};
}
/**
* Sessao de servidor — onde a decisao de acesso realmente acontece.
*
* Antes disto, o painel montava tudo no cliente: o `userId`, o plano e a lista
* de servidores vinham do localStorage, entao editar o campo `id` para o do
* dono bastava para entrar na area restrita.
*
* Agora:
*   1. `startSession` troca o `code` do Discord e ASSINA a identidade. O
*      `userId` dentro do token veio do Discord — o navegador nao escolhe.
*   2. `resolveAccess` verifica a assinatura e recalcula os direitos a CADA
*      chamada: presenca do bot e assinatura ativa sao relidas do servidor.
*
* Isso importa porque plano vence e bot sai de servidor. Se o direito fosse
* gravado no token, um plano cancelado continuaria valendo ate o token expirar.
*/
/** Entra com o `code` do Discord e devolve um token assinado. */
var startSession = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("a024cd76e8fb329ddfcdb1c38889490faa45e6108c073941bd702ae77c295ec9"));
/**
* Resolve o que esta pessoa pode ver AGORA.
*
* Nao confia em nada que o cliente mandou alem do token assinado. Sem token
* valido devolve erro — nunca um acesso "vazio mas liberado".
*/
var resolveAccess = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("e23c83f0285558e3636ed3183139e0c2c2047f6b3edfcabceda3510897a0ba57"));
var KEY = "wumpus-demo-v2";
function CallbackPage() {
	const { code, error } = Route.useSearch();
	const navigate = useNavigate();
	const [msg, setMsg] = (0, import_react.useState)("Falando com o Discord…");
	(0, import_react.useEffect)(() => {
		if (error) {
			setMsg("Login cancelado no Discord.");
			return;
		}
		if (!code) {
			setMsg("Código ausente.");
			return;
		}
		(async () => {
			const started = await startSession({ data: { code } });
			if (!started.ok) {
				setMsg(started.error);
				return;
			}
			localStorage.setItem(SESSION_TOKEN_KEY, started.token);
			setMsg("Verificando assinatura e servidores…");
			const access = await resolveAccess({ data: { token: started.token } });
			if (!access.ok) {
				setMsg(access.error);
				return;
			}
			const slice = buildWorkspace({
				id: access.session.id,
				username: access.session.username,
				globalName: access.session.globalName,
				avatar: access.session.avatar
			}, access.guilds, access.entitlements);
			localStorage.setItem(KEY, JSON.stringify(slice));
			localStorage.removeItem("wumpus-demo-v1");
			navigate({ to: "/app" });
		})();
	}, [
		code,
		error,
		navigate
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-muted-foreground",
		children: msg
	});
}
//#endregion
export { CallbackPage as component };
