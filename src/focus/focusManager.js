const { createFocusRepository } = require("../../repositories/focusRepository");

let focusRepository = null;

function getFocusRepository() {
  if (!focusRepository) {
    focusRepository = createFocusRepository();
  }

  return focusRepository;
}

const activeSessions = new Map();

function startSession(session) {
  const key = String(session.chatId);

  if (activeSessions.has(key)) {
    return Promise.resolve(false);
  }

  const sess = {
    ...session,
    awaitingCompletion: false,
    halfwaySent: false,
    completed: false,
  };

  activeSessions.set(key, sess);

  return getFocusRepository()
    .create({
      taskId: session.task.dbId,
      startedAt: session.startedAt,
      endedAt: null,
      duration: session.duration,
      completed: false,
    })
    .then((savedSession) => {
      sess.dbId = savedSession.id;
      return true;
    })
    .catch(() => {
      activeSessions.delete(key);
      return false;
    });
}

function getSession(chatId) {
  if (chatId) {
    return activeSessions.get(String(chatId)) || null;
  }

  const first = activeSessions.values().next().value;
  return first || null;
}

function isSessionActive(chatId) {
  if (chatId) {
    return activeSessions.has(String(chatId));
  }

  return activeSessions.size > 0;
}

function markHalfwaySent(chatId) {
  const sess = chatId ? activeSessions.get(String(chatId)) : activeSessions.values().next().value;
  if (!sess) return;
  sess.halfwaySent = true;
}

function markAwaitingCompletion(chatId) {
  const sess = chatId ? activeSessions.get(String(chatId)) : activeSessions.values().next().value;
  if (!sess) return;
  sess.awaitingCompletion = true;
}

async function completeSession(chatId) {
  const sess = chatId ? activeSessions.get(String(chatId)) : activeSessions.values().next().value;
  if (!sess) return;

  sess.completed = true;
  sess.endedAt = new Date();

  if (sess.dbId) {
    await getFocusRepository().update(sess.dbId, {
      completed: true,
      endedAt: sess.endedAt,
    });
  }
}

function endSession(chatId) {
  if (chatId) {
    activeSessions.delete(String(chatId));
  } else {
    const first = activeSessions.keys().next().value;
    if (first) activeSessions.delete(first);
  }
}

module.exports = {
  startSession,
  getSession,
  isSessionActive,
  markHalfwaySent,
  markAwaitingCompletion,
  completeSession,
  endSession,
};
