const { halfwayReminder, sessionComplete, focusCheckIn } = require("./focusMessages");

const {
  getSession,
  markHalfwaySent,
  markAwaitingCompletion,
} = require("./focusManager");

const { RANDOM_FOCUS_CHECKIN_CHANCE } = require("../config/constants");

const logger = require("../utils/logger");

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
      const current = getSession();

      if (!current || current.completed) return;

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
    const current = getSession();

    if (!current) {
      return;
    }

    if (current.completed) {
      return;
    }

    markHalfwaySent();

    logger.info("FOCUS", "Sending halfway reminder.");

    await bot.sendMessage(current.chatId, halfwayReminder(current));
  }, halfwayTime);

  // ------------------------
  // Session Finished
  // ------------------------

  setTimeout(async () => {
    const current = getSession();

    if (!current) {
      return;
    }

    if (current.completed) {
      return;
    }

    markAwaitingCompletion();

    logger.success("FOCUS", "Focus session finished.");

    await bot.sendMessage(current.chatId, sessionComplete(current));
  }, finishTime);
}

module.exports = {
  scheduleSession,
};
