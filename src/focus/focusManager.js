const { createFocusRepository } = require("../../repositories/focusRepository");

let focusRepository = null;

function getFocusRepository() {
  if (!focusRepository) {
    focusRepository = createFocusRepository();
  }

  return focusRepository;
}

let activeSession = null;

function startSession(session) {
  if (activeSession) {
    return Promise.resolve(false);
  }

  activeSession = {
    ...session,
    awaitingCompletion: false,
    halfwaySent: false,
    completed: false,
  };

  return getFocusRepository()
    .create({
      taskId: session.task.dbId,
      startedAt: session.startedAt,
      endedAt: null,
      duration: session.duration,
      completed: false,
    })
    .then((savedSession) => {
      activeSession.dbId = savedSession.id;
      return true;
    })
    .catch(() => {
      activeSession = null;
      return false;
    });
}

function getSession() {
  return activeSession;
}

function isSessionActive() {
  return activeSession !== null;
}

function markHalfwaySent() {
  if (!activeSession) return;

  activeSession.halfwaySent = true;
}

function markAwaitingCompletion() {
  if (!activeSession) return;

  activeSession.awaitingCompletion = true;
}

async function completeSession() {
  if (!activeSession) return;

  activeSession.completed = true;
  activeSession.endedAt = new Date();

  if (activeSession.dbId) {
    await getFocusRepository().update(activeSession.dbId, {
      completed: true,
      endedAt: activeSession.endedAt,
    });
  }
}

function endSession() {
  activeSession = null;
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
