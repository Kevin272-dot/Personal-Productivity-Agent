const { getNextTask } = require("./taskSelector");
const { RANDOM_CHECKIN_CHANCE } = require("../config/constants");

const {
  buildLowReminder,
  buildCheckIn,
  buildRandomCheckIn,
  buildMediumReminder,
  buildHighReminder,
  buildCriticalReminder,
} = require("./messageFactory");

function decideReminder(taskList, stats) {
  // No task list
  if (!taskList || !stats) {
    return {
      shouldSend: false,
    };
  }

  // No remaining task
  const nextTask = getNextTask(taskList);

  if (!nextTask) {
    return {
      shouldSend: false,
    };
  }

  // Everything completed
  if (stats.remainingTasks === 0) {
    return {
      shouldSend: false,
    };
  }

  // Deadline missed
  if (stats.overdue) {
    return {
      shouldSend: true,
      type: "ESCALATION",
      message: buildCriticalReminder(stats, nextTask),
    };
  }

  // Random surprise check-in — any urgency level
  if (Math.random() < RANDOM_CHECKIN_CHANCE) {
    return {
      shouldSend: true,
      type: "CHECK_IN",
      message: buildRandomCheckIn(stats, nextTask),
    };
  }

  switch (stats.urgency) {
    case "LOW":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: buildLowReminder(stats, nextTask),
      };

    case "MEDIUM":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: buildMediumReminder(stats, nextTask),
      };

    case "HIGH":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: buildHighReminder(stats, nextTask),
      };

    case "CRITICAL":
      return {
        shouldSend: true,
        type: "ESCALATION",
        message: buildCriticalReminder(stats, nextTask),
      };

    default:
      return {
        shouldSend: false,
      };
  }
}

module.exports = {
  decideReminder,
};
