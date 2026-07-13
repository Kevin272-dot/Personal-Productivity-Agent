const {
  CHECK_IN,
  MOMENTUM,
  DISTRACTION,
  CRITICAL,
} = require("../data/reminderMessages");

function formatHours(hours) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) {
    return `${m}m`;
  }

  if (m === 0) {
    return `${h}h`;
  }

  return `${h}h ${m}m`;
}

function formatDurationLabel(hours) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) {
    return `${m} minute(s)`;
  }

  if (m === 0) {
    return `${h} hour(s)`;
  }

  return `${h}h ${m}m`;
}

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function buildLowReminder(stats, nextTask) {
  const headline = random(MOMENTUM);

  return `${headline}

-- Progress --
[ ] Done: ${stats.completedTasks}/${stats.totalTasks}
[ ] Left: ${stats.remainingTasks}
[ ] Time: ${formatHours(stats.remainingHours)}

-- Next --
${nextTask.text}`;
}

function buildCheckIn(nextTask) {
  const headline = random(CHECK_IN);

  return `${headline}

-- Current Task --
${nextTask.text}`;
}

function buildRandomCheckIn(stats, nextTask) {
  const pool = [...MOMENTUM, ...DISTRACTION, ...CHECK_IN];
  const headline = random(pool);

  return `${headline}

-- Progress --
[ ] Done: ${stats.completedTasks}/${stats.totalTasks}
[ ] Left: ${stats.remainingTasks}
[ ] Time: ${formatHours(stats.remainingHours)}

-- Next --
${nextTask.text}`;
}

function buildMediumReminder(stats, nextTask) {
  return `-- Status --

[ ] Done: ${stats.completedTasks}/${stats.totalTasks}
[ ] Left: ${stats.remainingTasks}
[ ] Time: ${formatHours(stats.remainingHours)}
[ ] Pace: ${stats.requiredPace.toFixed(1)} task(s)/hr

-- Next --
${nextTask.text}`;
}

function buildHighReminder(stats, nextTask) {
  return `-- Status : HIGH --

[ ] Done: ${stats.completedTasks}/${stats.totalTasks}
[ ] Left: ${stats.remainingTasks}
[ ] Time: ${formatHours(stats.remainingHours)}
[ ] Pace: ${stats.requiredPace.toFixed(1)} task(s)/hr

-- Priority --
${nextTask.text}`;
}

function buildCriticalReminder(stats, nextTask) {
  return `-- Deadline Near --

[ ] Left: ${stats.remainingTasks}
[ ] Time: ${formatHours(stats.remainingHours)}
[ ] Pace: ${stats.requiredPace.toFixed(1)} task(s)/hr

-- Start Now --
${nextTask.text}`;
}

function buildOverdueMessage(stats, taskList) {
  const durationHours = taskList.createdAt && taskList.deadline
    ? (taskList.deadline.getTime() - taskList.createdAt.getTime()) / (1000 * 60 * 60)
    : 24;
  const durationLabel = formatDurationLabel(durationHours);

  let message = "";
  message += "-- Deadline Passed --\n\n";
  message += `[ ] Done: ${stats.completedTasks}/${stats.totalTasks}\n`;
  message += `[ ] Left: ${stats.remainingTasks}\n\n`;
  message += "The deadline has passed and you still have task(s) remaining.\n\n";
  message += "What would you like to do?";

  return { message, durationLabel, durationHours };
}

module.exports = {
  buildLowReminder,
  buildCheckIn,
  buildRandomCheckIn,
  buildMediumReminder,
  buildHighReminder,
  buildCriticalReminder,
  buildOverdueMessage,
  formatHours,
  formatDurationLabel,
};
