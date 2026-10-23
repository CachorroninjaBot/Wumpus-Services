import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { f as plans, o as getStoredSessionToken, p as serverLimit, u as planById } from "./session-token-CaBlZnli.mjs";
import { S as Plus, Z as ArrowUp, et as ArrowDown } from "../_libs/lucide-react.mjs";
import { E as getDiscordGuildResources, F as getServerGroups, H as saveServerGroups, J as useActiveGuild, M as getGuildPlanUsage, Q as cn, R as renderTemplate, S as SearchSelect, X as useModule, Y as useGuildMembers, Z as useWumpus, _ as Button, b as DiscordSelect, d as Textarea, f as Dialog, g as Card, h as DialogTitle, l as Label, m as DialogDesc, p as DialogContent, s as Switch, v as Badge, w as asString, y as DiscordMultiSelect } from "./router-DjtjaZqs.mjs";
import { n as GuildBadge } from "./brand-E6aTdQpB.mjs";
import { t as useBilling } from "./use-billing-DZGU8iJ8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-3Jn16XGf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STORAGE_KEY = "wumpus-server-groups-v1";
var channelField = /(?:channel|category)ids?$/i;
var roleField = /roleids?$/i;
var keyFor = (ref) => `${ref.kind}:${ref.id}`;
function readGroups() {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}
function collectReferences(configs, guildId, roles, channels) {
	const found = /* @__PURE__ */ new Map();
	const add = (kind, value) => {
		if (typeof value !== "string" || !value.trim()) return;
		const id = value.trim();
		const named = (kind === "channel" ? channels[guildId] : roles[guildId])?.find((resource) => resource.id === id);
		found.set(`${kind}:${id}`, {
			kind,
			id,
			label: named?.name ?? id
		});
	};
	for (const module of Object.values(configs)) for (const [field, value] of Object.entries(module.config)) {
		const kind = roleField.test(field) ? "role" : channelField.test(field) ? "channel" : null;
		if (!kind) continue;
		if (Array.isArray(value)) value.forEach((item) => add(kind, item));
		else add(kind, value);
	}
	return [...found.values()];
}
function normalize(value) {
	return value.trim().replace(/^#|^@/, "").toLocaleLowerCase("pt-BR");
}
function mapConfig(config, refs, target, mapping, guildName) {
	const next = { ...config };
	const missing = [];
	for (const [field, value] of Object.entries(next)) {
		const kind = roleField.test(field) ? "role" : channelField.test(field) ? "channel" : null;
		if (!kind) continue;
		const mapOne = (sourceId) => {
			if (typeof sourceId !== "string" || !sourceId) return sourceId;
			const ref = refs.find((item) => item.kind === kind && item.id === sourceId);
			if (!ref) return sourceId;
			const resources = target[kind === "channel" ? "channels" : "roles"] ?? [];
			const selectedId = mapping[keyFor(ref)];
			if (selectedId && resources.some((resource) => resource.id === selectedId)) return selectedId;
			const matches = resources.filter((resource) => normalize(resource.name) === normalize(ref.label));
			if (matches.length === 1) return matches[0].id;
			missing.push(`${kind === "channel" ? "Canal/categoria" : "Cargo"} “${ref.label}” em ${guildName}`);
			return sourceId;
		};
		next[field] = Array.isArray(value) ? value.map(mapOne) : mapOne(value);
	}
	return {
		config: next,
		missing
	};
}
function ServerGroups() {
	const guilds = useWumpus((state) => state.guilds);
	const activeGuildId = useWumpus((state) => state.activeGuildId);
	const [groups, setGroups] = (0, import_react.useState)(() => typeof window === "undefined" ? [] : readGroups());
	const [selected, setSelected] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [targets, setTargets] = (0, import_react.useState)([activeGuildId]);
	const [createOpen, setCreateOpen] = (0, import_react.useState)(false);
	const [status, setStatus] = (0, import_react.useState)("");
	const [resourcesByGuild, setResourcesByGuild] = (0, import_react.useState)({});
	const activeGroup = groups.find((group) => group.id === selected);
	const resourceGuildIdsKey = activeGroup?.guildIds.filter((id) => id !== activeGuildId).join(",") ?? "";
	const availableGuilds = (0, import_react.useMemo)(() => guilds.filter((guild) => guild.id !== activeGuildId), [guilds, activeGuildId]);
	const state = useWumpus.getState();
	const refs = (0, import_react.useMemo)(() => {
		const modules = state.modules[activeGuildId];
		return modules ? collectReferences(modules, activeGuildId, state.roles, state.channels) : [];
	}, [
		activeGuildId,
		state.modules,
		state.roles,
		state.channels
	]);
	(0, import_react.useEffect)(() => {
		const token = getStoredSessionToken();
		if (!token || !activeGuildId) return;
		let mounted = true;
		getServerGroups({ data: {
			token,
			guildId: activeGuildId
		} }).then((value) => {
			if (mounted) {
				setGroups(value);
				localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
			}
		}).catch((error) => {
			if (mounted) setStatus(error instanceof Error ? error.message : "Não foi possível carregar os grupos.");
		});
		return () => {
			mounted = false;
		};
	}, [activeGuildId]);
	(0, import_react.useEffect)(() => {
		const token = getStoredSessionToken();
		if (!token || !activeGroup) return;
		let mounted = true;
		const targetsToLoad = resourceGuildIdsKey.split(",").filter((id) => id && !resourcesByGuild[id]);
		if (!targetsToLoad.length) return;
		Promise.all(targetsToLoad.map(async (guildId) => [guildId, await getDiscordGuildResources({ data: {
			token,
			guildId
		} })])).then((entries) => {
			if (mounted) setResourcesByGuild((current) => ({
				...current,
				...Object.fromEntries(entries)
			}));
		}).catch(() => {
			if (mounted) setStatus("Não foi possível carregar canais e cargos dos servidores. Verifique se o bot está conectado.");
		});
		return () => {
			mounted = false;
		};
	}, [
		activeGroup,
		resourceGuildIdsKey,
		activeGuildId,
		resourcesByGuild
	]);
	const save = (next) => {
		setGroups(next);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		const token = getStoredSessionToken();
		if (token) saveServerGroups({ data: {
			token,
			guildId: activeGuildId,
			groups: next
		} }).catch((error) => setStatus(error instanceof Error ? error.message : "Não foi possível salvar os grupos."));
	};
	const moveGroup = (index, direction) => {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= groups.length) return;
		const next = [...groups];
		[next[index], next[nextIndex]] = [next[nextIndex], next[index]];
		save(next);
		setStatus("Ordem dos grupos atualizada.");
	};
	const moveGuild = (group, index, direction) => {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= group.guildIds.length) return;
		const guildIds = [...group.guildIds];
		[guildIds[index], guildIds[nextIndex]] = [guildIds[nextIndex], guildIds[index]];
		save(groups.map((item) => item.id === group.id ? {
			...item,
			guildIds
		} : item));
		setStatus("Ordem dos servidores no grupo atualizada.");
	};
	const create = () => {
		const cleanName = name.trim();
		if (!cleanName || !targets.includes(activeGuildId)) return;
		const group = {
			id: `group-${Date.now().toString(36)}`,
			name: cleanName,
			guildIds: [...new Set(targets)],
			resourceMappings: {}
		};
		save([...groups, group]);
		setSelected(group.id);
		setName("");
		setStatus(`Grupo “${cleanName}” criado.`);
		setCreateOpen(false);
	};
	const setMapping = (targetGuildId, ref, resourceId) => {
		if (!activeGroup) return;
		save(groups.map((group) => group.id === activeGroup.id ? {
			...group,
			resourceMappings: {
				...group.resourceMappings,
				[targetGuildId]: {
					...group.resourceMappings?.[targetGuildId],
					[keyFor(ref)]: resourceId
				}
			}
		} : group));
	};
	const sync = () => {
		if (!activeGroup || !activeGroup.guildIds.includes(activeGuildId)) return;
		const sourceModules = useWumpus.getState().modules[activeGuildId];
		if (!sourceModules) return;
		const problems = [];
		let synced = 0;
		for (const guildId of activeGroup.guildIds) {
			if (guildId === activeGuildId) continue;
			const targetGuild = guilds.find((guild) => guild.id === guildId);
			const targetResources = resourcesByGuild[guildId];
			if (!targetResources) {
				problems.push(`Recursos de ${targetGuild?.name ?? guildId} ainda não carregaram.`);
				continue;
			}
			const targetProblems = [];
			const mappedModules = Object.entries(sourceModules).map(([moduleName, module]) => {
				const result = mapConfig(module.config, refs, targetResources, activeGroup.resourceMappings?.[guildId] ?? {}, targetGuild?.name ?? guildId);
				targetProblems.push(...result.missing);
				return [moduleName, {
					...module,
					config: result.config
				}];
			});
			if (targetProblems.length) {
				problems.push(...targetProblems);
				continue;
			}
			const state = useWumpus.getState();
			state.setActiveGuild(guildId);
			for (const [moduleName, source] of mappedModules) {
				const module = moduleName;
				state.updateConfig(module, source.config);
				state.setModuleEnabled(module, source.enabled);
			}
			synced++;
		}
		useWumpus.getState().setActiveGuild(activeGuildId);
		setStatus(problems.length ? `Sincronização parcial (${synced} servidor(es)). Resolva os recursos sem correspondência: ${[...new Set(problems)].slice(0, 5).join("; ")}${problems.length > 5 ? "…" : ""}` : `Configurações enviadas para ${synced} servidor(es).`);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "m-0 text-base font-semibold",
					children: "Grupos de configuração"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 max-w-2xl text-sm text-muted-foreground",
					children: "Organize servidores e sincronize os módulos escolhidos. Canais e cargos equivalentes continuam configurados por servidor."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => {
						setTargets(activeGuildId ? [activeGuildId] : []);
						setName("");
						setCreateOpen(true);
					},
					disabled: !activeGuildId,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
						"aria-hidden": "true",
						className: "size-4"
					}), " Criar grupo"]
				})]
			}),
			groups.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-label": "Grupos salvos",
				className: "grid gap-2 sm:grid-cols-2",
				children: groups.map((group, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("flex min-h-14 items-center gap-2 rounded-xl border px-2", selected === group.id ? "border-primary/60 bg-secondary/70" : "border-border bg-card"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": selected === group.id,
						onClick: () => {
							setSelected(group.id);
							setStatus("");
						},
						className: "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold",
							children: group.name.slice(0, 1).toUpperCase()
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-sm font-medium",
								children: group.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "block text-xs text-muted-foreground",
								children: [
									group.guildIds.length,
									" ",
									group.guildIds.length === 1 ? "servidor" : "servidores"
								]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": `Mover grupo ${group.name} para cima`,
							title: "Mover para cima",
							disabled: index === 0,
							onClick: () => moveGroup(index, -1),
							className: "grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": `Mover grupo ${group.name} para baixo`,
							title: "Mover para baixo",
							disabled: index === groups.length - 1,
							onClick: () => moveGroup(index, 1),
							className: "grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "size-4" })
						})]
					})]
				}, group.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-dashed border-border px-4 py-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm font-medium",
					children: "Nenhum grupo criado"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 text-sm text-muted-foreground",
					children: "Crie um grupo para organizar servidores e compartilhar configurações entre eles."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: createOpen,
				onOpenChange: setCreateOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "max-h-[calc(100dvh-2rem)] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Criar grupo de configuração" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "Escolha um nome e os servidores que vão compartilhar as configurações deste grupo." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "server-group-name",
									children: "Nome do grupo"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "server-group-name",
									autoFocus: true,
									value: name,
									onChange: (event) => setName(event.target.value),
									className: "mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm",
									placeholder: "Ex.: Comunidades parceiras"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
										className: "mb-2 text-sm font-medium",
										children: "Servidores no grupo"
									}), guilds.map((guild) => {
										const isActive = guild.id === activeGuildId;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/50",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: targets.includes(guild.id),
													disabled: isActive,
													onChange: (event) => setTargets(event.target.checked ? [.../* @__PURE__ */ new Set([...targets, guild.id])] : targets.filter((id) => id !== guild.id))
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
													tag: guild.tag ?? "W",
													iconUrl: guild.iconUrl,
													size: 30
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "min-w-0 flex-1 truncate text-sm font-medium",
													children: guild.name
												}),
												isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs text-muted-foreground",
													children: "Servidor atual"
												}) : null
											]
										}, guild.id);
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs leading-5 text-muted-foreground",
									children: "A ordem dos servidores pode ser ajustada depois. A sincronização adapta canais e cargos para cada comunidade."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-end gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										onClick: () => setCreateOpen(false),
										children: "Cancelar"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										onClick: create,
										disabled: !name.trim() || !targets.includes(activeGuildId),
										children: "Criar grupo"
									})]
								})
							]
						})
					]
				})
			}),
			activeGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "m-0 text-sm font-semibold",
							children: "Servidores do grupo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1 text-xs text-muted-foreground",
							children: "Use as setas para definir a ordem. O servidor atual é a origem da sincronização."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-2",
							children: activeGroup.guildIds.map((guildId, index) => {
								const guild = guilds.find((item) => item.id === guildId);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex min-h-11 items-center gap-2 rounded-lg bg-muted/40 px-2",
									children: [
										guild ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
											tag: guild.tag ?? "W",
											iconUrl: guild.iconUrl,
											size: 28
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "min-w-0 flex-1 truncate text-sm",
											children: [guild?.name ?? guildId, guildId === activeGuildId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-2 text-xs text-muted-foreground",
												children: "origem"
											}) : null]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-label": `Mover ${guild?.name ?? "servidor"} para cima`,
											disabled: index === 0,
											onClick: () => moveGuild(activeGroup, index, -1),
											className: "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-35",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-label": `Mover ${guild?.name ?? "servidor"} para baixo`,
											disabled: index === activeGroup.guildIds.length - 1,
											onClick: () => moveGuild(activeGroup, index, 1),
											className: "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-35",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "size-4" })
										}),
										guildId !== activeGuildId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => save(groups.map((group) => group.id === activeGroup.id ? {
												...group,
												guildIds: group.guildIds.filter((id) => id !== guildId)
											} : group)),
											className: "rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10",
											children: "Remover"
										}) : null
									]
								}, guildId);
							})
						}),
						availableGuilds.some((guild) => !activeGroup.guildIds.includes(guild.id)) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: availableGuilds.filter((guild) => !activeGroup.guildIds.includes(guild.id)).map((guild) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => save(groups.map((group) => group.id === activeGroup.id ? {
									...group,
									guildIds: [...group.guildIds, guild.id]
								} : group)),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), guild.name]
							}, guild.id))
						}) : null
					]
				}),
				refs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 rounded-xl bg-muted/35 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "m-0 text-sm font-semibold",
						children: "Correspondência de canais e cargos"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 mt-1 text-xs text-muted-foreground",
						children: "Correspondências únicas por nome são automáticas. Quando houver nomes diferentes ou duplicados, selecione o recurso correto."
					})] }), activeGroup.guildIds.filter((id) => id !== activeGuildId).map((guildId) => {
						const guild = guilds.find((item) => item.id === guildId);
						const available = resourcesByGuild[guildId];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 rounded-lg border border-border bg-card p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-sm font-semibold",
									children: guild?.name ?? guildId
								}),
								refs.map((ref) => {
									const resources = available?.[ref.kind === "channel" ? "channels" : "roles"] ?? [];
									const matches = resources.filter((resource) => normalize(resource.name) === normalize(ref.label));
									const value = activeGroup.resourceMappings?.[guildId]?.[keyFor(ref)] ?? (matches.length === 1 ? matches[0].id : "");
									if (matches.length === 1 && !activeGroup.resourceMappings?.[guildId]?.[keyFor(ref)]) return null;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "truncate text-xs text-muted-foreground",
											children: [
												ref.kind === "channel" ? "Canal/categoria" : "Cargo",
												": ",
												ref.label
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchSelect, {
											value,
											onChange: (id) => setMapping(guildId, ref, id),
											placeholder: available ? "Escolher correspondência" : "Carregando recursos do bot…",
											options: resources.map((resource) => ({
												id: resource.id,
												label: resource.name,
												description: resource.type === "category" ? "Categoria" : resource.type === "text" ? "Canal de texto" : void 0
											}))
										})]
									}, `${ref.kind}:${ref.id}`);
								}),
								!available ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "O bot precisa estar conectado para listar os recursos deste servidor."
								}) : null
							]
						}, guildId);
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: sync,
						disabled: !activeGroup.guildIds.includes(activeGuildId) || activeGroup.guildIds.length < 2,
						children: "Sincronizar configurações deste servidor"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => {
							save(groups.filter((group) => group.id !== activeGroup.id));
							setSelected("");
							setStatus("Grupo removido.");
						},
						children: "Remover grupo"
					})]
				})
			] }) : null,
			status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "m-0 text-sm text-muted-foreground",
				children: status
			}) : null
		]
	});
}
function SettingsPage() {
	const guild = useActiveGuild();
	const gid = useWumpus((s) => s.activeGuildId);
	const servers = useModule("servers");
	const rolesMod = useModule("roles");
	const logsMod = useModule("logs");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const members = useGuildMembers();
	const setPlan = useWumpus((s) => s.setPlan);
	const isOwner = useWumpus((s) => s.sessionUser).isAdmin;
	const sample = members[0];
	const preview = renderTemplate(asString(servers.config.joinMessage), { user: sample?.displayName ?? "membro" });
	const billing = useBilling(true);
	const catalog = billing.data?.plans?.length ? billing.data.plans : plans;
	const current = catalog.find((p) => p.id === guild.plan) ?? planById(guild.plan);
	const cap = serverLimit(guild.plan);
	const [usage, setUsage] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const token = getStoredSessionToken();
		if (!token || !gid) {
			setUsage(null);
			return;
		}
		let active = true;
		getGuildPlanUsage({ data: {
			token,
			guildId: gid
		} }).then((result) => {
			if (active) setUsage(result);
		}).catch(() => {
			if (active) setUsage(null);
		});
		return () => {
			active = false;
		};
	}, [gid]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-2xl font-semibold tracking-tight",
				children: "Configurações do servidor"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: [
					guild.name,
					" · ",
					guild.memberCount.toLocaleString("pt-BR"),
					" membros · ",
					guild.region
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-base font-semibold",
							children: "Licença WumPlus"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "primary",
							children: current.name
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: [
							"A cobrança é da ",
							billing.data?.storeName ?? "Hub Express",
							" na ShardPay. Este servidor está em ",
							current.price,
							".",
							" ",
							cap === null ? "Servidores ilimitados." : `Até ${cap} servidores.`,
							billing.loading ? " Lendo a loja…" : billing.data?.error ? ` ${billing.data.error}` : ""
						]
					}),
					usage ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "Servidores da conta"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								usage.serversUsed,
								usage.serverLimit === null ? " · sem limite" : ` de ${usage.serverLimit}`
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "OCR neste mês"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								usage.ocrLimit === null ? `${usage.ocrUsed} · ilimitado` : usage.ocrLimit === 0 ? "Incluído a partir do Pro" : `${usage.ocrUsed} de ${usage.ocrLimit}`
							]
						})]
					}) : null,
					usage?.serversOverLimit.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm text-muted-foreground",
						role: "status",
						children: [
							usage.serversOverLimit.join(", "),
							" ",
							usage.serversOverLimit.length === 1 ? "está" : "estão",
							" acima da cota. O Wumpus desativou o acesso e sairá ",
							usage.serversOverLimit.length === 1 ? "desse servidor" : "desses servidores",
							"."
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2",
						children: catalog.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm font-medium",
										children: plan.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-xs text-muted-foreground",
										children: plan.price
									})]
								}),
								guild.plan === plan.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ok",
									children: "deste servidor"
								}) : null,
								isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => setPlan(plan.id),
									children: "Aplicar"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: plan.checkoutUrl,
									target: "_blank",
									rel: "noreferrer",
									className: "text-sm text-primary",
									children: "Assinar"
								})
							]
						}, plan.id))
					}),
					!isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-xs text-muted-foreground",
						children: "O plano deste servidor acompanha a sua assinatura na ShardPay. Para mudar, assine outro plano — a liberação é automática."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm font-medium",
						children: "Assinaturas na loja"
					}), billing.data?.subscriptions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 m-0 space-y-1 p-0 text-sm",
						children: billing.data.subscriptions.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							sub.productName,
							" · ",
							sub.status,
							sub.discordUsername ? ` · ${sub.discordUsername}` : ""
						] }, sub.id))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 mb-0 text-sm text-muted-foreground",
						children: "Nenhuma assinatura ativa agora. Quem paga aparece aqui e o plano do servidor segue o produto."
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerGroups, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 font-medium",
						children: "Modo manutenção"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "O bot responde só com a mensagem abaixo."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(servers.config.maintenanceMode),
						onCheckedChange: (v) => updateConfig("servers", { maintenanceMode: v })
					})]
				}), servers.config.maintenanceMode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					defaultValue: asString(servers.config.maintenanceMessage),
					onBlur: (e) => updateConfig("servers", { maintenanceMessage: e.target.value })
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "m-0 text-base font-semibold",
					children: "Cargos padrão"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 text-sm text-muted-foreground",
					children: "Escolha cargos disponíveis neste servidor; eles serão resolvidos pelo nome nos grupos sincronizados."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos atribuídos a novos membros" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
					value: Array.isArray(rolesMod.config.defaultRoleIds) ? rolesMod.config.defaultRoleIds : [],
					onChange: (defaultRoleIds) => updateConfig("roles", { defaultRoleIds }),
					placeholder: "Adicionar cargo padrão…"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-0 text-base font-semibold",
						children: "Boas-vindas e despedidas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "-mt-3 mb-0 text-sm text-muted-foreground",
						children: "Escolha os canais e personalize o que o Wumpus envia quando alguém entra ou sai."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canal de boas-vindas" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
						kind: "text",
						value: asString(servers.config.announceJoinChannelId),
						onChange: (announceJoinChannelId) => updateConfig("servers", { announceJoinChannelId }),
						placeholder: "Selecione um canal"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Mensagem de boas-vindas · use ", "{user}"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						className: "mt-1",
						defaultValue: asString(servers.config.joinMessage),
						onBlur: (e) => updateConfig("servers", { joinMessage: e.target.value })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canal de despedida" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
						kind: "text",
						value: asString(servers.config.announceLeaveChannelId),
						onChange: (announceLeaveChannelId) => updateConfig("servers", { announceLeaveChannelId }),
						placeholder: "Desativar mensagem de despedida"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Mensagem de despedida · use ", "{user}"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						className: "mt-1",
						defaultValue: asString(servers.config.leaveMessage),
						onBlur: (e) => updateConfig("servers", { leaveMessage: e.target.value })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "Prévia da mensagem"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1",
							children: preview
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 font-medium",
						children: "Registros do servidor"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "Entradas, cargos e bans no canal escolhido."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: logsMod.enabled,
						onCheckedChange: (v) => setEnabled("logs", v)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "server-log-channel",
					children: "Canal de registros"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
					id: "server-log-channel",
					kind: "text",
					value: asString(logsMod.config.channelId),
					onChange: (channelId) => updateConfig("logs", { channelId }),
					placeholder: "Selecione um canal"
				})] })]
			})
		]
	}, gid);
}
//#endregion
export { SettingsPage as component };
