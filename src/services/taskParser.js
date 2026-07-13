const chrono = require("chrono-node");
const { parseDateIST, getDefaultDeadlineIST } = require("../utils/ist");

const HEADING_PATTERNS = [
  /^today('s)?$/i,
  /^tasks?$/i,
  /^todo$/i,
  /^to\s*do$/i,
  /^need\s+to\s+finish$/i,
  /^things\s+to\s+do$/i,
  /^plan$/i,
  /^goals?$/i,
  /^today('s)?\s+tasks?$/i,
  /^my\s+tasks$/i,
  /^daily\s+tasks$/i,
  /^plan\s+for\s+(today|tomorrow)$/i,
  /^goals?\s+for\s+(today|tomorrow)$/i,
];

function isHeading(line) {
  const trimmed = line.trim().toLowerCase();
  return HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isDeadlineLine(line) {
  const results = chrono.parse(line);
  if (!results || results.length === 0) return false;

  const parsedText = results.map((r) => r.text).join(" ").trim();
  const lineLower = line.toLowerCase().trim();

  if (parsedText.length === 0) return false;

  const coverage = parsedText.length / lineLower.length;
  return coverage >= 0.5;
}

function parseMessage(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const tasks = [];
  let deadline = null;

  for (const line of lines) {
    const cleanedLine = line.replace(/^[-•*]\s*/, "").trim();
    if (!cleanedLine) continue;

    if (isHeading(cleanedLine)) {
      continue;
    }

    if (isDeadlineLine(cleanedLine)) {
      const parsedDate = parseDateIST(cleanedLine);
      if (parsedDate) {
        deadline = parsedDate;
        continue;
      }
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
    deadline = getDefaultDeadlineIST();
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
