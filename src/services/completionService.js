const { getTaskList, updateTaskList } = require("./taskManager");
const { createTaskRepository } = require("../../repositories/taskRepository");
const { createPlanRepository } = require("../../repositories/planRepository");

let taskRepository = null;
let planRepository = null;

function getTaskRepository() {
  if (!taskRepository) {
    taskRepository = createTaskRepository();
  }

  return taskRepository;
}

function getPlanRepository() {
  if (!planRepository) {
    planRepository = createPlanRepository();
  }

  return planRepository;
}

async function completeTask(message, chatId) {
  const taskList = await getTaskList(chatId);

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

      const completedAt = new Date();

      await getTaskRepository().update(task.dbId, {
        completed: true,
        completedAt,
      });

      const updatedTasks = taskList.tasks.map((currentTask) =>
        currentTask.dbId === task.dbId
          ? {
              ...currentTask,
              completed: true,
              completedAt,
            }
          : currentTask,
      );

      const updatedTaskList = {
        ...taskList,
        tasks: updatedTasks,
        completed: updatedTasks.filter((currentTask) => currentTask.completed)
          .length,
      };

      await updateTaskList({
        tasks: updatedTasks,
        completed: updatedTaskList.completed,
      });

      if (updatedTaskList.completed >= updatedTaskList.total) {
        await getPlanRepository().markCompleted(taskList.dbId);
      }

      return {
        success: true,
        task,
        taskList: updatedTaskList,
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
