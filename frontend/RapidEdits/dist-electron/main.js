import { app, ipcMain, desktopCapturer, BrowserWindow, screen, globalShortcut, shell } from "electron";
import { uIOhook } from "uiohook-napi";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || "", "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      // For security reasons, contextIsolation is enabled by default
      // and nodeIntegration is disabled by default.
      // If you want to use Node.js APIs in the renderer process,
      // you need to enable it or use a preload script.
      nodeIntegration: false,
      contextIsolation: true
    },
    width: 1280,
    height: 800,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0f172a",
      symbolColor: "#f8fafc",
      height: 32
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
}
ipcMain.handle("get-desktop-sources", async (event, options) => {
  return await desktopCapturer.getSources(options);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  uIOhook.start();
  let isClicked = false;
  uIOhook.on("mousedown", () => {
    isClicked = true;
  });
  uIOhook.on("mouseup", () => {
    isClicked = false;
  });
  ipcMain.handle("get-cursor-state", () => {
    return {
      ...screen.getCursorScreenPoint(),
      isClicked
    };
  });
  const shortcut = "CommandOrControl+Alt+R";
  const ret = globalShortcut.register(shortcut, () => {
    win?.webContents.send("toggle-recording");
  });
  if (!ret) {
    console.error("Registration of global shortcut failed:", shortcut);
  } else {
    console.log("Global shortcut registered:", shortcut);
  }
});
app.on("will-quit", () => {
  uIOhook.stop();
  globalShortcut.unregisterAll();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
