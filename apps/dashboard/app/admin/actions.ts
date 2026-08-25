"use server";

import { parseHubOrderPanelConfig } from "@huborder/core";
import { createDatabase, type WumpusLicense } from "@huborder/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authenticateAdmin, clearAdminSession, getAdminSession } from "../../lib/admin-auth";

let database: ReturnType<typeof createDatabase> | null = null;

function adminDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  database ??= createDatabase(url);
  return database;
}

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?expired=1");
  return session;
}

export async function loginAdmin(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!await authenticateAdmin(username, password)) redirect("/admin/login?error=invalid_credentials");
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function saveLicense(formData: FormData) {
  await requireAdmin();
  const discordUserId = String(formData.get("discordUserId") ?? "").trim();
  const plan = String(formData.get("plan") ?? "standard") as WumpusLicense["plan"];
  const status = String(formData.get("status") ?? "active") as WumpusLicense["status"];
  const maxServers = Number(formData.get("maxServers"));
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const validPlans = new Set<WumpusLicense["plan"]>(["starter", "standard", "professional", "enterprise"]);
  const validStatuses = new Set<WumpusLicense["status"]>(["active", "suspended", "expired"]);
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw + "T23:59:59.999Z") : null;
  if (!/^\d{15,22}$/.test(discordUserId) || !validPlans.has(plan) || !validStatuses.has(status) || !Number.isInteger(maxServers) || maxServers < 1 || maxServers > 1000 || (expiresAt && Number.isNaN(expiresAt.getTime())) || notes.length > 1000) redirect("/admin?error=invalid_license");
  await adminDatabase().saveWumpusLicense({ discordUserId, plan, status, maxServers, expiresAt, notes });
  revalidatePath("/admin");
  redirect("/admin?saved=license");
}

export async function reviewOccurrence(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isSafeInteger(id) || (decision !== "approved" && decision !== "rejected") || note.length > 500) redirect("/admin?error=invalid_occurrence");
  const reviewed = await adminDatabase().reviewWumpusOccurrence({ id, decision, reviewedBy: session.username, note });
  if (!reviewed) redirect("/admin?error=occurrence_already_reviewed");
  revalidatePath("/admin");
  redirect("/admin?reviewed=" + decision);
}

export async function saveHubOrderPanel(formData: FormData) {
  const session = await requireAdmin();
  const guildId = process.env.HUBORDER_SUPPORT_GUILD_ID ?? "";
  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId)) redirect("/admin?error=invalid_huborder_panel");
  try {
    const config = parseHubOrderPanelConfig({
      format: String(formData.get("format") ?? "components_v2"),
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      footer: String(formData.get("footer") ?? "").trim(),
      accentColor: String(formData.get("accentColor") ?? "#8175FF"),
      ticketPrefix: String(formData.get("ticketPrefix") ?? "pedido").trim(),
      allowMultipleOpenTickets: formData.get("allowMultipleOpenTickets") === "on",
      feedbackEnabled: formData.get("feedbackEnabled") === "on"
    });
    const db = adminDatabase();
    await db.saveHubOrderPanelSettings({ guildId, config });
    await db.queueHubOrderPublication({ guildId, channelId, kind: "ticket_panel", createdBy: session.username });
  } catch { redirect("/admin?error=invalid_huborder_panel"); }
  revalidatePath("/admin");
  redirect("/admin?saved=huborder_panel");
}

export async function publishHubOrderMessage(formData: FormData) {
  const session = await requireAdmin();
  const guildId = process.env.HUBORDER_SUPPORT_GUILD_ID ?? "";
  const channelId = String(formData.get("channelId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const footer = String(formData.get("footer") ?? "HubOrder").trim();
  const color = String(formData.get("color") ?? "#8175FF");
  const format = String(formData.get("format") ?? "components_v2");
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || title.length < 1 || title.length > 100 || description.length < 1 || description.length > 4000 || footer.length > 200 || !/^#[0-9a-fA-F]{6}$/.test(color) || (format !== "components_v2" && format !== "embed")) redirect("/admin?error=invalid_message");
  await adminDatabase().queueHubOrderPublication({ guildId, channelId, kind: "message", payload: { title, description, footer, color, format }, createdBy: session.username });
  revalidatePath("/admin");
  redirect("/admin?saved=message");
}
