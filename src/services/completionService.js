const { getTaskList, updateTaskList, getDailyTasks, getAllDailyTasks } = require("./taskManager");
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
  const lower = message.toLowerCase();

  const taskName = lower
    .replace("finished", "")
    .replace("done", "")
    .replace("completed", "")
    .replace("complete", "")
    .trim();

  const taskList = await getTaskList(chatId);

  if (taskList) {
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
  }

  const dailyTasks = await getAllDailyTasks(chatId);

  for (const task of dailyTasks) {
    if (task.text.toLowerCase().includes(taskName)) {
      if (task.completed) {
        return {
          success: false,
          message: `"${task.text}" is already completed today.`,
        };
      }

      const completedAt = new Date();

      await getTaskRepository().update(task.dbId, {
        completed: true,
        completedAt,
      });

      const updatedDaily = dailyTasks.map((t) =>
        t.dbId === task.dbId ? { ...t, completed: true, completedAt } : t,
      );

      return {
        success: true,
        task,
        taskList: {
          ...taskList,
          tasks: updatedDaily,
          total: updatedDaily.length,
          completed: updatedDaily.filter((t) => t.completed).length,
        },
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
