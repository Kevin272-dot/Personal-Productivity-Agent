function timestamp() {
  return new Date().toLocaleString();
}

function info(module, message) {
  console.log(`[${timestamp()}] [INFO] [${module}] ${message}`);
}

function warn(module, message) {
  console.warn(`[${timestamp()}] [WARN] [${module}] ${message}`);
}

function error(module, message) {
  console.error(`[${timestamp()}] [ERROR] [${module}] ${message}`);
}

function success(module, message) {
  console.log(`[${timestamp()}] [SUCCESS] [${module}] ${message}`);
}

module.exports = { info, warn, error, success };
