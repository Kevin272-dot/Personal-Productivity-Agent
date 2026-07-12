const cron = require("node-cron");

const { REMINDER_INTERVALS, SCHEDULER_CRON } = require("../config/constants");

const { getTaskList, updateTaskList } = require("../services/taskManager");

const { calculateReminder } = require("../services/reminderService");

const { decideReminder } = require("../services/behaviourEngine");

const {
  createReminderRepository,
} = require("../../repositories/reminderRepository");

const logger = require("../utils/logger");

let reminderRepository = null;

function getReminderRepository() {
  if (!reminderRepository) {
    reminderRepository = createReminderRepository();
  }

  return reminderRepository;
}

function shouldSendNow(taskList, urgency) {
  const cooldown = REMINDER_INTERVALS[urgency] ?? REMINDER_INTERVALS.MEDIUM;

  if (!taskList.lastReminderAt) {
    return true;
  }

  const elapsedMinutes =
    (Date.now() - new Date(taskList.lastReminderAt).getTime()) / (1000 * 60);

  return elapsedMinutes >= cooldown;
}

async function sendReminder(bot, taskList, stats) {
  const decision = decideReminder(taskList, stats);

  if (!decision.shouldSend) {
    logger.info("SCHEDULER", "Behavior engine decided not to send a reminder.");
    return;
  }

  await bot.sendMessage(taskList.chatId, decision.message);

  await getReminderRepository().createReminder({
    type: decision.type,
    urgency: stats.urgency,
    dailyPlanId: taskList.dbId,
  });

  logger.success("SCHEDULER", `${decision.type} reminder sent.`);
}

function startReminderScheduler(bot) {
  logger.success("SCHEDULER", "Reminder scheduler started.");

  cron.schedule(SCHEDULER_CRON, async () => {
    try {
      logger.info("SCHEDULER", "Running reminder cycle...");

      const taskList = await getTaskList();

      if (!taskList) {
        logger.info("SCHEDULER", "No active task list.");
        return;
      }

      const stats = calculateReminder(taskList);

      if (!stats) {
        logger.warn("SCHEDULER", "Reminder calculation failed.");
        return;
      }

      if (stats.remainingTasks === 0) {
        logger.success("SCHEDULER", "All tasks completed.");

        return;
      }

      if (stats.overdue) {
        logger.warn("SCHEDULER", "Deadline has passed.");

        return;
      }

      if (!shouldSendNow(taskList, stats.urgency)) {
        logger.info("SCHEDULER", "Reminder skipped (cooldown).");

        return;
      }

      await sendReminder(bot, taskList, stats);
    } catch (error) {
      logger.error("SCHEDULER", error.message);
    }
  });
}

module.exports = {
  startReminderScheduler,
};
