const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createPlanRepository(prismaClient = getPrismaClient()) {
  async function hydratePlan(client, planRow) {
    if (!planRow) {
      return null;
    }

    const [user] = await client`
      select id, telegram_id as "telegramId", name, timezone, created_at as "createdAt"
      from users
      where id = ${planRow.user_id}
      limit 1
    `;

    const tasks = await client`
      select id, title, priority, completed, completed_at as "completedAt", is_daily as "isDaily", created_at as "createdAt", daily_plan_id as "dailyPlanId"
      from tasks
      where daily_plan_id = ${planRow.id}
      order by created_at asc, id asc
    `;

    const reminderHistory = await client`
      select id, type, urgency, sent_at as "sentAt", daily_plan_id as "dailyPlanId"
      from reminder_history
      where daily_plan_id = ${planRow.id}
      order by sent_at desc, id desc
    `;

    return {
      id: planRow.id,
      deadline: planRow.deadline,
      createdAt: planRow.created_at,
      completed: planRow.completed,
      userId: planRow.user_id,
      user,
      tasks,
      reminderHistory,
    };
  }

  return {
    createPlan(data) {
      return prismaClient.begin(async (tx) => {
        const planId = data.id ?? randomUUID();
        const [planRow] = await tx`
          insert into daily_plans (id, deadline, completed, created_at, user_id)
          values (${planId}, ${data.deadline}, ${Boolean(data.completed)}, ${data.createdAt ?? new Date()}, ${data.userId})
          returning id, deadline, completed, created_at, user_id
        `;

        for (const task of data.tasks?.create || []) {
          const taskId = task.id ?? randomUUID();

          await tx`
            insert into tasks (id, title, priority, completed, completed_at, is_daily, created_at, daily_plan_id)
            values (${taskId}, ${task.title}, ${task.priority ?? "normal"}, ${Boolean(task.completed)}, ${task.completedAt ?? null}, ${Boolean(task.isDaily)}, ${task.createdAt ?? new Date()}, ${planRow.id})
          `;
        }

        return hydratePlan(tx, planRow);
      });
    },

    getActivePlan(userId) {
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
        where user_id = ${userId} and completed = false
        order by created_at desc
        limit 1
      `.then(([planRow]) => hydratePlan(prismaClient, planRow));
    },

    findAll(where = {}) {
      if (where.userId) {
        return prismaClient`
          select id, deadline, completed, created_at, user_id
          from daily_plans
          where user_id = ${where.userId}
          order by created_at desc
        `;
      }
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
        order by created_at desc
      `;
    },

    findAllByUser(userId) {
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
        where user_id = ${userId}
        order by created_at desc
      `;
    },

    findOlderThan(userId, cutoff) {
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
        where user_id = ${userId} and created_at < ${cutoff}
        order by created_at desc
      `;
    },

    findById(id) {
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
        where id = ${id}
        limit 1
      `.then(([planRow]) => hydratePlan(prismaClient, planRow));
    },

    create(data) {
      return this.createPlan(data);
    },

    update(id, data) {
      if (data.deadline !== undefined && data.completed !== undefined) {
        return prismaClient`
          update daily_plans
          set completed = ${data.completed}, deadline = ${data.deadline}
          where id = ${id}
          returning id, deadline, completed, created_at, user_id
        `.then(([row]) => row || null);
      }

      if (data.deadline !== undefined) {
        return prismaClient`
          update daily_plans
          set deadline = ${data.deadline}
          where id = ${id}
          returning id, deadline, completed, created_at, user_id
        `.then(([row]) => row || null);
      }

      return prismaClient`
        update daily_plans
        set completed = coalesce(${data.completed ?? null}, completed)
        where id = ${id}
        returning id, deadline, completed, created_at, user_id
      `.then(([row]) => row || null);
    },

    delete(id) {
      return prismaClient`delete from daily_plans where id = ${id}`;
    },

    deleteAllForUser(userId) {
      return prismaClient.begin(async (tx) => {
        const planIds = await tx`
          select id from daily_plans where user_id = ${userId}
        `.then((rows) => rows.map((r) => r.id));

        if (planIds.length === 0) return 0;

        await tx`delete from reminder_history where daily_plan_id = any(${planIds})`;
        await tx`delete from focus_sessions where task_id in (select id from tasks where daily_plan_id = any(${planIds}))`;
        await tx`delete from tasks where daily_plan_id = any(${planIds})`;
        await tx`delete from daily_plans where user_id = ${userId}`;

        return planIds.length;
      });
    },

    deleteOlderThanDays(userId, days) {
      return prismaClient.begin(async (tx) => {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const planIds = await tx`
          select id from daily_plans where user_id = ${userId} and created_at < ${cutoff}
        `.then((rows) => rows.map((r) => r.id));

        if (planIds.length === 0) return 0;

        await tx`delete from reminder_history where daily_plan_id = any(${planIds})`;
        await tx`delete from focus_sessions where task_id in (select id from tasks where daily_plan_id = any(${planIds}))`;
        await tx`delete from tasks where daily_plan_id = any(${planIds})`;
        await tx`delete from daily_plans where user_id = ${userId} and created_at < ${cutoff}`;

        return planIds.length;
      });
    },

    markCompleted(id) {
      return prismaClient`
        update daily_plans
        set completed = true
        where id = ${id}
      `;
    },

    findDailyPlanByUserId(userId) {
      return prismaClient`
        select dp.id, dp.deadline, dp.completed, dp.created_at, dp.user_id
        from daily_plans dp
        join tasks t on t.daily_plan_id = dp.id
        where dp.user_id = ${userId} and t.is_daily = true
        order by dp.created_at desc
        limit 1
      `.then(([planRow]) => planRow ? hydratePlan(prismaClient, planRow) : null);
    },

    ensureDailyPlan(userId) {
      return prismaClient.begin(async (tx) => {
        const [existing] = await tx`
          select dp.id from daily_plans dp
          join tasks t on t.daily_plan_id = dp.id
          where dp.user_id = ${userId} and t.is_daily = true
          order by dp.created_at desc
          limit 1
        `;

        if (existing) {
          return existing.id;
        }

        const planId = randomUUID();
        await tx`
          insert into daily_plans (id, deadline, completed, created_at, user_id)
          values (${planId}, ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}, false, ${new Date()}, ${userId})
        `;

        return planId;
      });
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
  createPlanRepository,
};
