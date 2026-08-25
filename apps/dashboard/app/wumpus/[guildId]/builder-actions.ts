"use server";

import { createDatabase, type JsonObject } from "@huborder/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWumpusSession } from "../../../lib/auth";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return createDatabase(url);
}

async function managedGuild(guildId: string) {
  const session = await getWumpusSession();
  if (!session || !session.guilds.some((guild) => guild.id === guildId)) redirect("/wumpus?error=access_denied");
  return session;
}

function snowflakeList(formData: FormData, name: string) {
  return formData.getAll(name).map(String).filter((value) => /^\d{15,22}$/.test(value)).slice(0, 50);
}

export async function saveTicketDepartment(formData: FormData) {
  const guildId = String(formData.get("guildId") ?? "");
  await managedGuild(guildId);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "💬").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  if (!/^\d{15,22}$/.test(guildId) || name.length < 2 || name.length > 100 || description.length > 300 || emoji.length > 16 || (categoryId && !/^\d{15,22}$/.test(categoryId))) redirect(`/wumpus/${guildId}/tickets?builderError=department`);
  const db = database();
  try {
    await db.saveWumpusTicketDepartment({ guildId, name, description, emoji: emoji || "💬", categoryId, staffRoleIds: snowflakeList(formData, "staffRoleIds"), position: Number(formData.get("position")) || 0, isActive: true });
  } finally { await db.close(); }
  revalidatePath(`/wumpus/${guildId}/tickets`);
  redirect(`/wumpus/${guildId}/tickets?builderSaved=department`);
}

export async function saveFormDefinition(formData: FormData) {
  const guildId = String(formData.get("guildId") ?? "");
  await managedGuild(guildId);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  let fields: JsonObject[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("fields") ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid fields");
    fields = parsed.slice(0, 5).map((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid field");
      const field = raw as JsonObject;
      const label = typeof field.label === "string" ? field.label.trim() : "";
      if (label.length < 2 || label.length > 45) throw new Error("invalid label");
      return { key: "field" + index, label, type: field.type === "short" ? "short" : "paragraph", required: field.required !== false, placeholder: typeof field.placeholder === "string" ? field.placeholder.slice(0, 100) : "", maxLength: field.type === "short" ? 400 : 1800 };
    });
  } catch { redirect(`/wumpus/${guildId}/forms?builderError=fields`); }
  if (!/^\d{15,22}$/.test(guildId) || name.length < 2 || name.length > 100 || description.length > 500 || fields.length < 1) redirect(`/wumpus/${guildId}/forms?builderError=form`);
  const db = database();
  try {
    await db.saveWumpusForm({ guildId, name, description, fields, reviewerRoleIds: snowflakeList(formData, "reviewerRoleIds"), isActive: true });
  } finally { await db.close(); }
  revalidatePath(`/wumpus/${guildId}/forms`);
  redirect(`/wumpus/${guildId}/forms?builderSaved=form`);
}
