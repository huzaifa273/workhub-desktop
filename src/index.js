// const { ipcRenderer } = require("electron"); // Import ipcRenderer
window.electronAPI.getToken();
console.log("index.js is running");

document.getElementById("logoutButton").addEventListener("click", function () {
  // Send a message to the main process to remove user data
  window.electronAPI.logout();
});

document
  .getElementById("screenshotButton")
  .addEventListener("click", function () {
    // Send a message to the main process to capture a screenshot
    window.electronAPI.captureScreenshot();
  });

// Handle screenshot captured event
window.electronAPI.onScreenshotCaptured((event, screenshotPath) => {
  console.log("Screenshot saved to:", screenshotPath);
  new Notification("Screenshot Captured", {
    body: "Your display screenshot has been captured!",
  });
});

// Handle screenshot error event
window.electronAPI.onScreenshotError((event, error) => {
  console.error("Error capturing screenshot:", error);
  alert("Error capturing screenshot: " + error);
});

////////////// Time Tracker //////////////
//////////////////////////////////////////
let elapsedTime = 0;
let isTimerRunning = false;
const timerDisplay = document.getElementById("timerDisplay");

function updateTimerDisplay() {
  const hours = Math.floor(elapsedTime / 3600);
  const minutes = Math.floor((elapsedTime % 3600) / 60);
  const seconds = elapsedTime % 60;
  timerDisplay.textContent = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

document
  .getElementById("startTimerButton")
  .addEventListener("click", function () {
    if (!isTimerRunning) {
      isTimerRunning = true;
      window.electronAPI.startTimer();
    }
  });

document
  .getElementById("stopTimerButton")
  .addEventListener("click", function () {
    if (isTimerRunning) {
      isTimerRunning = false;
      window.electronAPI.stopTimer();
    }
  });

// Handle timer updates
window.electronAPI.onTimerUpdate((event, newElapsedTime) => {
  elapsedTime = newElapsedTime;
  updateTimerDisplay();
});

// Function to reset the timer at the end of the day
function resetTimerDaily() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  );
  const timeUntilMidnight = midnight - now;
  setTimeout(() => {
    elapsedTime = 0;
    updateTimerDisplay();
    resetTimerDaily();
  }, timeUntilMidnight);
}

resetTimerDaily();
