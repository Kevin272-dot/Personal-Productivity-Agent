require("dotenv").config();

const express = require("express");
const { default: TelegramBot } = require("node-telegram-bot-api");

const registerHandlers = require("./bot/handlers");
const { startReminderScheduler } = require("./scheduler/reminderScheduler");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("Productivity Agent is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Productivity Agent",
  });
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true,
});

console.log("Telegram bot started.");

registerHandlers(bot);
startReminderScheduler(bot);
