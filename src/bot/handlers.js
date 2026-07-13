const { parseMessage } = require("../services/taskParser");
const { setTaskList, getTaskList, clearTaskList, updateTaskList } = require("../services/taskManager");
const { completeTask } = require("../services/completionService");
const { classifyMessage } = require("../services/messageRouter");
const { getNextTask } = require("../services/taskSelector");
const { getSession } = require("../focus/focusManager");
const { ALLOWED_USERS, MAX_USERS } = require("../config/constants");
const { createUserRepository } = require("../../repositories/userRepository");
const { createPlanRepository } = require("../../repositories/planRepository");
const { createTaskRepository } = require("../../repositories/taskRepository");
const { formatToIST, parseDateIST, getOriginalDurationHours } = require("../utils/ist");

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
All times are in IST (Indian Standard Time).
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

MOVE DEADLINE
Send:
- move (defaults to 24h)
- move <duration>
Duration examples: 2h, 30m, 1d, tomorrow 8 PM
Opens an interface to select which tasks to move.

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
Example: delete last 3 days

OVERDUE TASKS
When a deadline passes, you can:
- Extend the deadline by the original duration
- Delete the remaining tasks`;

let userRepository = null;
let planRepository = null;
let taskRepository = null;

const moveSelections = new Map();

function getUserRepository() {
  if (!userRepository) userRepository = createUserRepository();
  return userRepository;
}

function getPlanRepository() {
  if (!planRepository) planRepository = createPlanRepository();
  return planRepository;
}

function getTaskRepository() {
  if (!taskRepository) taskRepository = createTaskRepository();
  return taskRepository;
}

function buildMoveKeyboard(tasks, selected, chatId, deadlineMs) {
  const keyboard = [];

  for (const task of tasks) {
    const isSelected = selected.has(task.dbId);
    const checkbox = isSelected ? "[x]" : "[ ]";
    keyboard.push([
      {
        text: `${checkbox} ${task.text}`,
        callback_data: `move_toggle:${chatId}:${task.dbId}`,
      },
    ]);
  }

  const selectedCount = selected.size;
  keyboard.push([
    {
      text: `Confirm Move (${selectedCount} task${selectedCount !== 1 ? "s" : ""})`,
      callback_data: `move_go:${chatId}:${deadlineMs}`,
    },
    {
      text: "Cancel",
      callback_data: "move_cancel",
    },
  ]);

  return keyboard;
}

function registerHandlers(bot) {
  bot.onText(/\/start/, (msg) => {
    logger.info("HANDLER", "/start command received");

    bot.sendMessage(
      msg.chat.id,
      `Welcome ${msg.from.first_name}!

I'm your Productivity Agent.

Send me your tasks in plain English.
All times are in IST (Indian Standard Time).

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
        if (result.alreadyCompleted) {
          logger.success("FOCUS", "Focus task was already completed.");

          bot.sendMessage(
            msg.chat.id,
            `Focus Session Ended\n\nTask was already completed.\n\n${activeSession.task.text}`,
          );
        } else if (result.completed) {
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
            `No problem.\n\nThe task is still pending.\n\nWhen you're ready, you can start another focus session.`,
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
          lastOverduePromptAt: null,
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

      case "MOVE": {
        const current = await getTaskList(msg.chat.id);

        if (!current) {
          bot.sendMessage(msg.chat.id, buildNoTaskResponse());
          break;
        }

        const remainingTasks = current.tasks.filter((t) => !t.completed);

        if (remainingTasks.length === 0) {
          bot.sendMessage(msg.chat.id, "All tasks are already completed. Nothing to move.");
          break;
        }

        const moveInput = msg.text.trim();
        const durationMatch = moveInput.match(/^move\s+(.+)$/i);
        let newDeadline;
        let durationLabel;

        if (durationMatch) {
          const durationStr = durationMatch[1].trim();

          const hoursMatch = durationStr.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i);
          const minutesMatch = durationStr.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?$/i);
          const daysMatch = durationStr.match(/^(\d+(?:\.\d+)?)\s*d(?:ays?)?$/i);

          if (hoursMatch) {
            const hours = parseFloat(hoursMatch[1]);
            newDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);
            durationLabel = `${hours} hour(s)`;
          } else if (minutesMatch) {
            const mins = parseFloat(minutesMatch[1]);
            newDeadline = new Date(Date.now() + mins * 60 * 1000);
            durationLabel = `${mins} minute(s)`;
          } else if (daysMatch) {
            const days = parseFloat(daysMatch[1]);
            newDeadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
            durationLabel = `${days} day(s)`;
          } else {
            const chronoDate = parseDateIST(durationStr);
            if (chronoDate && chronoDate.getTime() > Date.now()) {
              newDeadline = chronoDate;
              const diffHours = (chronoDate.getTime() - Date.now()) / (1000 * 60 * 60);
              durationLabel = `${diffHours.toFixed(1)} hour(s)`;
            } else {
              newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
              durationLabel = "24 hour(s)";
            }
          }
        } else {
          newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
          durationLabel = "24 hour(s)";
        }

        const selectedIds = new Set(remainingTasks.map((t) => t.dbId));

        moveSelections.set(msg.chat.id, {
          deadline: newDeadline,
          durationLabel,
          tasks: remainingTasks,
          selected: selectedIds,
        });

        const keyboard = buildMoveKeyboard(remainingTasks, selectedIds, msg.chat.id, newDeadline.getTime());

        let moveMsg = "";
        moveMsg += "Move Tasks\n";
        moveMsg += "────────────────────\n\n";
        moveMsg += `Select tasks to move to a new deadline.\n\n`;
        moveMsg += `New Deadline : ${formatToIST(newDeadline)} IST\n`;
        moveMsg += `Duration     : ${durationLabel}\n\n`;
        moveMsg += `Tap tasks to toggle selection.\n`;
        moveMsg += `All tasks are selected by default.`;

        bot.sendMessage(msg.chat.id, moveMsg, {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });

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

        const planRepo = getPlanRepository();
        const allPlans = await planRepo.findAllByUser(user.id);
        const planCount = Array.isArray(allPlans) ? allPlans.length : 0;

        bot.sendMessage(
          msg.chat.id,
          `This will permanently delete ${planCount} plan(s) and all associated tasks, reminders, and focus sessions.\n\nThis cannot be undone.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Yes, delete everything", callback_data: `delete_all_confirm:${msg.from.id}` },
                  { text: "No, cancel", callback_data: "delete_cancel" },
                ],
              ],
            },
          },
        );

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

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const planRepo = getPlanRepository();
        const oldPlans = await planRepo.findOlderThan(user.id, cutoff);
        const oldCount = Array.isArray(oldPlans) ? oldPlans.length : 0;

        bot.sendMessage(
          msg.chat.id,
          `This will permanently delete ${oldCount} plan(s) older than ${days} day(s) and all associated data.\n\nThis cannot be undone.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `Yes, delete ${oldCount} plan(s)`, callback_data: `delete_days_confirm:${msg.from.id}:${days}` },
                  { text: "No, cancel", callback_data: "delete_cancel" },
                ],
              ],
            },
          },
        );

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

  // =====================================================
  // Callback Query Handler (inline keyboard buttons)
  // =====================================================

  bot.on("callback_query", async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    bot.answerCallbackQuery(query.id);

    if (data === "delete_cancel") {
      bot.editMessageText("Cancelled. No data was deleted.", {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      return;
    }

    if (data.startsWith("delete_all_confirm:")) {
      const targetUserId = data.split(":")[1];

      if (String(userId) !== String(targetUserId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      const user = await getUserRepository().findByTelegramId(String(userId));

      if (!user) {
        bot.editMessageText("No data found for your account.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const planRepo = getPlanRepository();
      const deletedCount = await planRepo.deleteAllForUser(user.id);
      await clearTaskList(chatId);

      logger.success("HANDLER", `Deleted ${deletedCount} plan(s) for user ${userId}`);

      bot.editMessageText(`Done. Deleted ${deletedCount} plan(s) and all associated tasks.`, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      return;
    }

    if (data.startsWith("delete_days_confirm:")) {
      const parts = data.split(":");
      const targetUserId = parts[1];
      const days = parseInt(parts[2], 10);

      if (String(userId) !== String(targetUserId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      const user = await getUserRepository().findByTelegramId(String(userId));

      if (!user) {
        bot.editMessageText("No data found for your account.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const planRepo = getPlanRepository();
      const deletedCount = await planRepo.deleteOlderThanDays(user.id, days);

      logger.success("HANDLER", `Deleted ${deletedCount} plan(s) older than ${days} day(s) for user ${userId}`);

      bot.editMessageText(`Done. Deleted ${deletedCount} plan(s) older than ${days} day(s).`, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      return;
    }

    // =====================================================
    // Overdue Action Handlers
    // =====================================================

    if (data.startsWith("overdue_extend:")) {
      const parts = data.split(":");
      const targetChatId = parts[1];
      const durationHours = parseFloat(parts[2]);

      if (String(chatId) !== String(targetChatId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      const current = await getTaskList(chatId);

      if (!current) {
        bot.editMessageText("No active task list found.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const newDeadline = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      await updateTaskList({ deadline: newDeadline });

      logger.success("HANDLER", `Deadline extended by ${durationHours}h for user ${userId}`);

      bot.editMessageText(
        `Deadline Extended\n────────────────────\n\nNew Deadline : ${formatToIST(newDeadline)} IST\nTime Left    : ${durationHours}h\n\nYour tasks have been updated.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        },
      );
      return;
    }

    if (data.startsWith("overdue_delete:")) {
      const parts = data.split(":");
      const targetChatId = parts[1];

      if (String(chatId) !== String(targetChatId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      await clearTaskList(chatId);

      logger.success("HANDLER", `Tasks deleted after overdue for user ${userId}`);

      bot.editMessageText(
        "Tasks Deleted\n────────────────────\n\nAll remaining tasks have been deleted.\nSend new tasks to start fresh.",
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        },
      );
      return;
    }

    // =====================================================
    // Move Action Handlers
    // =====================================================

    if (data === "move_cancel") {
      const session = moveSelections.get(chatId);
      if (session) {
        moveSelections.delete(chatId);
      }

      bot.editMessageText("Move cancelled. No changes made.", {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      return;
    }

    if (data.startsWith("move_toggle:")) {
      const parts = data.split(":");
      const targetChatId = parts[1];
      const taskDbId = parts[2];

      if (String(chatId) !== String(targetChatId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      const session = moveSelections.get(chatId);

      if (!session) {
        bot.answerCallbackQuery(query.id, { text: "Session expired. Send 'move' again." });
        return;
      }

      if (session.selected.has(taskDbId)) {
        session.selected.delete(taskDbId);
      } else {
        session.selected.add(taskDbId);
      }

      const keyboard = buildMoveKeyboard(session.tasks, session.selected, chatId, session.deadline.getTime());

      const selectedCount = session.selected.size;
      const totalTasks = session.tasks.length;

      let moveMsg = "";
      moveMsg += "Move Tasks\n";
      moveMsg += "────────────────────\n\n";
      moveMsg += `Select tasks to move to a new deadline.\n\n`;
      moveMsg += `New Deadline : ${formatToIST(session.deadline)} IST\n`;
      moveMsg += `Duration     : ${session.durationLabel}\n\n`;
      moveMsg += `Selected : ${selectedCount}/${totalTasks} task(s)\n`;
      moveMsg += `Tap tasks to toggle. Then confirm.`;

      bot.editMessageText(moveMsg, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });

      return;
    }

    if (data.startsWith("move_go:")) {
      const parts = data.split(":");
      const targetChatId = parts[1];
      const deadlineMs = parseInt(parts[2], 10);

      if (String(chatId) !== String(targetChatId)) {
        bot.answerCallbackQuery(query.id, { text: "This is not your action." });
        return;
      }

      const session = moveSelections.get(chatId);

      if (!session) {
        bot.editMessageText("Session expired. Send 'move' again.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const selectedIds = [...session.selected];

      if (selectedIds.length === 0) {
        bot.answerCallbackQuery(query.id, { text: "No tasks selected." });
        return;
      }

      const current = await getTaskList(chatId);

      if (!current) {
        moveSelections.delete(chatId);
        bot.editMessageText("No active task list found.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const user = await getUserRepository().findByTelegramId(String(chatId));

      if (!user) {
        moveSelections.delete(chatId);
        bot.editMessageText("No data found for your account.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        return;
      }

      const newDeadline = new Date(deadlineMs);

      await getTaskRepository().deleteTasks(selectedIds);

      const planRepo = getPlanRepository();
      const newPlan = await planRepo.createPlan({
        deadline: newDeadline,
        completed: false,
        userId: user.id,
        tasks: {
          create: session.tasks
            .filter((t) => selectedIds.includes(t.dbId))
            .map((t) => ({
              title: t.text,
              priority: t.priority || "normal",
              completed: false,
              completedAt: null,
              createdAt: new Date(),
            })),
        },
      });

      const remainingInCurrent = current.tasks.filter(
        (t) => !t.completed && !selectedIds.includes(t.dbId),
      );

      if (remainingInCurrent.length === 0) {
        await planRepo.markCompleted(current.dbId);
      }

      await setTaskList({
        chatId,
        userName: current.user?.name || "User",
        createdAt: new Date(),
        deadline: current.deadline,
        total: remainingInCurrent.length,
        completed: 0,
        tasks: remainingInCurrent.map((t, i) => ({
          id: i + 1,
          text: t.text,
          completed: false,
          completedAt: null,
          priority: t.priority || "normal",
        })),
        lastReminderAt: null,
        lastReminderType: null,
        lastOverduePromptAt: null,
      });

      moveSelections.delete(chatId);

      logger.success("HANDLER", `${selectedIds.length} task(s) moved to ${formatToIST(newDeadline)} IST for user ${userId}`);

      bot.editMessageText(
        `Tasks Moved\n────────────────────\n\nMoved ${selectedIds.length} task(s) to a new plan.\nNew Deadline : ${formatToIST(newDeadline)} IST\n\nRemaining in current plan : ${remainingInCurrent.length} task(s)`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        },
      );
      return;
    }
  });
}

module.exports = registerHandlers;
