const { randomUUID } = require("crypto");
const { getPrismaClient } = require("../lib/prisma");

function createReminderRepository(prismaClient = getPrismaClient()) {
  return {
    createReminder(data) {
      const id = data.id ?? randomUUID();

      return prismaClient`
        insert into reminder_history (id, type, urgency, sent_at, daily_plan_id)
        values (${id}, ${data.type}, ${data.urgency}, ${data.sentAt ?? new Date()}, ${data.dailyPlanId})
        returning id, type, urgency, sent_at as "sentAt", daily_plan_id as "dailyPlanId"
      `.then(([row]) => row);
    },

    findAll(where = {}) {
      return prismaClient`
        select id, type, urgency, sent_at as "sentAt", daily_plan_id as "dailyPlanId"
        from reminder_history
        order by sent_at desc
      `;
    },

    create(data) {
      return this.createReminder(data);
    },

    findByDailyPlanId(dailyPlanId) {
      return prismaClient`
        select id, type, urgency, sent_at as "sentAt", daily_plan_id as "dailyPlanId"
        from reminder_history
        where daily_plan_id = ${dailyPlanId}
        order by sent_at desc
      `;
    },
  };
}

module.exports = {
  createReminderRepository,
};
