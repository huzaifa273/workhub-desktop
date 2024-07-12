const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  getToken: () => ipcRenderer.send("get-token"),
  sendToken: (token) => ipcRenderer.send("store-token", token),
  logout: () => ipcRenderer.send("logout"),
  captureScreenshot: () => ipcRenderer.send("capture-screenshot"),
  onScreenshotCaptured: (callback) =>
    ipcRenderer.on("screenshot-captured", callback),
  onScreenshotError: (callback) => ipcRenderer.on("screenshot-error", callback),
  startTimer: () => ipcRenderer.send("start-timer"),
  stopTimer: () => ipcRenderer.send("stop-timer"),
  getElapsedTime: () => ipcRenderer.invoke("get-elapsed-time"),
  isTimerRunning: () => ipcRenderer.invoke("is-timer-running"),
  onTimerUpdate: (callback) => ipcRenderer.on("timer-update", callback),
});

console.log("preload.js is running");
