const { halfwayReminder, sessionComplete, focusCheckIn } = require("./focusMessages");

const {
  getSession,
  completeSession,
  endSession,
  markHalfwaySent,
  markAwaitingCompletion,
} = require("./focusManager");

const { getTaskList } = require("../services/taskManager");

const { RANDOM_FOCUS_CHECKIN_CHANCE } = require("../config/constants");

const logger = require("../utils/logger");

const AWAITING_COMPLETION_TIMEOUT_MS = 5 * 60 * 1000;

let awaitingCompletionTimer = null;

function clearAwaitingCompletionTimer() {
  if (awaitingCompletionTimer) {
    clearTimeout(awaitingCompletionTimer);
    awaitingCompletionTimer = null;
  }
}

async function isTaskAlreadyCompleted(session) {
  try {
    const taskList = await getTaskList(session.chatId);

    if (!taskList) return false;

    const task = taskList.tasks.find((t) => t.dbId === session.task.dbId);

    return task ? task.completed : false;
  } catch {
    return false;
  }
}

async function autoEndSession(bot, session, reason) {
  logger.success("FOCUS", `Auto-ending session: ${reason}`);

  await completeSession(session.chatId);
  endSession(session.chatId);
  clearAwaitingCompletionTimer();

  await bot.sendMessage(
    session.chatId,
    `Focus Session Ended\n\n${reason}\n\n${session.task.text}`,
  );
}

function scheduleSession(bot, session) {
  const halfwayTime = (session.duration * 60 * 1000) / 2;
  const finishTime = session.duration * 60 * 1000;

  logger.info("FOCUS", `Scheduling ${session.duration} minute session.`);

  // ------------------------
  // Random Check-Ins
  // ------------------------

  const intervalMs = 60 * 1000;

  for (let elapsed = intervalMs; elapsed < finishTime; elapsed += intervalMs) {
    if (elapsed === halfwayTime) continue;

    setTimeout(async () => {
      const current = getSession(session.chatId);

      if (!current || current.completed) return;

      if (await isTaskAlreadyCompleted(current)) {
        await autoEndSession(bot, current, "Task completed during session.");
        return;
      }

      if (Math.random() < RANDOM_FOCUS_CHECKIN_CHANCE) {
        logger.info("FOCUS", "Sending random focus check-in.");

        await bot.sendMessage(current.chatId, focusCheckIn(current));
      }
    }, elapsed);
  }

  // ------------------------
  // Halfway Reminder
  // ------------------------

  setTimeout(async () => {
    const current = getSession(session.chatId);

    if (!current) return;
    if (current.completed) return;

    if (await isTaskAlreadyCompleted(current)) {
      await autoEndSession(bot, current, "Task completed during session.");
      return;
    }

    markHalfwaySent(session.chatId);

    logger.info("FOCUS", "Sending halfway reminder.");

    await bot.sendMessage(current.chatId, halfwayReminder(current));
  }, halfwayTime);

  // ------------------------
  // Session Finished
  // ------------------------

  setTimeout(async () => {
    const current = getSession(session.chatId);

    if (!current) return;
    if (current.completed) return;

    if (await isTaskAlreadyCompleted(current)) {
      await autoEndSession(bot, current, "Task completed during session.");
      return;
    }

    markAwaitingCompletion(session.chatId);

    logger.success("FOCUS", "Focus session finished.");

    await bot.sendMessage(current.chatId, sessionComplete(current));

    clearAwaitingCompletionTimer();
    awaitingCompletionTimer = setTimeout(async () => {
      const stillActive = getSession(session.chatId);

      if (!stillActive || !stillActive.awaitingCompletion) return;

      logger.warn("FOCUS", "Awaiting completion timed out. Ending session.");

      await autoEndSession(bot, stillActive, "No response received. Session ended.");
    }, AWAITING_COMPLETION_TIMEOUT_MS);
  }, finishTime);
}

module.exports = {
  scheduleSession,
  clearAwaitingCompletionTimer,
};
