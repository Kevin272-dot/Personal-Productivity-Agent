const cron = require("node-cron");

const { REMINDER_INTERVALS, SCHEDULER_CRON, OVERDUE_PROMPT_COOLDOWN_MS, DAILY_REMINDER_HOUR } = require("../config/constants");

const { getTaskList, updateTaskList, getAllActiveTaskLists, getDailyTasks, resetDailyTasks } = require("../services/taskManager");

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

  let lastDailyResetDate = null;

  cron.schedule(SCHEDULER_CRON, async () => {
    try {
      logger.info("SCHEDULER", "Running reminder cycle...");

      const now = new Date();
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const istMinutes = (utcMinutes + 5 * 60 + 30) % (24 * 60);
      const istHour = Math.floor(istMinutes / 60);
      const istDate = now.toISOString().slice(0, 10);

      if (lastDailyResetDate !== istDate && istHour >= DAILY_REMINDER_HOUR) {
        lastDailyResetDate = istDate;
        logger.info("SCHEDULER", "New day detected. Resetting daily tasks.");

        const allChats = getAllActiveTaskLists();
        for (const tl of allChats) {
          try {
            await resetDailyTasks(tl.chatId);
          } catch (e) {
            logger.error("SCHEDULER", `Failed to reset daily tasks for ${tl.chatId}: ${e.message}`);
          }
        }
      }

      const allTaskLists = getAllActiveTaskLists();

      if (allTaskLists.length === 0) {
        logger.info("SCHEDULER", "No active task lists.");
      } else {
        for (const taskList of allTaskLists) {
          try {
            const stats = calculateReminder(taskList);

            if (!stats) {
              logger.warn("SCHEDULER", "Reminder calculation failed.");
              continue;
            }

            if (stats.remainingTasks === 0) {
              logger.success("SCHEDULER", "All tasks completed.");
              continue;
            }

            if (stats.overdue) {
              if (shouldSendOverduePrompt(taskList)) {
                await sendOverduePrompt(bot, taskList, stats);
              } else {
                logger.info("SCHEDULER", "Overdue prompt skipped (cooldown).");
              }
              continue;
            }

            if (!shouldSendNow(taskList, stats.urgency, stats.remainingHours)) {
              logger.info("SCHEDULER", "Reminder skipped (cooldown).");
              continue;
            }

            await sendReminder(bot, taskList, stats);
          } catch (innerError) {
            logger.error("SCHEDULER", `Error for chat ${taskList.chatId}: ${innerError.message}`);
          }
        }
      }

      if (istHour === DAILY_REMINDER_HOUR) {
        await sendDailyTaskReminders(bot);
      }
    } catch (error) {
      logger.error("SCHEDULER", error.message);
    }
  });
}

async function sendDailyTaskReminders(bot) {
  try {
    const allTaskLists = getAllActiveTaskLists();

    const seenChats = new Set();

    for (const taskList of allTaskLists) {
      const chatId = taskList.chatId;

      if (seenChats.has(String(chatId))) continue;
      seenChats.add(String(chatId));

      try {
        const dailyTasks = await getDailyTasks(chatId);

        if (dailyTasks.length === 0) continue;

        const pending = dailyTasks.filter((t) => !t.completed);

        if (pending.length === 0) continue;

        let message = "Daily Tasks Reminder\n";
        message += "────────────────────\n\n";
        message += `You have ${pending.length} pending daily task(s):\n\n`;

        pending.forEach((task) => {
          message += `[ ] ${task.id}. ${task.text}\n`;
        });

        message += "\nSend 'done <task>' to mark them complete.";

        await bot.sendMessage(chatId, message);
        logger.success("SCHEDULER", `Daily task reminder sent to ${chatId}.`);
      } catch (innerError) {
        logger.error("SCHEDULER", `Error sending daily reminder to ${chatId}: ${innerError.message}`);
      }
    }
  } catch (error) {
    logger.error("SCHEDULER", `Daily reminder error: ${error.message}`);
  }
}

module.exports = {
  startReminderScheduler,
};
