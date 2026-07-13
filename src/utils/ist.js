const chrono = require("chrono-node");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseDateIST(text) {
  const parsed = chrono.parseDate(text);
  if (!parsed) return null;

  const now = new Date();
  const systemOffsetMs = -(now.getTimezoneOffset() * 60 * 1000);
  const adjustment = systemOffsetMs - IST_OFFSET_MS;

  return new Date(parsed.getTime() + adjustment);
}

function getDefaultDeadlineIST() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function formatToIST(date) {
  if (!date) return "N/A";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getOriginalDurationHours(createdAt, deadline) {
  if (!createdAt || !deadline) return 24;
  const ms = deadline.getTime() - createdAt.getTime();
  return ms > 0 ? ms / (1000 * 60 * 60) : 24;
}

module.exports = {
  IST_OFFSET_MS,
  parseDateIST,
  getDefaultDeadlineIST,
  formatToIST,
  getOriginalDurationHours,
};
