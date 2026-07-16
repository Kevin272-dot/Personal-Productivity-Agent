const { createUserRepository } = require("../../repositories/userRepository");
const { createPlanRepository } = require("../../repositories/planRepository");
const { createTaskRepository } = require("../../repositories/taskRepository");

let userRepository = null;
let planRepository = null;
let taskRepository = null;

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

function getTaskRepository() {
  if (!taskRepository) {
    taskRepository = createTaskRepository();
  }

  return taskRepository;
}

const activeTaskLists = new Map();

function mapTask(task, index) {
  return {
    id: index + 1,
    dbId: task.id,
    text: task.title,
    title: task.title,
    priority: task.priority,
    completed: task.completed,
    completedAt: task.completedAt,
    isDaily: Boolean(task.isDaily),
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

  const existing = activeTaskLists.get(String(taskList.chatId));
  if (existing && existing.dbId) {
    await getPlanRepository().markCompleted(existing.dbId);
  }

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
        isDaily: Boolean(task.isDaily),
      })),
    },
  });

  return mapPlanToTaskList(plan);
}

async function setTaskList(taskList) {
  const mapped = await persistPlan(taskList);
  activeTaskLists.set(String(taskList.chatId), mapped);
  return mapped;
}

async function getTaskList(chatId) {
  if (!chatId) {
    const first = activeTaskLists.values().next().value;
    return first || null;
  }

  const key = String(chatId);

  const cached = activeTaskLists.get(key);
  if (cached) {
    return cached;
  }

  const user = await getUserRepository().findByTelegramId(chatId);

  if (!user) {
    return null;
  }

  const plan = await getPlanRepository().getActivePlan(user.id);
  const mapped = mapPlanToTaskList(plan);

  if (mapped) {
    activeTaskLists.set(key, mapped);
  }

  return mapped;
}

async function updateTaskList(patch, chatId) {
  let target;

  if (chatId) {
    target = activeTaskLists.get(String(chatId));
  }

  if (!target) {
    target = activeTaskLists.values().next().value;
  }

  if (!target) return null;

  const dbUpdate = {};
  if (patch.completed !== undefined) dbUpdate.completed = patch.completed;
  if (patch.deadline !== undefined) dbUpdate.deadline = patch.deadline;

  if (Object.keys(dbUpdate).length > 0) {
    await getPlanRepository().update(target.dbId, dbUpdate);
  }

  const updated = {
    ...target,
    ...patch,
  };

  activeTaskLists.set(String(target.chatId), updated);

  return updated;
}

async function clearTaskList(chatId) {
  const taskList = await getTaskList(chatId);

  if (!taskList) {
    return null;
  }

  await getPlanRepository().markCompleted(taskList.dbId);
  activeTaskLists.delete(String(chatId));

  return taskList;
}

function getAllActiveTaskLists() {
  return [...activeTaskLists.values()];
}

async function addDailyTasks(chatId, taskTexts) {
  const user = await getUserRepository().upsertByTelegramId(chatId, {
    timezone: "Asia/Kolkata",
  });

  const dailyPlanId = await getPlanRepository().ensureDailyPlan(user.id);

  const created = [];

  for (const text of taskTexts) {
    const task = await getTaskRepository().createTask({
      title: text,
      priority: "normal",
      completed: false,
      isDaily: true,
      dailyPlanId,
    });
    created.push(task);
  }

  return created;
}

async function getDailyTasks(chatId) {
  const user = await getUserRepository().findByTelegramId(chatId);

  if (!user) {
    return [];
  }

  const tasks = await getTaskRepository().findIncompleteDailyByUserId(user.id);
  return tasks.map((t, i) => ({
    id: i + 1,
    dbId: t.id,
    text: t.title,
    title: t.title,
    priority: t.priority,
    completed: t.completed,
    completedAt: t.completedAt,
    isDaily: true,
  }));
}

async function getAllDailyTasks(chatId) {
  const user = await getUserRepository().findByTelegramId(chatId);

  if (!user) {
    return [];
  }

  const tasks = await getTaskRepository().findAllDailyByUserId(user.id);
  return tasks.map((t, i) => ({
    id: i + 1,
    dbId: t.id,
    text: t.title,
    title: t.title,
    priority: t.priority,
    completed: t.completed,
    completedAt: t.completedAt,
    isDaily: true,
  }));
}

async function resetDailyTasks(chatId) {
  const user = await getUserRepository().findByTelegramId(chatId);

  if (!user) {
    return;
  }

  await getPlanRepository().resetDailyTasks(user.id);
}

module.exports = {
  setTaskList,
  getTaskList,
  updateTaskList,
  clearTaskList,
  mapPlanToTaskList,
  getAllActiveTaskLists,
  addDailyTasks,
  getDailyTasks,
  getAllDailyTasks,
  resetDailyTasks,
};
