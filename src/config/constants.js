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
