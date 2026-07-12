const { getNextTask } = require("./taskSelector");

function formatRemainingTime(deadline) {
  const remainingHours =
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60);

  if (remainingHours <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.round(remainingHours * 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function getTaskStatistics(taskList) {
  if (!taskList) {
    return null;
  }

  const tasks = taskList.tasks || [];
  const total = taskList.total ?? tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const remainingTasks = tasks.filter((task) => !task.completed).length;
  const completion = total === 0 ? 100 : (completedTasks / total) * 100;

  const remainingHours =
    (taskList.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const overdue = remainingHours <= 0;
  const requiredPace = overdue
    ? Infinity
    : remainingHours > 0
      ? remainingTasks / remainingHours
      : Infinity;
  const estimatedMinutesPerTask =
    remainingTasks > 0 ? (remainingHours * 60) / remainingTasks : 0;

  let urgency = "LOW";

  if (requiredPace >= 1.5) {
    urgency = "CRITICAL";
  } else if (requiredPace >= 0.75) {
    urgency = "HIGH";
  } else if (requiredPace >= 0.25) {
    urgency = "MEDIUM";
  }

  if (overdue && remainingTasks > 0) {
    urgency = "CRITICAL";
  }

  return {
    completed: completedTasks,
    remaining: remainingTasks,
    total,
    completion,
    remainingHours,
    requiredPace,
    nextTask: getNextTask(taskList),
    completedTasks,
    remainingTasks,
    totalTasks: total,
    estimatedMinutesPerTask,
    pressure: requiredPace,
    urgency,
    overdue,
  };
}

module.exports = {
  formatRemainingTime,
  getTaskStatistics,
};
