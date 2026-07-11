function getNextTask(taskList) {
  if (!taskList) return null;

  return taskList.tasks.find((task) => !task.completed) || null;
}

module.exports = {
  getNextTask,
};
