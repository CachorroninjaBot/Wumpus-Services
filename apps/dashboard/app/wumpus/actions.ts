"use server";

import { parseWumpusModuleConfig, wumpusModuleSchema } from "@huborder/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWumpusSession } from "../../lib/auth";
import {
  assignWumpusServer,
  createWumpusGroup,
  getWumpusGroup,
  listInstalledWumpusGuilds,
  publishWumpusPanel,
  removeWumpusServer,
  saveWumpusGroupModuleConfig,
  saveWumpusServerException,
  saveWumpusModuleConfig
} from "../../lib/wumpus-api";

function configurationFromForm(formData: FormData) {
  const advanced = String(formData.get("configuration") ?? "").trim();
  if (advanced) return JSON.parse(advanced) as Record<string, unknown>;
  const config: Record<string, unknown> = {};
  const booleanKeys = JSON.parse(String(formData.get("quickBooleanKeys") ?? "[]")) as unknown;
  if (!Array.isArray(booleanKeys) || !booleanKeys.every((key) => typeof key === "string")) throw new Error("invalid quick configuration");
  for (const key of booleanKeys) config[key] = formData.has(`quick:boolean:${key}`);
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string" || !name.startsWith("quick:")) continue;
    const [, type, key] = name.split(":", 3);
    if (!key || type === "boolean") continue;
    if (type === "number") config[key] = Number(value);
    if (type === "string") config[key] = value.trim();
    if (type === "array") config[key] = value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
  return config;
}

export async function saveModuleConfiguration(formData: FormData) {
  const guildId = String(formData.get("guildId") ?? "");
  const module = wumpusModuleSchema.safeParse(formData.get("module"));
  const enabled = formData.get("enabled") === "on";
  const session = await getWumpusSession();
  if (!session || !module.success || !/^\d{15,22}$/.test(guildId)) redirect("/wumpus?error=invalid_request");

  const isManager = session.guilds.some((guild) => guild.id === guildId);
  const isInstalled = (await listInstalledWumpusGuilds()).some((guild) => guild.guildId === guildId);
  if (!isManager || !isInstalled) redirect("/wumpus?error=access_denied");

  let config: Record<string, unknown>;
  try {
    config = parseWumpusModuleConfig(module.data, configurationFromForm(formData));
  } catch {
    redirect(`/wumpus/${guildId}/${module.data}?error=invalid_configuration`);
  }

  await saveWumpusModuleConfig({ guildId, module: module.data, enabled, config, userId: session.user.id });
  revalidatePath(`/wumpus/${guildId}`);
  revalidatePath(`/wumpus/${guildId}/${module.data}`);
  redirect(`/wumpus/${guildId}/${module.data}?saved=1`);
}

export async function createGroup(formData: FormData) {
  const session = await getWumpusSession();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "#8175FF").trim();
  if (!session || name.length < 2 || name.length > 60 || description.length > 280 || !/^#[0-9a-fA-F]{6}$/.test(color)) redirect("/wumpus?error=invalid_group");
  try {
    const { group } = await createWumpusGroup({ userId: session.user.id, name, description, color });
    redirect(`/wumpus/groups/${group.id}?created=1`);
  } catch {
    redirect("/wumpus?error=group_name_unavailable");
  }
}

export async function assignServerToGroup(formData: FormData) {
  const session = await getWumpusSession();
  const groupId = Number(formData.get("groupId"));
  const guildId = String(formData.get("guildId") ?? "");
  if (!session || !Number.isSafeInteger(groupId) || !/^\d{15,22}$/.test(guildId)) redirect("/wumpus?error=invalid_request");
  const installed = await listInstalledWumpusGuilds();
  if (!session.guilds.some((guild) => guild.id === guildId) || !installed.some((guild) => guild.guildId === guildId)) redirect("/wumpus?error=access_denied");
  await assignWumpusServer({ groupId, guildId, userId: session.user.id });
  revalidatePath("/wumpus");
  revalidatePath(`/wumpus/${guildId}`);
  revalidatePath(`/wumpus/groups/${groupId}`);
  redirect(`/wumpus/groups/${groupId}?server=assigned`);
}

export async function removeServerFromGroup(formData: FormData) {
  const session = await getWumpusSession();
  const groupId = Number(formData.get("groupId"));
  const guildId = String(formData.get("guildId") ?? "");
  if (!session || !Number.isSafeInteger(groupId) || !/^\d{15,22}$/.test(guildId)) redirect("/wumpus?error=invalid_request");
  await removeWumpusServer({ groupId, guildId, userId: session.user.id });
  revalidatePath("/wumpus");
  revalidatePath(`/wumpus/${guildId}`);
  revalidatePath(`/wumpus/groups/${groupId}`);
  redirect(`/wumpus/groups/${groupId}?server=removed`);
}

export async function saveGroupModuleConfiguration(formData: FormData) {
  const session = await getWumpusSession();
  const groupId = Number(formData.get("groupId"));
  const module = wumpusModuleSchema.safeParse(formData.get("module"));
  const enabled = formData.get("enabled") === "on";
  if (!session || !Number.isSafeInteger(groupId) || !module.success) redirect("/wumpus?error=invalid_request");
  try {
    const config = parseWumpusModuleConfig(module.data, configurationFromForm(formData));
    await saveWumpusGroupModuleConfig({ groupId, module: module.data, enabled, config, userId: session.user.id });
  } catch {
    redirect(`/wumpus/groups/${groupId}/${module.data}?error=invalid_configuration`);
  }
  revalidatePath(`/wumpus/groups/${groupId}`);
  revalidatePath(`/wumpus/groups/${groupId}/${module.data}`);
  redirect(`/wumpus/groups/${groupId}/${module.data}?saved=1`);
}

export async function saveServerException(formData: FormData) {
  const session = await getWumpusSession();
  const groupId = Number(formData.get("groupId"));
  const guildId = String(formData.get("guildId") ?? "");
  const module = wumpusModuleSchema.safeParse(formData.get("module"));
  const modeRaw = String(formData.get("mode") ?? "inherit");
  const mode = modeRaw === "disabled" || modeRaw === "override" ? modeRaw : "inherit";
  if (!session || !Number.isSafeInteger(groupId) || !/^\d{15,22}$/.test(guildId) || !module.success) redirect("/wumpus?error=invalid_request");
  try {
    const config = mode === "override" ? parseWumpusModuleConfig(module.data, configurationFromForm(formData)) : undefined;
    await saveWumpusServerException({ groupId, guildId, module: module.data, mode, enabled: formData.get("enabled") === "on", config, userId: session.user.id });
  } catch {
    redirect(`/wumpus/${guildId}/${module.data}?error=invalid_configuration`);
  }
  revalidatePath(`/wumpus/${guildId}`);
  revalidatePath(`/wumpus/${guildId}/${module.data}`);
  redirect(`/wumpus/${guildId}/${module.data}?saved=1`);
}

export async function publishMemberPanel(formData: FormData) {
  const session = await getWumpusSession();
  const guildId = String(formData.get("guildId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const module = String(formData.get("panelModule") ?? "");
  const format = String(formData.get("format") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "");
  if (!session || !/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || (module !== "tickets" && module !== "forms") || (format !== "components_v2" && format !== "embed")) redirect("/wumpus?error=invalid_request");
  const installed = await listInstalledWumpusGuilds();
  if (!session.guilds.some((guild) => guild.id === guildId) || !installed.some((guild) => guild.guildId === guildId)) redirect("/wumpus?error=access_denied");
  await publishWumpusPanel({ guildId, userId: session.user.id, module, channelId, format, title, description, accentColor });
  revalidatePath(`/wumpus/${guildId}`);
  redirect(`/wumpus/${guildId}?panel=queued`);
}

