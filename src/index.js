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
