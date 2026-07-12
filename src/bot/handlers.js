const { parseMessage } = require("../services/taskParser");
const { setTaskList, getTaskList } = require("../services/taskManager");
const { completeTask } = require("../services/completionService");
const { classifyMessage } = require("../services/messageRouter");
const { getNextTask } = require("../services/taskSelector");
const { getSession } = require("../focus/focusManager");

const { handleFocusReply } = require("../focus/focusCompletion");
const {
  buildTaskListResponse,
  buildCurrentTasksResponse,
  buildCompletionResponse,
  buildGreetingResponse,
  buildNoTaskResponse,
  buildUnknownResponse,
} = require("../services/responseBuilder");

const { isFocusCommand, extractDuration } = require("../focus/focusRouter");

const { startSession } = require("../focus/focusManager");

const { scheduleSession } = require("../focus/focusScheduler");

const { focusStarted } = require("../focus/focusMessages");

const logger = require("../utils/logger");

function registerHandlers(bot) {
  bot.onText(/\/start/, (msg) => {
    logger.info("HANDLER", "/start command received");

    bot.sendMessage(
      msg.chat.id,
      `Welcome Kevin!

I'm your Productivity Agent.

Send me your tasks in plain English.

Example

Today's Tasks

Cloud Assignment
Leetcode
Gym

Deadline tomorrow 8 PM`,
    );
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;

    if (msg.text.startsWith("/")) return;

    logger.info("HANDLER", `Message from ${msg.from.first_name}`);
    logger.info("HANDLER", msg.text);

    // =====================================================
    // Focus Mode
    // =====================================================

    if (isFocusCommand(msg.text)) {
      const current = await getTaskList(msg.chat.id);

      if (!current) {
        bot.sendMessage(msg.chat.id, buildNoTaskResponse());

        return;
      }

      const nextTask = getNextTask(current);

      if (!nextTask) {
        bot.sendMessage(msg.chat.id, "Today's plan is already complete.");

        return;
      }

      const duration = extractDuration(msg.text);

      const session = {
        task: nextTask,
        duration,
        startedAt: new Date(),
        endAt: new Date(Date.now() + duration * 60 * 1000),
        halfwaySent: false,
        completed: false,
        chatId: msg.chat.id,
      };

      const started = await startSession(session);

      if (!started) {
        bot.sendMessage(msg.chat.id, "A focus session is already running.");

        return;
      }

      logger.success("FOCUS", `Started ${duration} minute session`);

      scheduleSession(bot, session);

      bot.sendMessage(msg.chat.id, focusStarted(session));

      return;
    }

    const activeSession = getSession();

    if (activeSession?.awaitingCompletion) {
      const result = await handleFocusReply(msg.text, msg.chat.id);

      if (result?.handled) {
        if (result.completed) {
          logger.success(
            "FOCUS",
            `${activeSession.task.text} completed after focus session.`,
          );
          bot.sendMessage(
            msg.chat.id,
            buildCompletionResponse(result.taskResult.taskList),
          );
        } else {
          logger.info("FOCUS", "User did not complete the focus task.");

          bot.sendMessage(
            msg.chat.id,
            `No problem.

The task is still pending.

When you're ready, you can start another focus session.`,
          );
        }

        return;
      }
    }

    const messageType = classifyMessage(msg.text);

    logger.info("ROUTER", `Detected ${messageType}`);

    switch (messageType) {
      // ---------------------------------------------------

      case "TASK_LIST": {
        const parsedTaskList = parseMessage(msg.text);

        const taskList = {
          ...parsedTaskList,
          chatId: msg.chat.id,
          userName: msg.from.first_name,
          lastReminderAt: null,
          lastReminderType: null,
        };

        const savedTaskList = await setTaskList(taskList);

        logger.success("TASK_MANAGER", `${savedTaskList.total} task(s) stored`);

        bot.sendMessage(msg.chat.id, buildTaskListResponse(savedTaskList));

        break;
      }

      // ---------------------------------------------------

      case "QUESTION": {
        const current = await getTaskList(msg.chat.id);

        if (!current) {
          logger.warn(
            "TASK_MANAGER",
            "Question received with no active task list.",
          );

          bot.sendMessage(msg.chat.id, buildNoTaskResponse());

          break;
        }

        bot.sendMessage(msg.chat.id, buildCurrentTasksResponse(current));

        break;
      }

      // ---------------------------------------------------

      case "COMPLETION": {
        const result = await completeTask(msg.text, msg.chat.id);

        if (!result.success) {
          logger.warn("COMPLETION", result.message);

          bot.sendMessage(msg.chat.id, result.message);

          break;
        }

        logger.success("COMPLETION", `${result.task.text} completed`);

        bot.sendMessage(msg.chat.id, buildCompletionResponse(result.taskList));

        break;
      }

      // ---------------------------------------------------

      case "GREETING": {
        const current = await getTaskList(msg.chat.id);

        bot.sendMessage(msg.chat.id, buildGreetingResponse(current));

        break;
      }

      // ---------------------------------------------------

      default: {
        logger.warn("ROUTER", `Unknown message: ${msg.text}`);

        bot.sendMessage(msg.chat.id, buildUnknownResponse());
      }
    }
  });
}

module.exports = registerHandlers;
