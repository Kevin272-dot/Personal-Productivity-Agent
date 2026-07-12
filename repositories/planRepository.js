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
      select id, title, priority, completed, completed_at as "completedAt", created_at as "createdAt", daily_plan_id as "dailyPlanId"
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
            insert into tasks (id, title, priority, completed, completed_at, created_at, daily_plan_id)
            values (${taskId}, ${task.title}, ${task.priority ?? "normal"}, ${Boolean(task.completed)}, ${task.completedAt ?? null}, ${task.createdAt ?? new Date()}, ${planRow.id})
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
      return prismaClient`
        select id, deadline, completed, created_at, user_id
        from daily_plans
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

    markCompleted(id) {
      return prismaClient`
        update daily_plans
        set completed = true
        where id = ${id}
      `;
    },
  };
}

module.exports = {
  createPlanRepository,
};
