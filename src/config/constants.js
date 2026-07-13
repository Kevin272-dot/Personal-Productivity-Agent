const ALLOWED_USERS = []; // Empty = anyone can use. Add Telegram user IDs to restrict.
const MAX_USERS = 100; // 0 = unlimited. Set a number to cap users.

const DEFAULT_DEADLINE_HOURS = 24;

const REMINDER_INTERVALS = {
  LOW: 30,
  MEDIUM: 15,
  HIGH: 5,
  CRITICAL: 2,
};

const RANDOM_CHECKIN_CHANCE = 0.10;

const RANDOM_FOCUS_CHECKIN_CHANCE = 0.15;

const SCHEDULER_CRON = "* * * * *";

module.exports = {
  ALLOWED_USERS,
  MAX_USERS,
  DEFAULT_DEADLINE_HOURS,
  REMINDER_INTERVALS,
  RANDOM_CHECKIN_CHANCE,
  RANDOM_FOCUS_CHECKIN_CHANCE,
  SCHEDULER_CRON,
};
