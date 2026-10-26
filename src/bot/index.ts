  client.on(Events.GuildCreate, (guild: Guild) => {
    log.info("entrou em servidor", {
      guildId: guild.id,
      name: guild.name,
      members: guild.memberCount,
    });
    void reportHealth("online").catch((error) =>
      log.error("falha ao sincronizar servidores do bot", { error: String(error) }),
    );
    const activationTimer = setTimeout(() => {
      void (async () => {
        const plan = await guildPlan(guild.id);
        if (plan) return;
        log.warn("servidor adicionado sem licença ativa; mantendo o bot no servidor e bloqueando acesso até o cadastro na dashboard", {
          guildId: guild.id,
        });
      })();
    }, 15 * 60_000);
    activationTimer.unref();
  });

  client.on(Events.GuildDelete, () => {
    void reportHealth("online").catch((error) =>
      log.error("falha ao sincronizar servidores do bot", { error: String(error) }),
    );
  });

  const licenseSweepTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        const license = await guildEntitlement(guild.id);
        const status = await guildEntitlementStatus(guild.id);
        if (status !== "inactive" && !(license && license.accountId !== guild.ownerId)) continue;
        log.warn("licença inativa ou fora do limite do plano; mantendo o bot no servidor e bloqueando funcionalidades até o cadastro na dashboard", {
          guildId: guild.id,
        });
      }
    })();
  }, 60_000);
  licenseSweepTimer.unref();
