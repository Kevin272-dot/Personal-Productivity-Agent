function classifyMessage(text) {
  const lower = text.toLowerCase().trim();

  if (
    lower.startsWith("delete all") ||
    lower.startsWith("clear all") ||
    lower === "reset"
  ) {
    return "DELETE_ALL";
  }

  const deleteDaysMatch = lower.match(/^delete last (\d+) days?$/);
  if (deleteDaysMatch) {
    return "DELETE_DAYS";
  }

  if (lower.startsWith("delete task") || lower.startsWith("remove task")) {
    return "DELETE_TASK";
  }

  if (lower.startsWith("rename ") || lower.startsWith("update task ")) {
    return "RENAME";
  }

  if (lower === "move" || lower.startsWith("move ")) {
    return "MOVE";
  }

  if (
    lower.startsWith("daily task") ||
    lower.startsWith("daily tasks") ||
    lower.startsWith("everyday task") ||
    lower.startsWith("everyday tasks") ||
    lower.startsWith("add daily") ||
    lower.startsWith("add everyday")
  ) {
    return "DAILY_TASK";
  }

  if (
    lower.startsWith("my daily") ||
    lower.startsWith("show daily") ||
    lower === "daily status" ||
    lower === "daily list"
  ) {
    return "DAILY_STATUS";
  }

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

  if (lower === "help") {
    return "HELP";
  }

  return "UNKNOWN";
}

module.exports = {
  classifyMessage,
};
