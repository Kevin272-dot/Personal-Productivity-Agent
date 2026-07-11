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
