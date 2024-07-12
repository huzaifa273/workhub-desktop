const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const { captureScreenshot } = require("./screenshot");
const { getActivityCount, resetActivityCount } = require("./activityTracker");

let timerInterval;
let elapsedTime = 0;
let timerRunning = false;
let lastUpdateTime = Date.now();
let lastIntervalStartTime = Date.now(); // Track the start time of the last interval
let screenshotInterval;
let activityStoreInterval;
let currentSession = null; // Track the current session

const activityDataDir = path.join(__dirname, "activityData");
const timerLogPath = path.join(activityDataDir, "timerLog.json");

function logTimerEvent(event) {
  const now = new Date();
  const dateString = now.toISOString().split("T")[0];
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  let logData = [];
  try {
    logData = fs.readJSONSync(timerLogPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error reading timer log:", error);
    }
  }

  const dayLog = logData.find((entry) => entry.date === dateString) || {
    date: dateString,
    logs: [],
  };

  if (event === "start") {
    currentSession = { startTime: timeString }; // Store the current session in memory
    dayLog.logs.push(currentSession);
  } else if (event === "stop") {
    if (currentSession) {
      currentSession.stopTime = timeString; // Update the current session with stop time
      currentSession = null; // Clear the current session
    }
  }

  if (!logData.find((entry) => entry.date === dateString)) {
    logData.push(dayLog);
  }

  fs.writeJSONSync(timerLogPath, logData, { spaces: 2 });
}

function startTimer() {
  if (!timerRunning) {
    timerRunning = true;
    lastUpdateTime = Date.now();
    lastIntervalStartTime = lastUpdateTime; // Initialize the start time of the last interval
    logTimerEvent("start");
    timerInterval = setInterval(() => {
      const now = Date.now();
      elapsedTime += Math.floor((now - lastUpdateTime) / 1000);
      lastUpdateTime = now;
      // Send the updated elapsed time to the renderer process
      global.mainWindow.webContents.send("timer-update", elapsedTime);
    }, 1000);

    // Start taking screenshots every 3 minutes
    screenshotInterval = setInterval(async () => {
      const Store = (await import("electron-store")).default;
      const store = new Store();
      const userdata = store.get("userData");
      await captureScreenshot(userdata.user._id);
    }, 180000); // 3 minutes

    // Start storing activity data every 3 minutes
    activityStoreInterval = setInterval(() => {
      storeActivityDataWithInterval();
    }, 180000); // 3 minutes
  }
}

async function stopTimer() {
  if (timerRunning) {
    timerRunning = false;
    clearInterval(timerInterval);
    clearInterval(screenshotInterval);
    clearInterval(activityStoreInterval);
    logTimerEvent("stop");

    // Store activity data immediately with the actual elapsed time
    await storeActivityDataWithElapsedTime();
  }
}

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
    global.mainWindow.webContents.send("timer-update", elapsedTime);
    storeActivityDataWithInterval(); // Store activity data at the end of the day
    resetTimerDaily();
  }, timeUntilMidnight);
}

function getElapsedTime() {
  return elapsedTime;
}

function checkIfTimerRunning() {
  return timerRunning;
}

ipcMain.on("start-timer", () => {
  startTimer();
});

ipcMain.on("stop-timer", async () => {
  await stopTimer();
});

ipcMain.handle("get-elapsed-time", async () => {
  return getElapsedTime();
});

ipcMain.handle("is-timer-running", async () => {
  return checkIfTimerRunning();
});

resetTimerDaily();

async function storeActivityDataWithInterval() {
  const activityCount = getActivityCount();
  const currentDate = new Date();
  const startTime = new Date(lastIntervalStartTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const startDate = new Date(lastIntervalStartTime).toISOString().split("T")[0];
  const endTime = currentDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endDate = currentDate.toISOString().split("T")[0];
  const activityRate = (activityCount / 180) * 100; // Calculate activity rate as a percentage for 3 minutes

  const activityEntry = {
    startTime,
    startDate,
    endTime,
    endDate,
    activityRate,
  };

  const activityDataPath = path.join(activityDataDir, "activityData.json");

  // Read existing activity data
  let existingActivityData = [];
  try {
    existingActivityData = await fs.readJSON(activityDataPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error reading existing activity data:", error);
    }
  }

  // Append new data
  existingActivityData.push(activityEntry);
  resetActivityCount();

  // Write updated data back to the file
  await fs.writeJSON(activityDataPath, existingActivityData, {
    spaces: 2,
  });

  console.log(
    "Activity data stored locally from timeTracking.js:",
    activityEntry
  );

  // Update the last interval start time
  lastIntervalStartTime = Date.now();
}

async function storeActivityDataWithElapsedTime() {
  const activityCount = getActivityCount();
  const now = Date.now();
  const elapsedMilliseconds = now - lastIntervalStartTime;

  console.log(`Elapsed milliseconds: ${elapsedMilliseconds}`);
  console.log(`Last interval start time: ${lastIntervalStartTime}`);
  console.log(`Current time: ${now}`);

  if (elapsedMilliseconds < 1000) {
    // If the elapsed time is less than 1 second, skip recording to avoid invalid entries
    return;
  }

  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);

  const startTime = new Date(currentSession.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const startDate = new Date(currentSession.startTime)
    .toISOString()
    .split("T")[0];
  const endTime = new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endDate = new Date(now).toISOString().split("T")[0];
  const activityRate = (activityCount / elapsedSeconds) * 100;

  const activityEntry = {
    startTime,
    startDate,
    endTime,
    endDate,
    activityRate,
  };

  const activityDataPath = path.join(activityDataDir, "activityData.json");

  // Read existing activity data
  let existingActivityData = [];
  try {
    existingActivityData = await fs.readJSON(activityDataPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error reading existing activity data:", error);
    }
  }

  // Append new data
  existingActivityData.push(activityEntry);
  resetActivityCount();

  // Write updated data back to the file
  await fs.writeJSON(activityDataPath, existingActivityData, {
    spaces: 2,
  });

  console.log(
    "Activity data stored locally from timeTracking.js:",
    activityEntry
  );

  // If the log file is empty, update the last log entry in the database with the stop time
  if (existingActivityData.length === 0) {
    try {
      const Store = (await import("electron-store")).default;
      const store = new Store();
      const userdata = store.get("userData");

      await axios.post("http://localhost:5000/api/put/updateLastLog", {
        user: userdata.user._id,
        endTime,
        endDate,
      });

      console.log("Successfully updated the last log in the database");
    } catch (error) {
      console.error("Error updating the last log in the database:", error);
    }
  }

  // Reset current session
  currentSession = null;

  lastIntervalStartTime = now; // Update the last interval start time
}

module.exports = {
  startTimer,
  stopTimer,
  getElapsedTime,
  checkIfTimerRunning,
  storeActivityDataWithInterval, // Export the function
  logTimerEvent,
};
