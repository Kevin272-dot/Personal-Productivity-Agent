const { getTaskList } = require("./taskManager");

function completeTask(message) {
  const taskList = getTaskList();

  if (!taskList) {
    return {
      success: false,
      message: "No active task list found.",
    };
  }

  const lower = message.toLowerCase();

  const taskName = lower
    .replace("finished", "")
    .replace("done", "")
    .replace("completed", "")
    .replace("complete", "")
    .trim();

  for (const task of taskList.tasks) {
    if (task.text.toLowerCase().includes(taskName)) {
      if (task.completed) {
        return {
          success: false,
          message: `"${task.text}" is already completed.`,
        };
      }

      task.completed = true;
      task.completedAt = new Date();

      taskList.completed++;

      return {
        success: true,
        task,
        taskList,
      };
    }
  }

  return {
    success: false,
    message: "Couldn't find that task.",
  };
}

module.exports = {
  completeTask,
};
