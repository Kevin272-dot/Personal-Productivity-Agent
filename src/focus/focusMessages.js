function focusStarted(session) {
  return `Focus Session Started

Duration : ${session.duration} minutes

Target

${session.task.text}

Good luck.

I'll check in halfway.`;
}

function halfwayReminder(session) {
  return `Halfway There

Stay with the task.

Current Target

${session.task.text}`;
}

function sessionComplete(session) {
  return `Focus Session Finished

Did you complete

${session.task.text} ?

Reply naturally.

Examples

Finished ${session.task.text}

Not yet`;
}

module.exports = {
  focusStarted,
  halfwayReminder,
  sessionComplete,
};
