# Productivity Agent - Full Code Snapshot

Generated on: 2026-07-12

This document captures the current application architecture and all current project code files.

Exclusions:

- `.env` is intentionally excluded.

## 1) High-Level Architecture

Flow:

Telegram -> handlers -> messageRouter -> parser/completion/query handling -> taskManager -> reminderService -> behaviourEngine -> reminderScheduler -> Telegram

Current module responsibilities:

- `src/index.js`: Application bootstrap and wiring.
- `src/bot/handlers.js`: Telegram input handling and user replies.
- `src/services/messageRouter.js`: Message type classification.
- `src/services/taskParser.js`: Natural language task and deadline parsing.
- `src/services/taskManager.js`: In-memory active task list state.
- `src/services/completionService.js`: Completion updates.
- `src/services/reminderService.js`: Reminder metrics/statistics calculation.
- `src/services/taskSelector.js`: Next task selection.
- `src/services/behaviourEngine.js`: Reminder decision and message generation.
- `src/scheduler/reminderScheduler.js`: Cron-driven reminder orchestration.
- `src/config/constants.js`: Shared constants and intervals.

## 2) Project Files Included

- `package.json`
- `README.md`
- `src/index.js`
- `src/bot/bot.js` (empty)
- `src/bot/commands.js` (empty)
- `src/bot/handlers.js`
- `src/config/constants.js`
- `src/config/env.js` (empty)
- `src/services/messageRouter.js`
- `src/services/taskParser.js`
- `src/services/taskManager.js`
- `src/services/completionService.js`
- `src/services/taskSelector.js`
- `src/services/reminderService.js`
- `src/services/behaviourEngine.js`
- `src/scheduler/reminderScheduler.js`

No files were found under `prisma/` at the time of snapshot.

---

## File: package.json

```json
{
  "name": "productivity_agent",
  "version": "1.0.0",
  "description": "A Telegram AI assistant that manages daily tasks,\r adaptive reminders,\r statistics,\r and productivity insights.",
  "main": "index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Kevin272-dot/Personal-Productivity-Agent.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "bugs": {
    "url": "https://github.com/Kevin272-dot/Personal-Productivity-Agent/issues"
  },
  "homepage": "https://github.com/Kevin272-dot/Personal-Productivity-Agent#readme",
  "dependencies": {
    "chrono-node": "^2.9.1",
    "dayjs": "^1.11.21",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "node-cron": "^4.6.0",
    "node-telegram-bot-api": "^1.1.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

## File: README.md

```md
# Productivity Agent

A Telegram AI assistant that manages daily tasks,
adaptive reminders,
statistics,
and productivity insights.
```

## File: src/index.js

```js
require("dotenv").config();

const { default: TelegramBot } = require("node-telegram-bot-api");
const registerHandlers = require("./bot/handlers");
const { startReminderScheduler } = require("./scheduler/reminderScheduler");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true,
});

console.log("Productivity agent is running...");

registerHandlers(bot);
startReminderScheduler(bot);
```

## File: src/bot/bot.js

```txt
(empty file)
```

## File: src/bot/commands.js

```txt
(empty file)
```

## File: src/bot/handlers.js

```js
const { parseMessage } = require("../services/taskParser");
const { setTaskList, getTaskList } = require("../services/taskManager");
const { completeTask } = require("../services/completionService");
const { classifyMessage } = require("../services/messageRouter");

function registerHandlers(bot) {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,

      `Welcome Kevin!

I'm your Productivity Agent.

Send me your tasks in plain English.`,
    );
  });

  bot.on("message", (msg) => {
    if (!msg.text) return;

    if (msg.text.startsWith("/")) return;

    console.log("From :", msg.from.first_name);
    console.log("Text :", msg.text);

    const messageType = classifyMessage(msg.text);

    switch (messageType) {
      case "TASK_LIST": {
        const parsedTaskList = parseMessage(msg.text);

        const taskList = {
          ...parsedTaskList,
          chatId: msg.chat.id,
          lastReminderAt: null,
          lastReminderType: null,
        };

        setTaskList(taskList);

        const current = getTaskList();

        let reply = "Daily Plan Created\n\n";

        reply += `Deadline : ${current.deadline.toLocaleString()}\n`;
        reply += `Tasks : ${current.total}\n\n`;

        reply += "Pending\n";
        reply += "-------\n";

        for (const task of current.tasks) {
          reply += `[ ] ${task.id}. ${task.text}\n`;
        }

        bot.sendMessage(msg.chat.id, reply);

        break;
      }

      case "QUESTION": {
        const current = getTaskList();

        if (!current) {
          bot.sendMessage(msg.chat.id, "No active task list.");
          break;
        }

        let reply = "Current Tasks\n\n";

        reply += `Deadline : ${current.deadline.toLocaleString()}\n`;
        reply += `Progress : ${current.completed}/${current.total}\n\n`;

        for (const task of current.tasks) {
          const status = task.completed ? "[x]" : "[ ]";
          reply += `${status} ${task.id}. ${task.text}\n`;
        }

        bot.sendMessage(msg.chat.id, reply);

        break;
      }

      case "COMPLETION": {
        const result = completeTask(msg.text);

        if (!result.success) {
          bot.sendMessage(msg.chat.id, result.message);
          break;
        }

        let reply = "Task Completed\n\n";

        reply += `Progress : ${result.taskList.completed}/${result.taskList.total}\n\n`;

        reply += "Tasks\n";
        reply += "-----\n";

        for (const task of result.taskList.tasks) {
          const status = task.completed ? "[x]" : "[ ]";
          reply += `${status} ${task.id}. ${task.text}\n`;
        }

        bot.sendMessage(msg.chat.id, reply);

        break;
      }

      case "GREETING": {
        bot.sendMessage(msg.chat.id, "Hello Kevin!");

        break;
      }

      default: {
        bot.sendMessage(msg.chat.id, "I didn't understand that.");
      }
    }
  });
}

module.exports = registerHandlers;
```

## File: src/config/constants.js

```js
const DEFAULT_DEADLINE_HOURS = 24;

const REMINDER_INTERVALS = {
  LOW: 180,
  MEDIUM: 60,
  HIGH: 30,
  CRITICAL: 10,
};

const SCHEDULER_CRON = "* * * * *";

module.exports = {
  DEFAULT_DEADLINE_HOURS,
  REMINDER_INTERVALS,
  SCHEDULER_CRON,
};
```

## File: src/config/env.js

```txt
(empty file)
```

## File: src/services/messageRouter.js

```js
function classifyMessage(text) {
  const lower = text.toLowerCase().trim();

  if (
    lower.includes("today") ||
    lower.includes("tasks") ||
    lower.includes("todo") ||
    lower.includes("need to finish")
  ) {
    return "TASK_LIST";
  }

  if (
    lower.includes("what's left") ||
    lower.includes("whats left") ||
    lower.includes("remaining") ||
    lower === "list"
  ) {
    return "QUESTION";
  }

  if (
    lower.startsWith("done") ||
    lower.startsWith("finished") ||
    lower.startsWith("completed")
  ) {
    return "COMPLETION";
  }

  if (["hi", "hello", "hey", "good morning", "good evening"].includes(lower)) {
    return "GREETING";
  }

  return "UNKNOWN";
}

module.exports = {
  classifyMessage,
};
```

## File: src/services/taskParser.js

```js
const chrono = require("chrono-node");

function parseMessage(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const tasks = [];
  let deadline = null;
  const ignoredHeadings = [
    "today",
    "tasks",
    "todo",
    "to do",
    "need to finish",
    "things to do",
    "plan",
    "goals",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (ignoredHeadings.some((heading) => lower.includes(heading))) {
      continue;
    }
    const cleanedLine = line.replace(/^[-•*]\s*/, "");
    if (!cleanedLine) continue;

    const parsedDate = chrono.parseDate(cleanedLine);
    if (parsedDate) {
      deadline = parsedDate;
      continue;
    }
    if (
      tasks.some(
        (task) => task.text.toLowerCase() === cleanedLine.toLowerCase(),
      )
    ) {
      continue;
    }

    tasks.push({
      id: tasks.length + 1,
      text: cleanedLine,
      completed: false,
      completedAt: null,
      priority: "normal",
    });
  }

  if (!deadline) {
    deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  return {
    createdAt: new Date(),
    deadline,
    total: tasks.length,
    completed: 0,
    tasks,
  };
}

module.exports = { parseMessage };
```

## File: src/services/taskManager.js

```js
let activeTaskList = null;

function setTaskList(taskList) {
  activeTaskList = taskList;
}

function getTaskList() {
  return activeTaskList;
}

function updateTaskList(patch) {
  if (!activeTaskList) return null;
  activeTaskList = {
    ...activeTaskList,
    ...patch,
  };
  return activeTaskList;
}

function clearTaskList() {
  activeTaskList = null;
}

module.exports = {
  setTaskList,
  getTaskList,
  updateTaskList,
  clearTaskList,
};
```

## File: src/services/completionService.js

```js
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
```

## File: src/services/taskSelector.js

```js
function getNextTask(taskList) {
  if (!taskList) return null;

  return taskList.tasks.find((task) => !task.completed) || null;
}

module.exports = {
  getNextTask,
};
```

## File: src/services/reminderService.js

```js
function calculateReminder(taskList) {
  if (!taskList) {
    return null;
  }

  const now = new Date();

  const remainingTasks = taskList.tasks.filter(
    (task) => !task.completed,
  ).length;
  const completedTasks = taskList.tasks.filter((task) => task.completed).length;
  const totalTasks = taskList.total;

  const completion =
    totalTasks === 0 ? 100 : (completedTasks / totalTasks) * 100;

  const remainingHours =
    (taskList.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  const overdue = remainingHours <= 0;

  const pressure = overdue
    ? Infinity
    : remainingHours > 0
      ? remainingTasks / remainingHours
      : Infinity;

  let urgency = "LOW";

  if (pressure >= 1.5) {
    urgency = "CRITICAL";
  } else if (pressure >= 0.75) {
    urgency = "HIGH";
  } else if (pressure >= 0.25) {
    urgency = "MEDIUM";
  }

  if (overdue && remainingTasks > 0) {
    urgency = "CRITICAL";
  }

  return {
    remainingTasks,
    completedTasks,
    totalTasks,
    completion,
    remainingHours,
    pressure,
    urgency,
    overdue,
  };
}

module.exports = {
  calculateReminder,
};
```

## File: src/services/behaviourEngine.js

```js
const { getNextTask } = require("./taskSelector");

const RANDOM_MESSAGES = [
  "Still focused?",
  "One task now is better than ten later.",
  "Momentum beats motivation.",
  "Finish one task before checking social media again.",
  "Five minutes of focus is enough to restart.",
  "Close every distraction and finish one thing.",
  "You don't need motivation. You need momentum.",
  "Your future self is waiting.",
];

function randomCheckIn() {
  return RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
}

function mediumReminder(stats, nextTask) {
  return `Reminder

Remaining Tasks : ${stats.remainingTasks}
Time Left : ${Math.max(0, stats.remainingHours).toFixed(1)} hours

Suggested Next Task
${nextTask.text}

Keep the momentum going.`;
}

function highReminder(stats, nextTask) {
  return `You're starting to fall behind.

Remaining Tasks : ${stats.remainingTasks}
Time Left : ${Math.max(0, stats.remainingHours).toFixed(1)} hours

Suggested Next Task
${nextTask.text}`;
}

function criticalReminder(stats, nextTask) {
  return `Critical

${stats.remainingTasks} tasks remain.
Only ${Math.max(0, stats.remainingHours).toFixed(1)} hours left.

Stop scrolling.
Do this now:
${nextTask.text}`;
}

function overdueEscalation(stats, nextTask) {
  return `Deadline missed.

${stats.remainingTasks} tasks are still pending.

Recovery action:
1) Start immediately
2) Finish this first:
${nextTask.text}
3) Do not switch context until done`;
}

function decideReminder(taskList, stats) {
  if (!taskList || !stats) {
    return { shouldSend: false };
  }

  const nextTask = getNextTask(taskList);

  if (!nextTask) {
    return { shouldSend: false };
  }

  if (stats.remainingTasks === 0) {
    return { shouldSend: false };
  }

  if (stats.overdue) {
    return {
      shouldSend: true,
      type: "ESCALATION",
      message: overdueEscalation(stats, nextTask),
    };
  }

  if (Math.random() < 0.1) {
    return {
      shouldSend: true,
      type: "CHECK_IN",
      message: randomCheckIn(),
    };
  }

  switch (stats.urgency) {
    case "LOW":
      return { shouldSend: false };

    case "MEDIUM":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: mediumReminder(stats, nextTask),
      };

    case "HIGH":
      return {
        shouldSend: true,
        type: "REMINDER",
        message: highReminder(stats, nextTask),
      };

    case "CRITICAL":
      return {
        shouldSend: true,
        type: "ESCALATION",
        message: criticalReminder(stats, nextTask),
      };

    default:
      return { shouldSend: false };
  }
}

module.exports = {
  decideReminder,
};
```

## File: src/scheduler/reminderScheduler.js

```js
const cron = require("node-cron");
const { REMINDER_INTERVALS, SCHEDULER_CRON } = require("../config/constants");
const { getTaskList, updateTaskList } = require("../services/taskManager");
const { calculateReminder } = require("../services/reminderService");
const { decideReminder } = require("../services/behaviourEngine");

function shouldSendNow(taskList, urgency) {
  const intervalMinutes =
    REMINDER_INTERVALS[urgency] ?? REMINDER_INTERVALS.MEDIUM;

  if (!taskList.lastReminderAt) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(taskList.lastReminderAt).getTime();
  const requiredMs = intervalMinutes * 60 * 1000;

  return elapsedMs >= requiredMs;
}

function startReminderScheduler(bot) {
  cron.schedule(SCHEDULER_CRON, async () => {
    try {
      const taskList = getTaskList();

      if (!taskList || !taskList.chatId) {
        return;
      }

      const stats = calculateReminder(taskList);

      if (!stats || stats.remainingTasks === 0) {
        return;
      }

      if (!shouldSendNow(taskList, stats.urgency)) {
        return;
      }

      const decision = decideReminder(taskList, stats);

      if (!decision.shouldSend) {
        return;
      }

      await bot.sendMessage(taskList.chatId, decision.message);

      updateTaskList({
        lastReminderAt: new Date(),
        lastReminderType: decision.type,
      });

      console.log(`
        [[Reminder] ${decision.type} sent to ${taskList.chatId} | urgency=${stats.urgency}](http://_vscodecontentref_/11),
      `);
    } catch (error) {
      console.error("[ReminderScheduler] Failed cycle:", error.message);
    }
  });
}

module.exports = {
  startReminderScheduler,
};
```
