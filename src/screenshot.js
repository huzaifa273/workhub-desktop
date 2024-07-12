const screenshot = require("screenshot-desktop");
const path = require("path");
const fs = require("fs");

async function captureScreenshot(userId) {
  try {
    const img = await screenshot();
    const now = new Date();
    const dateString = now.toISOString().split("T")[0];
    const timeString = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const filename = `${dateString}_${timeString}_${userId}.png`;
    const screenshotPath = path.join(__dirname, "data", filename);
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    fs.writeFileSync(screenshotPath, img);
    console.log("Screenshot saved to:", filename);
    return {
      name: filename,
      path: screenshotPath,
      date: dateString,
      time: timeString,
    };
  } catch (err) {
    console.error("Error capturing screenshot:", err);
    throw err;
  }
}

module.exports = {
  captureScreenshot,
};
