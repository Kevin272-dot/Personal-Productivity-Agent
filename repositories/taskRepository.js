const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createTaskRepository(prismaClient = getPrismaClient()) {
  return {
    createTask(data) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into tasks (id, title, priority, completed, completed_at, created_at, daily_plan_id)
        values (${id}, ${data.title}, ${data.priority ?? "normal"}, ${Boolean(data.completed)}, ${data.completedAt ?? null}, ${data.createdAt ?? new Date()}, ${data.dailyPlanId})
        returning id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
      `.then(([row]) => row);
    },

    createTasks(tasks) {
      return prismaClient.begin(async (tx) => {
        const inserted = [];

        for (const task of tasks) {
          const id = task.id ?? randomUUID();

          const [row] = await tx`
            insert into tasks (id, title, priority, completed, completed_at, created_at, daily_plan_id)
            values (${id}, ${task.title}, ${task.priority ?? "normal"}, ${Boolean(task.completed)}, ${task.completedAt ?? null}, ${task.createdAt ?? new Date()}, ${task.dailyPlanId})
            returning id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
          `;
          inserted.push(row);
        }

        return inserted;
      });
    },

    findAll(where = {}) {
      const conditions = [];
      const values = [];

      if (where.dailyPlanId) {
        values.push(where.dailyPlanId);
        conditions.push(`daily_plan_id = $${values.length}`);
      }

      const whereClause = conditions.length
        ? `where ${conditions.join(" and ")}`
        : "";

      if (!whereClause) {
        return prismaClient`
          select id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
          from tasks
          order by created_at asc, id asc
        `;
      }

      return prismaClient.unsafe(
        `select id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId" from tasks ${whereClause} order by created_at asc, id asc`,
        values,
      );
    },

    findById(id) {
      return prismaClient`
        select id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
        from tasks
        where id = ${id}
        limit 1
      `.then(([row]) => row || null);
    },

    create(data) {
      return this.createTask(data);
    },

    createMany(tasks) {
      return this.createTasks(tasks);
    },

    update(id, data) {
      return prismaClient`
        update tasks
        set
          title = coalesce(${data.title ?? null}, title),
          priority = coalesce(${data.priority ?? null}, priority),
          completed = coalesce(${data.completed ?? null}, completed),
          completed_at = coalesce(${data.completedAt ?? null}, completed_at)
        where id = ${id}
        returning id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
      `.then(([row]) => row);
    },

    delete(id) {
      return prismaClient`delete from tasks where id = ${id}`;
    },

    findNextIncompleteByDailyPlanId(dailyPlanId) {
      return prismaClient`
        select id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
        from tasks
        where daily_plan_id = ${dailyPlanId} and completed = false
        order by created_at asc, id asc
        limit 1
      `.then(([row]) => row || null);
    },
  };
}

module.exports = {
  createTaskRepository,
};
