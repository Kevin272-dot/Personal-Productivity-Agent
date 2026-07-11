function calculateReminder(taskList) {
  if (!taskList) {
    return null;
  }

  const now = new Date();

  const remainingTasks = taskList.tasks.filter(
    (task) => !task.completed,
  ).length;
  const completedTasks = taskList.tasks.filter((task) => task.completed).length;
  const totalTasks = taskList.total;

  const completion =
    totalTasks === 0 ? 100 : (completedTasks / totalTasks) * 100;

  const remainingHours =
    (taskList.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  const overdue = remainingHours <= 0;

  const pressure = overdue
    ? Infinity
    : remainingHours > 0
      ? remainingTasks / remainingHours
      : Infinity;

  let urgency = "LOW";

  if (pressure >= 1.5) {
    urgency = "CRITICAL";
  } else if (pressure >= 0.75) {
    urgency = "HIGH";
  } else if (pressure >= 0.25) {
    urgency = "MEDIUM";
  }

  if (overdue && remainingTasks > 0) {
    urgency = "CRITICAL";
  }

  return {
    remainingTasks,
    completedTasks,
    totalTasks,
    completion,
    remainingHours,
    pressure,
    urgency,
    overdue,
  };
}

module.exports = {
  calculateReminder,
};
