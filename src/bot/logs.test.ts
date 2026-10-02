import assert from "node:assert/strict";
import test from "node:test";

import { shouldIgnoreLogEvent } from "./logs.ts";

test("ignora eventos de usuário explicitamente bloqueado", async () => {
  const guild = {
    client: { user: { id: "bot-1" } },
    roles: {
      cache: new Map([["role-ignored", { id: "role-ignored", name: "role-ignored" }]])
    },
    members: {
      fetch: async (id: string) => ({
        id,
        roles: {
          cache: {
            some: (predicate: (role: { id: string; name: string }) => boolean) =>
              id === "user-ignored" && predicate({ id: "role-ignored", name: "role-ignored" })
          }
        }
      })
    }
  } as any;

  const config = {
    enabled: true,
    ignoredUserIds: ["user-ignored"],
    ignoredRoleIds: ["role-ignored"],
    ignoredChannelIds: ["channel-ignored"],
    ignoreBotMessages: true
  };

  assert.equal(await shouldIgnoreLogEvent(guild, config, { actorId: "user-ignored" }), true);
  assert.equal(await shouldIgnoreLogEvent(guild, config, { actorId: "user-2", targetId: "user-3" }), false);
  assert.equal(await shouldIgnoreLogEvent(guild, config, { actorId: "bot-1" }), true);
});
