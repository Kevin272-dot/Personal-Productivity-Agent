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

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function buildLowReminder(stats, nextTask) {
  const headline = random(MOMENTUM);

  return `${headline}

Completed : ${stats.completedTasks}/${stats.totalTasks}
Remaining : ${stats.remainingTasks}

Time Left : ${formatHours(stats.remainingHours)}

Next

${nextTask.text}`;
}

function buildCheckIn(nextTask) {
  const headline = random(CHECK_IN);

  return `${headline}

Current Task

${nextTask.text}`;
}

function buildRandomCheckIn(stats, nextTask) {
  const pool = [...MOMENTUM, ...DISTRACTION, ...CHECK_IN];
  const headline = random(pool);

  return `${headline}

Completed : ${stats.completedTasks}/${stats.totalTasks}
Remaining : ${stats.remainingTasks}

Time Left : ${formatHours(stats.remainingHours)}

Next

${nextTask.text}`;
}

function buildMediumReminder(stats, nextTask) {
  return `Status

Completed : ${stats.completedTasks}/${stats.totalTasks}
Remaining : ${stats.remainingTasks}

Time Left : ${formatHours(stats.remainingHours)}

Required Pace : ${stats.requiredPace.toFixed(1)} task(s)/hour

Next

${nextTask.text}`;
}

function buildHighReminder(stats, nextTask) {
  return `Status

Pressure : HIGH

Completed : ${stats.completedTasks}/${stats.totalTasks}
Remaining : ${stats.remainingTasks}

Time Left : ${formatHours(stats.remainingHours)}

Required Pace : ${stats.requiredPace.toFixed(1)} task(s)/hour

Priority

${nextTask.text}`;
}

function buildCriticalReminder(stats, nextTask) {
  return `Deadline Near

Remaining : ${stats.remainingTasks}

Time Left : ${formatHours(stats.remainingHours)}

Required Pace

${stats.requiredPace.toFixed(1)} task(s)/hour

Start

${nextTask.text}`;
}

module.exports = {
  buildLowReminder,
  buildCheckIn,
  buildRandomCheckIn,
  buildMediumReminder,
  buildHighReminder,
  buildCriticalReminder,
};
