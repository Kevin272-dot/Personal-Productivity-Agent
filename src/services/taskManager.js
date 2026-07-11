let activeTaskList = null;

function setTaskList(taskList) {
  activeTaskList = taskList;
}

function getTaskList() {
  return activeTaskList;
}

function updateTaskList(patch) {
  if (!activeTaskList) return null;
  activeTaskList = {
    ...activeTaskList,
    ...patch,
  };
  return activeTaskList;
}

function clearTaskList() {
  activeTaskList = null;
}

module.exports = {
  setTaskList,
  getTaskList,
  updateTaskList,
  clearTaskList,
};
