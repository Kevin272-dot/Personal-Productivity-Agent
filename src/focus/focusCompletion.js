const { getSession, completeSession, endSession } = require("./focusManager");

const { completeTask } = require("../services/completionService");

const { getTaskList } = require("../services/taskManager");

const { clearAwaitingCompletionTimer } = require("./focusScheduler");

function isPositiveResponse(text) {
  const lower = text.toLowerCase().trim();

  return [
    "done",
    "finished",
    "completed",
    "complete",
    "yes",
    "y",
    "yep",
    "yeah",
    "i finished",
    "i completed",
    "finished it",
    "done now",
  ].includes(lower);
}

function isNegativeResponse(text) {
  const lower = text.toLowerCase().trim();

  return [
    "no",
    "not yet",
    "still working",
    "still doing",
    "later",
    "nope",
    "almost",
  ].includes(lower);
}

async function handleFocusReply(message, chatId) {
  const session = getSession(chatId);

  if (!session || !session.awaitingCompletion) {
    return null;
  }

  clearAwaitingCompletionTimer();

  const taskList = await getTaskList(chatId);

  if (taskList) {
    const focusTask = taskList.tasks.find((t) => t.dbId === session.task.dbId);

    if (focusTask && focusTask.completed) {
      await completeSession(chatId);
      endSession(chatId);

      return {
        handled: true,
        success: true,
        completed: true,
        alreadyCompleted: true,
        taskList,
      };
    }
  }

  if (isPositiveResponse(message)) {
    const result = await completeTask(session.task.text, chatId);

    await completeSession(chatId);
    endSession(chatId);

    return {
      handled: true,
      success: true,
      completed: true,
      taskResult: result,
    };
  }

  if (isNegativeResponse(message)) {
    await completeSession(chatId);
    endSession(chatId);

    return {
      handled: true,
      success: true,
      completed: false,
    };
  }

  return {
    handled: false,
  };
}

module.exports = {
  handleFocusReply,
};
