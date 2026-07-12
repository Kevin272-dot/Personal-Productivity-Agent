const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createFocusRepository(prismaClient = getPrismaClient()) {
  return {
    createFocusSession(data) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into focus_sessions (id, duration, started_at, ended_at, completed, task_id)
        values (${id}, ${data.duration}, ${data.startedAt}, ${data.endedAt ?? null}, ${Boolean(data.completed)}, ${data.taskId})
        returning id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
      `.then(([row]) => row);
    },

    findAll(where = {}) {
      if (where.taskId) {
        return prismaClient`
          select id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
          from focus_sessions
          where task_id = ${where.taskId}
          order by started_at desc
        `;
      }

      return prismaClient`
        select id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
        from focus_sessions
        order by started_at desc
      `;
    },

    findById(id) {
      return prismaClient`
        select id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
        from focus_sessions
        where id = ${id}
        limit 1
      `.then(([row]) => row || null);
    },

    findActiveByTaskId(taskId) {
      return prismaClient`
        select id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
        from focus_sessions
        where task_id = ${taskId} and completed = false
        order by started_at desc
        limit 1
      `.then(([row]) => row || null);
    },

    create(data) {
      return this.createFocusSession(data);
    },

    update(id, data) {
      return prismaClient`
        update focus_sessions
        set
          ended_at = coalesce(${data.endedAt ?? null}, ended_at),
          completed = coalesce(${data.completed ?? null}, completed)
        where id = ${id}
        returning id, duration, started_at as "startedAt", ended_at as "endedAt", completed, task_id as "taskId"
      `.then(([row]) => row);
    },

    delete(id) {
      return prismaClient`delete from focus_sessions where id = ${id}`;
    },
  };
}

module.exports = {
  createFocusRepository,
};
