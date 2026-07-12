const { parseMessage } = require("../services/taskParser");
const { setTaskList, getTaskList, clearTaskList } = require("../services/taskManager");
const { completeTask } = require("../services/completionService");
const { classifyMessage } = require("../services/messageRouter");
const { getNextTask } = require("../services/taskSelector");
const { getSession } = require("../focus/focusManager");
const { ALLOWED_USERS, MAX_USERS } = require("../config/constants");
const { createUserRepository } = require("../../repositories/userRepository");
const { createPlanRepository } = require("../../repositories/planRepository");

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

const HELP_MESSAGE = `Here's what I can do:

SET TASKS
Send your tasks in plain English.
Example:
Today's Tasks
Leetcode
Gym
Deadline tomorrow 8 PM

CHECK STATUS
Send any of:
- what's left
- remaining
- list

COMPLETE A TASK
Send:
- done <task>
- finished <task>
- completed <task>

FOCUS MODE
Send:
- focus <minutes>
Starts a timed session on your next task.

DELETE ALL
Send any of:
- clear all
- delete all
- reset

DELETE OLD PLANS
Send:
- delete last <N> days
Example: delete last 3 days`;

let userRepository = null;
let planRepository = null;

function getUserRepository() {
  if (!userRepository) userRepository = createUserRepository();
  return userRepository;
}

function getPlanRepository() {
  if (!planRepository) planRepository = createPlanRepository();
  return planRepository;
}

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

  bot.onText(/\/help/, (msg) => {
    logger.info("HANDLER", "/help command received");

    bot.sendMessage(msg.chat.id, HELP_MESSAGE);
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;

    if (msg.text.startsWith("/")) return;

    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(msg.from.id)) {
      bot.sendMessage(msg.chat.id, "Access denied.");
      return;
    }

    if (MAX_USERS > 0) {
      const existingUser = await getUserRepository().findByTelegramId(String(msg.from.id));
      if (!existingUser) {
        const userRepo = getUserRepository();
        const allUsers = await userRepo.findAll();
        if (allUsers.length >= MAX_USERS) {
          bot.sendMessage(msg.chat.id, "Max user limit reached.");
          return;
        }
      }
    }

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

      case "DELETE_ALL": {
        const user = await getUserRepository().findByTelegramId(String(msg.from.id));

        if (!user) {
          bot.sendMessage(msg.chat.id, "No data found for your account.");
          break;
        }

        const deletedCount = await getPlanRepository().deleteAllForUser(user.id);
        await clearTaskList(msg.chat.id);

        logger.success("HANDLER", `Deleted ${deletedCount} plan(s) for user ${msg.from.id}`);

        bot.sendMessage(msg.chat.id, `Done. Deleted ${deletedCount} plan(s) and all associated tasks.`);

        break;
      }

      // ---------------------------------------------------

      case "DELETE_DAYS": {
        const user = await getUserRepository().findByTelegramId(String(msg.from.id));

        if (!user) {
          bot.sendMessage(msg.chat.id, "No data found for your account.");
          break;
        }

        const match = msg.text.toLowerCase().match(/^delete last (\d+) days?$/);
        const days = parseInt(match[1], 10);

        if (isNaN(days) || days <= 0) {
          bot.sendMessage(msg.chat.id, "Please specify a valid number of days.");
          break;
        }

        const deletedCount = await getPlanRepository().deleteOlderThanDays(user.id, days);

        logger.success("HANDLER", `Deleted ${deletedCount} plan(s) older than ${days} day(s) for user ${msg.from.id}`);

        bot.sendMessage(msg.chat.id, `Done. Deleted ${deletedCount} plan(s) older than ${days} day(s).`);

        break;
      }

      // ---------------------------------------------------

      case "HELP": {
        bot.sendMessage(msg.chat.id, HELP_MESSAGE);

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
