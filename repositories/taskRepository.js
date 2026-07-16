const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createTaskRepository(prismaClient = getPrismaClient()) {
  return {
    createTask(data) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into tasks (id, title, priority, completed, completed_at, is_daily, created_at, daily_plan_id)
        values (${id}, ${data.title}, ${data.priority ?? "normal"}, ${Boolean(data.completed)}, ${data.completedAt ?? null}, ${Boolean(data.isDaily)}, ${data.createdAt ?? new Date()}, ${data.dailyPlanId})
        returning id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
      `.then(([row]) => row);
    },

    createTasks(tasks) {
      return prismaClient.begin(async (tx) => {
        const inserted = [];

        for (const task of tasks) {
          const id = task.id ?? randomUUID();

          const [row] = await tx`
            insert into tasks (id, title, priority, completed, completed_at, is_daily, created_at, daily_plan_id)
            values (${id}, ${task.title}, ${task.priority ?? "normal"}, ${Boolean(task.completed)}, ${task.completedAt ?? null}, ${Boolean(task.isDaily)}, ${task.createdAt ?? new Date()}, ${task.dailyPlanId})
            returning id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
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
          select id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
          from tasks
          order by created_at asc, id asc
        `;
      }

      return prismaClient.unsafe(
        `select id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId" from tasks ${whereClause} order by created_at asc, id asc`,
        values,
      );
    },

    findById(id) {
      return prismaClient`
        select id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
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
          completed_at = coalesce(${data.completedAt ?? null}, completed_at),
          is_daily = coalesce(${data.isDaily ?? null}, is_daily)
        where id = ${id}
        returning id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
      `.then(([row]) => row);
    },

    delete(id) {
      return prismaClient`delete from tasks where id = ${id}`;
    },

    deleteTasks(ids) {
      if (!ids || ids.length === 0) return Promise.resolve(0);
      return prismaClient`delete from tasks where id = any(${ids})`;
    },

    findNextIncompleteByDailyPlanId(dailyPlanId) {
      return prismaClient`
        select id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
        from tasks
        where daily_plan_id = ${dailyPlanId} and completed = false
        order by created_at asc, id asc
        limit 1
      `.then(([row]) => row || null);
    },

    findIncompleteDailyByUserId(userId) {
      return prismaClient`
        select t.id, t.title, t.priority, t.completed, t.completed_at as "completedAt", t.is_daily as "isDaily", t.created_at as "createdAt", t.daily_plan_id as "dailyPlanId"
        from tasks t
        join daily_plans dp on t.daily_plan_id = dp.id
        where dp.user_id = ${userId} and t.is_daily = true and t.completed = false
        order by t.created_at asc, t.id asc
      `;
    },

    findAllDailyByUserId(userId) {
      return prismaClient`
        select t.id, t.title, t.priority, t.completed, t.completed_at as "completedAt", t.is_daily as "isDaily", t.created_at as "createdAt", t.daily_plan_id as "dailyPlanId"
        from tasks t
        join daily_plans dp on t.daily_plan_id = dp.id
        where dp.user_id = ${userId} and t.is_daily = true
        order by t.created_at asc, t.id asc
      `;
    },

    resetDailyTasks(userId) {
      return prismaClient`
        update tasks
        set completed = false, completed_at = null
        from daily_plans
        where tasks.daily_plan_id = daily_plans.id
          and daily_plans.user_id = ${userId}
          and tasks.is_daily = true
          and tasks.completed = true
      `;
    },
  };
}

module.exports = {
  createTaskRepository,
};
