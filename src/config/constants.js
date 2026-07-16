const ALLOWED_USERS = []; // Empty = anyone can use. Add Telegram user IDs to restrict.
const MAX_USERS = 100; // 0 = unlimited. Set a number to cap users.

const DEFAULT_DEADLINE_HOURS = 24;

const REMINDER_INTERVALS = {
  LOW: 180,      // 3 hours
  MEDIUM: 90,    // 1.5 hours
  HIGH: 45,      // 45 minutes
  CRITICAL: 30,  // 30 minutes
};

const RANDOM_CHECKIN_CHANCE = 0.15;

const RANDOM_FOCUS_CHECKIN_CHANCE = 0.20;

const SCHEDULER_CRON = "0 * * * *"; // Every hour at minute 0

const TIMEZONE = "Asia/Kolkata";

const OVERDUE_PROMPT_COOLDOWN_MS = 60 * 60 * 1000;

const DAILY_REMINDER_HOUR = 9; // 9 AM IST

module.exports = {
  ALLOWED_USERS,
  MAX_USERS,
  DEFAULT_DEADLINE_HOURS,
  REMINDER_INTERVALS,
  RANDOM_CHECKIN_CHANCE,
  RANDOM_FOCUS_CHECKIN_CHANCE,
  SCHEDULER_CRON,
  TIMEZONE,
  OVERDUE_PROMPT_COOLDOWN_MS,
  DAILY_REMINDER_HOUR,
};
