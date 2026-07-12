const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createUserRepository(prismaClient = getPrismaClient()) {
  return {
    createUser(data) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into users (id, telegram_id, name, timezone, created_at)
        values (${id}, ${String(data.telegramId)}, ${data.name ?? null}, ${data.timezone ?? "UTC"}, ${data.createdAt ?? new Date()})
        returning id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
      `.then(([row]) => row);
    },

    findByTelegramId(telegramId) {
      return prismaClient`
        select id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
        from users
        where telegram_id = ${String(telegramId)}
        limit 1
      `.then(([row]) => row || null);
    },

    findById(id) {
      return prismaClient`
        select id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
        from users
        where id = ${id}
        limit 1
      `.then(([row]) => row || null);
    },

    create(data) {
      return this.createUser(data);
    },

    upsertByTelegramId(telegramId, data = {}) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into users (id, telegram_id, name, timezone, created_at)
        values (${id}, ${String(telegramId)}, ${data.name ?? null}, ${data.timezone ?? "UTC"}, ${data.createdAt ?? new Date()})
        on conflict (telegram_id)
        do update set
          name = excluded.name,
          timezone = excluded.timezone
        returning id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
      `.then(([row]) => row);
    },

    findAll() {
      return prismaClient`
        select id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
        from users
      `;
    },
  };
}

module.exports = {
  createUserRepository,
};
