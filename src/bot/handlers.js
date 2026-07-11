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
