const cron = require("node-cron");

const { REMINDER_INTERVALS, SCHEDULER_CRON, OVERDUE_PROMPT_COOLDOWN_MS } = require("../config/constants");

const { getTaskList, updateTaskList } = require("../services/taskManager");

const { calculateReminder } = require("../services/reminderService");

const { decideReminder } = require("../services/behaviourEngine");

const { buildOverdueMessage } = require("../services/messageFactory");

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

function getCooldownScale(remainingHours) {
  if (remainingHours >= 24) return 3;
  if (remainingHours >= 12) return 2;
  if (remainingHours >= 6) return 1.5;
  return 1;
}

function shouldSendNow(taskList, urgency, remainingHours) {
  const baseCooldown = REMINDER_INTERVALS[urgency] ?? REMINDER_INTERVALS.MEDIUM;
  const scale = getCooldownScale(remainingHours);
  const cooldown = baseCooldown * scale;

  if (!taskList.lastReminderAt) {
    return true;
  }

  const elapsedMinutes =
    (Date.now() - new Date(taskList.lastReminderAt).getTime()) / (1000 * 60);

  return elapsedMinutes >= cooldown;
}

function shouldSendOverduePrompt(taskList) {
  if (!taskList.lastOverduePromptAt) {
    return true;
  }

  const elapsed = Date.now() - new Date(taskList.lastOverduePromptAt).getTime();
  return elapsed >= OVERDUE_PROMPT_COOLDOWN_MS;
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

  taskList.lastReminderAt = new Date();

  logger.success("SCHEDULER", `${decision.type} reminder sent.`);
}

async function sendOverduePrompt(bot, taskList, stats) {
  const { message, durationLabel, durationHours } = buildOverdueMessage(stats, taskList);

  await bot.sendMessage(taskList.chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `Extend by ${durationLabel}`,
            callback_data: `overdue_extend:${taskList.chatId}:${durationHours}`,
          },
          {
            text: "Delete Tasks",
            callback_data: `overdue_delete:${taskList.chatId}`,
          },
        ],
      ],
    },
  });

  await getReminderRepository().createReminder({
    type: "OVERDUE_PROMPT",
    urgency: stats.urgency,
    dailyPlanId: taskList.dbId,
  });

  taskList.lastOverduePromptAt = new Date();

  logger.success("SCHEDULER", "Overdue prompt sent with extend/delete options.");
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
        if (shouldSendOverduePrompt(taskList)) {
          await sendOverduePrompt(bot, taskList, stats);
        } else {
          logger.info("SCHEDULER", "Overdue prompt skipped (cooldown).");
        }
        return;
      }

      if (!shouldSendNow(taskList, stats.urgency, stats.remainingHours)) {
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
