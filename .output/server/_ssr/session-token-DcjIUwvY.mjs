import { n as jwtVerify, t as SignJWT } from "../_libs/jose.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-token-DcjIUwvY.js
/**
* Token de sessao assinado — a decisao de acesso sai do navegador.
*
* O problema que isto resolve: o painel decidia tudo no cliente. `isAdmin`,
* `plan` e a lista de servidores viviam no localStorage, entao bastava editar
* o campo `id` para o do dono e a checagem passava. Revalidar na leitura nao
* resolve: o dado continua vindo do cliente.
*
* Aqui o servidor assina (HMAC-SHA256, via `jose`) um retrato do usuario. O
* cliente pode GUARDAR o token, mas nao consegue alterar o conteudo sem
* invalidar a assinatura. O `userId` dentro dele veio do Discord, nao do
* navegador — entao `isPlatformOwner` passa a ser confiavel.
*
* LIMITE CONHECIDO: o token fica no localStorage, entao um XSS conseguiria
* le-lo. Isso e diferente do problema aqui (usuario editando o proprio estado
* para ganhar acesso) e a correcao e cookie `httpOnly`. Registrado como
* proximo passo, nao escondido.
*/
var ALG = "HS256";
var TTL = "7d";
/**
* Onde o token assinado fica guardado no navegador.
*
* Chave separada do estado do painel de proposito: assim limpar o estado (ou
* um `resetDemo`) nao apaga a sessao por acidente.
*/
var SESSION_TOKEN_KEY = "wumpus-session-token";
/**
* Segredo do servidor.
*
* Cai para `DISCORD_CLIENT_SECRET` quando o dedicado nao existe: os dois sao
* segredos so-do-servidor, e depender de configuracao nova faria o login
* parar de funcionar em ambiente que ja roda hoje.
*/
function sessionSecret() {
	const raw = (process.env.WUMPUS_SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || "").trim();
	if (!raw) return null;
	return new TextEncoder().encode(`wumpus-session-v1:${raw}`);
}
async function signSession(payload, secret) {
	return new SignJWT({ ...payload }).setProtectedHeader({ alg: ALG }).setIssuedAt().setExpirationTime(TTL).sign(secret);
}
function text(value, fallback = "") {
	return typeof value === "string" ? value : fallback;
}
/** Descarta servidor sem id — id vazio viraria chave de estado invalida. */
function parseGuilds(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => Boolean(item) && typeof item === "object").map((item) => ({
		id: text(item.id),
		name: text(item.name),
		iconUrl: typeof item.iconUrl === "string" ? item.iconUrl : null,
		owner: item.owner === true
	})).filter((guild) => guild.id.length > 0);
}
/**
* Verifica o token. Devolve `null` em QUALQUER falha — assinatura errada,
* expirado, formato invalido. Nunca lanca: quem chama trata `null` como
* "sem sessao", que e o comportamento seguro.
*/
async function verifySession(token, secret) {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
		const userId = text(payload.userId);
		if (!userId) return null;
		return {
			userId,
			username: text(payload.username),
			globalName: text(payload.globalName),
			avatar: typeof payload.avatar === "string" ? payload.avatar : null,
			guilds: parseGuilds(payload.guilds)
		};
	} catch {
		return null;
	}
}
//#endregion
export { verifySession as i, sessionSecret as n, signSession as r, SESSION_TOKEN_KEY as t };
