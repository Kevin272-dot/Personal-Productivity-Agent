const { formatRemainingTime, getTaskStatistics } = require("./taskStatistics");
const { formatToIST } = require("../utils/ist");

function buildTaskListResponse(taskList) {
  let message = "";

  message += "Daily Plan Created\n";
  message += "────────────────────\n\n";

  message += `Tasks      : ${taskList.total}\n`;
  message += `Deadline   : ${formatToIST(taskList.deadline)} IST\n`;
  message += `Time Left  : ${formatRemainingTime(taskList.deadline)}\n\n`;

  message += "Tasks\n";
  message += "────────────────────\n";

  taskList.tasks.forEach((task) => {
    message += `[ ] ${task.id}. ${task.text}\n`;
  });

  return message;
}

function buildCurrentTasksResponse(taskList) {
  const stats = getTaskStatistics(taskList);

  if (!stats) {
    return buildNoTaskResponse();
  }

  const { completed, remaining, nextTask, remainingHours, requiredPace } =
    stats;

  let message = "";

  message += "Today's Status\n";
  message += "────────────────────\n\n";

  message += `Completed : ${completed}/${taskList.total}\n`;
  message += `Remaining : ${remaining}\n`;
  message += `Deadline  : ${formatToIST(taskList.deadline)} IST\n`;
  message += `Time Left : ${formatRemainingTime(taskList.deadline)}\n`;

  if (remaining > 0 && remainingHours > 0) {
    message += `Required Pace : ${requiredPace.toFixed(1)} task(s)/hour\n`;
  }

  message += "\n";

  if (remaining > 0) {
    message += "Remaining Tasks\n";
    message += "────────────────────\n";

    taskList.tasks
      .filter((task) => !task.completed)
      .forEach((task) => {
        message += `[ ] ${task.id}. ${task.text}\n`;
      });

    message += "\n";
  }

  if (completed > 0) {
    message += "Completed Tasks\n";
    message += "────────────────────\n";

    taskList.tasks
      .filter((task) => task.completed)
      .forEach((task) => {
        message += `[x] ${task.id}. ${task.text}\n`;
      });

    message += "\n";
  }

  if (nextTask) {
    message += "Next Task\n";
    message += "────────────────────\n";
    message += `${nextTask.text}\n`;
  }

  if (remaining === 0) {
    message += "Status\n";
    message += "────────────────────\n";
    message += "All tasks completed.\n";
  }

  return message;
}

function buildCompletionResponse(taskList) {
  const stats = getTaskStatistics(taskList);

  if (!stats) {
    return buildNoTaskResponse();
  }

  let message = "";

  message += "Status Updated\n";
  message += "────────────────────\n\n";

  message += `Completed : ${stats.completed}/${taskList.total}\n`;
  message += `Remaining : ${stats.remaining}\n`;
  message += `Time Left : ${formatRemainingTime(taskList.deadline)}\n`;

  if (stats.nextTask) {
    message += `Next      : ${stats.nextTask.text}\n`;
  }

  message += "\n";

  message += buildCurrentTasksResponse(taskList);

  return message;
}

function buildGreetingResponse(taskList) {
  if (!taskList) {
    return `No active task list.

Send today's tasks to begin.

Example

Today's Tasks

Cloud Assignment
Gym
Leetcode

Deadline tomorrow 8 PM`;
  }

  const stats = getTaskStatistics(taskList);

  let message = "";

  message += "Current Status\n";
  message += "────────────────────\n\n";

  message += `Completed : ${stats.completed}/${taskList.total}\n`;
  message += `Remaining : ${stats.remaining}\n`;
  message += `Time Left : ${formatRemainingTime(taskList.deadline)}\n`;

  if (stats.nextTask) {
    message += `Next Task : ${stats.nextTask.text}\n`;
  }

  return message;
}

function buildNoTaskResponse() {
  return `No active task list.

Example

Today's Tasks

Cloud Assignment
Gym
Linux

Deadline tomorrow 8 PM`;
}

function buildUnknownResponse() {
  return `Unable to classify the message.

Examples

Today's Tasks

What's left?

Finished Gym

Focus 45`;
}

module.exports = {
  buildTaskListResponse,
  buildCurrentTasksResponse,
  buildCompletionResponse,
  buildGreetingResponse,
  buildNoTaskResponse,
  buildUnknownResponse,
};
