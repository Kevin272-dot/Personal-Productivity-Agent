const { getNextTask } = require("./taskSelector");

const RANDOM_MESSAGES = [
  "Still focused?",
  "One task now is better than ten later.",
  "Momentum beats motivation.",
  "Finish one task before checking social media again.",
  "Five minutes of focus is enough to restart.",
  "Close every distraction and finish one thing.",
  "You don't need motivation. You need momentum.",
  "Your future self is waiting.",
];

function randomCheckIn() {
  return RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
}

function mediumReminder(stats, nextTask) {
  return `Reminder

Remaining Tasks : ${stats.remainingTasks}
Time Left : ${Math.max(0, stats.remainingHours).toFixed(1)} hours

Suggested Next Task
${nextTask.text}

Keep the momentum going.`;
}

function highReminder(stats, nextTask) {
  return `You're starting to fall behind.

Remaining Tasks : ${stats.remainingTasks}
Time Left : ${Math.max(0, stats.remainingHours).toFixed(1)} hours

Suggested Next Task
${nextTask.text}`;
}

function criticalReminder(stats, nextTask) {
  return `Critical

${stats.remainingTasks} tasks remain.
Only ${Math.max(0, stats.remainingHours).toFixed(1)} hours left.

Stop scrolling.
Do this now:
${nextTask.text}`;
}

function overdueEscalation(stats, nextTask) {
  return `Deadline missed.

${stats.remainingTasks} tasks are still pending.

Recovery action:
1) Start immediately
2) Finish this first:
${nextTask.text}
3) Do not switch context until done`;
}

function decideReminder(taskList, stats) {
  if (!taskList || !stats) {
    return { shouldSend: false };
  }

  const nextTask = getNextTask(taskList);

  if (!nextTask) {
    return { shouldSend: false };
  }

  if (stats.remainingTasks === 0) {
    return { shouldSend: false };
  }

  if (stats.overdue) {
    return {
      shouldSend: true,
      type: "ESCALATION",
      message: overdueEscalation(stats, nextTask),
    };
  }

  if (Math.random() < 0.1) {
    return {
      shouldSend: true,
      type: "CHECK_IN",
      message: randomCheckIn(),
    };
  }

  switch (stats.urgency) {
    case "LOW":
      return { shouldSend: false };

    case "MEDIUM":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: mediumReminder(stats, nextTask),
      };

    case "HIGH":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: highReminder(stats, nextTask),
      };

    case "CRITICAL":
      return {
        shouldSend: true,
        type: "ESCALATION",
        message: criticalReminder(stats, nextTask),
      };

    default:
      return { shouldSend: false };
  }
}

module.exports = {
  decideReminder,
};
