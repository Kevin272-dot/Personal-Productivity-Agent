const { createUserRepository } = require("../../repositories/userRepository");
const { createPlanRepository } = require("../../repositories/planRepository");

let userRepository = null;
let planRepository = null;

function getUserRepository() {
  if (!userRepository) {
    userRepository = createUserRepository();
  }

  return userRepository;
}

function getPlanRepository() {
  if (!planRepository) {
    planRepository = createPlanRepository();
  }

  return planRepository;
}

let activeTaskList = null;

function mapTask(task, index) {
  return {
    id: index + 1,
    dbId: task.id,
    text: task.title,
    title: task.title,
    priority: task.priority,
    completed: task.completed,
    completedAt: task.completedAt,
  };
}

function mapPlanToTaskList(plan) {
  if (!plan) {
    return null;
  }

  const tasks = [...(plan.tasks || [])]
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .map(mapTask);
  const latestReminder = [...(plan.reminderHistory || [])].sort(
    (left, right) => new Date(right.sentAt) - new Date(left.sentAt),
  )[0];

  return {
    id: plan.id,
    dbId: plan.id,
    chatId: plan.user?.telegramId || plan.userId,
    userId: plan.userId,
    deadline: new Date(plan.deadline),
    createdAt: new Date(plan.createdAt),
    completed: tasks.filter((task) => task.completed).length,
    total: tasks.length,
    tasks,
    lastReminderAt: latestReminder ? latestReminder.sentAt : null,
    lastReminderType: latestReminder ? latestReminder.type : null,
    lastOverduePromptAt: null,
    user: plan.user,
  };
}

async function persistPlan(taskList) {
  const user = await getUserRepository().upsertByTelegramId(taskList.chatId, {
    name: taskList.userName || null,
    timezone: taskList.timezone || "UTC",
  });

  const plan = await getPlanRepository().createPlan({
    deadline: taskList.deadline,
    completed: false,
    userId: user.id,
    tasks: {
      create: (taskList.tasks || []).map((task, index) => ({
        title: task.title || task.text,
        priority: task.priority || "normal",
        completed: Boolean(task.completed),
        completedAt: task.completedAt || null,
        createdAt: task.createdAt || new Date(Date.now() + index),
      })),
    },
  });

  return mapPlanToTaskList(plan);
}

async function setTaskList(taskList) {
  activeTaskList = await persistPlan(taskList);
  return activeTaskList;
}

async function getTaskList(chatId) {
  if (
    activeTaskList &&
    (!chatId || String(activeTaskList.chatId) === String(chatId))
  ) {
    return activeTaskList;
  }

  if (!chatId) {
    return activeTaskList;
  }

  const user = await getUserRepository().findByTelegramId(chatId);

  if (!user) {
    return null;
  }

  const plan = await getPlanRepository().getActivePlan(user.id);

  activeTaskList = mapPlanToTaskList(plan);
  return activeTaskList;
}

async function updateTaskList(patch) {
  if (!activeTaskList) return null;

  const dbUpdate = {};
  if (patch.completed !== undefined) dbUpdate.completed = patch.completed;
  if (patch.deadline !== undefined) dbUpdate.deadline = patch.deadline;

  if (Object.keys(dbUpdate).length > 0) {
    await getPlanRepository().update(activeTaskList.dbId, dbUpdate);
  }

  activeTaskList = {
    ...activeTaskList,
    ...patch,
  };

  return activeTaskList;
}

async function clearTaskList(chatId) {
  const taskList = await getTaskList(chatId);

  if (!taskList) {
    return null;
  }

  await getPlanRepository().markCompleted(taskList.dbId);
  activeTaskList = null;

  return taskList;
}

module.exports = {
  setTaskList,
  getTaskList,
  updateTaskList,
  clearTaskList,
  mapPlanToTaskList,
};
