const FOCUS_CHECK_INS = [
  ">> Still focused? You're doing well.",
  ">> Quick check — are you on the task?",
  ">> Stay with it. You're making progress.",
  ">> Don't switch tabs. Keep going.",
  ">> One more minute of focus changes everything.",
  ">> Breathe. Return to the task.",
  ">> You started this. Finish it.",
  ">> Distraction is temporary. Progress is permanent.",
  ">> Five more minutes. You've got this.",
  ">> Lock in. The task is almost done.",
];

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function focusStarted(session) {
  return `>> Focus Session Started

-- Duration --
${session.duration} minutes

-- Target --
${session.task.text}

Good luck.
I'll check in halfway.`;
}

function halfwayReminder(session) {
  return `>> Halfway There

Stay with the task.

-- Current Target --
${session.task.text}`;
}

function sessionComplete(session) {
  return `>> Focus Session Finished

Did you complete

${session.task.text} ?

Reply naturally.

Examples

Finished ${session.task.text}

Not yet`;
}

function focusCheckIn(session) {
  const message = random(FOCUS_CHECK_INS);

  return `${message}

-- Target --
${session.task.text}`;
}

module.exports = {
  focusStarted,
  halfwayReminder,
  sessionComplete,
  focusCheckIn,
};
