const cron = require("node-cron");
const { REMINDER_INTERVALS, SCHEDULER_CRON } = require("../config/constants");
const { getTaskList, updateTaskList } = require("../services/taskManager");
const { calculateReminder } = require("../services/reminderService");
const { decideReminder } = require("../services/behaviourEngine");

function shouldSendNow(taskList, urgency) {
  const intervalMinutes =
    REMINDER_INTERVALS[urgency] ?? REMINDER_INTERVALS.MEDIUM;

  if (!taskList.lastReminderAt) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(taskList.lastReminderAt).getTime();
  const requiredMs = intervalMinutes * 60 * 1000;

  return elapsedMs >= requiredMs;
}

function startReminderScheduler(bot) {
  cron.schedule(SCHEDULER_CRON, async () => {
    try {
      const taskList = getTaskList();

      if (!taskList || !taskList.chatId) {
        return;
      }

      const stats = calculateReminder(taskList);

      if (!stats || stats.remainingTasks === 0) {
        return;
      }

      if (!shouldSendNow(taskList, stats.urgency)) {
        return;
      }

      const decision = decideReminder(taskList, stats);

      if (!decision.shouldSend) {
        return;
      }

      await bot.sendMessage(taskList.chatId, decision.message);

      updateTaskList({
        lastReminderAt: new Date(),
        lastReminderType: decision.type,
      });

      console.log(`
        [[Reminder] ${decision.type} sent to ${taskList.chatId} | urgency=${stats.urgency}](http://_vscodecontentref_/11),
      `);
    } catch (error) {
      console.error("[ReminderScheduler] Failed cycle:", error.message);
    }
  });
}

module.exports = {
  startReminderScheduler,
};
