const { uIOhook, UiohookKey } = require("uiohook-napi");

let activeSeconds = new Set(); // Set to store active seconds within the interval

function startTracking() {
  uIOhook.on("mousemove", (event) => {
    activeSeconds.add(Math.floor(event.time / 1000)); // Record the active second
  });

  uIOhook.on("keydown", (event) => {
    activeSeconds.add(Math.floor(event.time / 1000)); // Record the active second
  });

  uIOhook.on("mousedown", (event) => {
    activeSeconds.add(Math.floor(event.time / 1000)); // Record the active second
  });

  uIOhook.start();
}

function stopTracking() {
  uIOhook.stop();
}

function getActivityCount() {
  return activeSeconds.size; // Return the number of active seconds
}

function resetActivityCount() {
  activeSeconds.clear(); // Clear the set for the next interval
}

module.exports = {
  startTracking,
  stopTracking,
  getActivityCount,
  resetActivityCount,
};
