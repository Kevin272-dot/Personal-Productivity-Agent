const { getNextTask } = require("./taskSelector");

const {
  buildCheckIn,
  buildMediumReminder,
  buildHighReminder,
  buildCriticalReminder,
  buildOverdueReminder,
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
      message: buildOverdueReminder(stats, nextTask),
    };
  }

  if (Math.random() < RANDOM_CHECKIN_CHANCE) {
    return {
      shouldSend: true,
      type: "CHECK_IN",
      message: buildCheckIn(nextTask),
    };
  }

  switch (stats.urgency) {
    case "LOW":
      return {
        shouldSend: false,
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
