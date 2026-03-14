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
let toolbarWin = null;
function createToolbarWindow() {
  if (toolbarWin) return;
  toolbarWin = new BrowserWindow({
    width: 320,
    height: 64,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  toolbarWin.setContentProtection(true);
  const toolbarUrl = VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}?mode=toolbar` : `file://${path.join(RENDERER_DIST, "index.html")}?mode=toolbar`;
  toolbarWin.loadURL(toolbarUrl);
  toolbarWin.on("closed", () => {
    toolbarWin = null;
  });
}
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
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
}
ipcMain.handle("get-desktop-sources", async (event, options) => {
  const sources = await desktopCapturer.getSources({ ...options, fetchWindowIcons: true });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    display_id: source.display_id,
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null
  }));
});
ipcMain.on("minimize-main-window", () => {
  win?.minimize();
  createToolbarWindow();
});
ipcMain.on("restore-main-window", () => {
  win?.restore();
  win?.focus();
  toolbarWin?.close();
});
ipcMain.on("to-renderer", (event, { channel, data }) => {
  win?.webContents.send(channel, data);
  toolbarWin?.webContents.send(channel, data);
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
  ipcMain.handle("get-primary-display", () => {
    const primary = screen.getPrimaryDisplay();
    return {
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height
    };
  });
  ipcMain.handle("get-cursor-state", () => {
    const point = screen.getCursorScreenPoint();
    return {
      x: point.x,
      y: point.y,
      isClicked,
      cursorType: isClicked ? "handpointing" : "default"
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
