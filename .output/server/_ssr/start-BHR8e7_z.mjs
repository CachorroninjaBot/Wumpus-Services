import { n as createMiddleware, t as createCsrfMiddleware, u as setResponseHeader } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/start-BHR8e7_z.js
function dedupeSerializationAdapters(deduped, serializationAdapters) {
	for (let i = 0, len = serializationAdapters.length; i < len; i++) {
		const current = serializationAdapters[i];
		if (!deduped.has(current)) {
			deduped.add(current);
			if (current.extends) dedupeSerializationAdapters(deduped, current.extends);
		}
	}
}
var createStart = (getOptions) => {
	return {
		getOptions: async () => {
			const options = await getOptions();
			if (options.serializationAdapters) {
				const deduped = /* @__PURE__ */ new Set();
				dedupeSerializationAdapters(deduped, options.serializationAdapters);
				options.serializationAdapters = Array.from(deduped);
			}
			return options;
		},
		createMiddleware
	};
};
var csrfMiddleware = createCsrfMiddleware({ filter: (context) => context.handlerType === "serverFn" });
var securityHeaders = createMiddleware().server(async ({ next }) => {
	setResponseHeader("X-Content-Type-Options", "nosniff");
	setResponseHeader("X-Frame-Options", "DENY");
	setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin");
	setResponseHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	setResponseHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
	setResponseHeader("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
	setResponseHeader("Strict-Transport-Security", "max-age=31536000");
	return next();
});
var startInstance = createStart(() => ({ requestMiddleware: [csrfMiddleware, securityHeaders] }));
//#endregion
export { startInstance };
