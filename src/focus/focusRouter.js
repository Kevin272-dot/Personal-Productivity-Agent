function isFocusCommand(text) {
  return /^focus\s+\d+$/i.test(text);
}

function extractDuration(text) {
  const match = text.match(/\d+/);

  if (!match) {
    return 45;
  }

  return Number(match[0]);
}

module.exports = {
  isFocusCommand,
  extractDuration,
};
