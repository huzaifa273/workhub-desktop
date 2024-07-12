const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs-extra");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { captureScreenshot } = require("./screenshot"); // Import the screenshot module
const {
  checkIfTimerRunning,
  stopTimer,
  storeActivityDataWithInterval,
} = require("./timeTracking"); // Import the time tracking module
const {
  startTracking,
  stopTracking,
  getActivityCount,
  resetActivityCount,
} = require("./activityTracker");

let mainWindow;
let isUploading = false; // Flag to check if the application is uploading screenshots
let screenshotDetailInformation = {}; // Initialize as an empty object
let activityData = [];
const dataDir = path.join(__dirname, "data");
const activityDataDir = path.join(__dirname, "activityData");
// AWS S3 Credentials
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA47CRWGX5FNTGKSXR",
    secretAccessKey: "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",
  },
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true, // Set to false to prevent direct use of require in renderer
    },
  });

  global.mainWindow = mainWindow; // Set global.mainWindow after creating the window

  // and load the index.html of the app.
  (async () => {
    const Store = (await import("electron-store")).default;
    const store = new Store();

    // Check if user data is present in the store
    const userdata = store.get("userData");
    if (userdata) {
      mainWindow.loadFile(path.join(__dirname, "index.html"));
    } else {
      mainWindow.loadFile(path.join(__dirname, "login.html"));
    }
  })();

  // Listen for 'logout' event to clear the user data and redirect to login
  ipcMain.on("logout", async () => {
    const Store = (await import("electron-store")).default;
    const store = new Store();
    store.delete("userData"); // Remove the user data
    console.log("User logged out, userData removed.");

    // Redirect to login page
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, "login.html"));
    }
  });
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// Dynamically import Electron Store
async function initialize() {
  const Store = (await import("electron-store")).default;
  const store = new Store();

  // Listen for 'store-token' event to save the token
  ipcMain.on("store-token", (event, userdata) => {
    store.set("userData", userdata); // Store the token securely
  });

  // Listen for 'get-token' event to retrieve the token
  ipcMain.on("get-token", (event) => {
    const userdata = store.get("userData"); // Retrieve the token
    console.log("get-token in main:", userdata);
    event.sender.send("send-token", userdata); // Send the token back to the renderer process
  });
}
initialize();

// Listen for 'capture-screenshot' event to take a screenshot
// ipcMain.on("capture-screenshot", async (event) => {
//   try {
//     const Store = (await import("electron-store")).default;
//     const store = new Store();
//     const userdata = store.get("userData");
//     screenshotDetailInformation = await captureScreenshot(userdata.user._id);
//     event.sender.send("screenshot-captured", screenshotDetailInformation.name);
//   } catch (err) {
//     event.sender.send("screenshot-error", err.message);
//   }
// });

async function uploadScreenshotsToS3(filePath, fileName) {
  const command = new PutObjectCommand({
    Bucket: "buckethuzaifa273",
    Key: fileName,
    ContentType: "image/png",
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Read the file content
  const fileContent = await fs.readFile(filePath);

  // Upload the file to S3 using the signed URL
  await axios.put(url, fileContent, {
    headers: {
      "Content-Type": "image/png",
    },
  });

  console.log(`Successfully uploaded: ${fileName}`);
}

async function uploadScreenshotsToDatabase() {
  try {
    console.log("Uploading screenshots to the database.");
    const files = await fs.readdir(dataDir);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile()) {
        // Upload the file to S3
        await uploadScreenshotsToS3(filePath, file);
        // Read the file and send its name to the database
        const Store = (await import("electron-store")).default;
        const store = new Store();
        const userdata = store.get("userData");
        const response = await axios.post(
          "http://localhost:5000/api/put/upload",
          {
            user: userdata.user._id,
            screenshot: file,
            date: screenshotDetailInformation.date,
            time: screenshotDetailInformation.time,
          }
        );
        console.log(`Successfully logged: ${file} to the database`);
        await fs.remove(filePath); // Delete the file after successful upload
        console.log(`Deleted file: ${file}`);
      }
    }
  } catch (err) {
    console.error("Error processing files:", err);
  }
}
async function uploadActivityData() {
  const Store = (await import("electron-store")).default;
  const store = new Store();
  const userdata = store.get("userData");
  try {
    console.log("Uploading activity data to the database.");
    const activityDataPath = path.join(activityDataDir, "activityData.json");
    const storedActivityData = await fs.readJSON(activityDataPath);

    for (const entry of storedActivityData) {
      await axios.post("http://localhost:5000/api/put/activity", {
        user: userdata.user._id,
        startTime: entry.startTime,
        endTime: entry.endTime,
        startDate: entry.startDate,
        endDate: entry.endDate,
        activityRate: entry.activityRate,
      });
    }
    // Clear the local activity data file after successful upload
    await fs.writeFile(activityDataPath, "");
    console.log("Successfully uploaded activity data to the database.");
  } catch (err) {
    console.error("Error uploading activity data:", err);
  }
}
async function uploadTimerLogData() {
  const Store = (await import("electron-store")).default;
  const store = new Store();
  const userdata = store.get("userData");
  const timerLogPath = path.join(activityDataDir, "timerLog.json");
  try {
    console.log("Uploading timer log data to the database.");
    const timerLogData = fs.readJSONSync(timerLogPath);

    await axios.post("http://localhost:5000/api/put/timer-log", {
      user: userdata.user._id,
      logData: timerLogData,
    });

    fs.writeFileSync(timerLogPath, "[]");
    console.log("Successfully uploaded timer log data to the database.");
  } catch (err) {
    console.error("Error uploading timer log data:", err);
  }
}

setInterval(async () => {
  await uploadTimerLogData();
}, 1 * 60 * 1000); // 1 minutes
// setInterval(async () => {
//   await uploadScreenshotsToDatabase();
// }, 1 * 60 * 1000); // 1 minute

// setInterval(async () => {
//   await uploadActivityData();
// }, 1 * 60 * 1000); // 1 minute

app.whenReady().then(() => {
  createWindow();
  startTracking(); // Start tracking user activity
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (isUploading) {
    event.preventDefault();
    return;
  }

  isUploading = true;

  stopTimer(); // Stop the timer to save data locally
  await storeActivityDataWithInterval(); // Store activity data locally

  await uploadScreenshotsToDatabase();
  await uploadActivityData();

  isUploading = false;

  app.quit();
});
