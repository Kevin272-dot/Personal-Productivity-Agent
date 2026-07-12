const { getTaskStatistics } = require("./taskStatistics");

function calculateReminder(taskList) {
  return getTaskStatistics(taskList);
}

module.exports = {
  calculateReminder,
};
