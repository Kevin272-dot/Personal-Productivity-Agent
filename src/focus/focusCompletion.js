const { getSession, completeSession, endSession } = require("./focusManager");

const { completeTask } = require("../services/completionService");

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
  const session = getSession();

  if (!session || !session.awaitingCompletion) {
    return null;
  }

  if (isPositiveResponse(message)) {
    const result = await completeTask(session.task.text, chatId);

    await completeSession();
    endSession();

    return {
      handled: true,
      success: true,
      completed: true,
      taskResult: result,
    };
  }

  if (isNegativeResponse(message)) {
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
