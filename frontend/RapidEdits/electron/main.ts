import { app, BrowserWindow, shell, ipcMain, desktopCapturer, globalShortcut, screen } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { platform, release } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Enable usage of Portal's globalShortcuts for Wayland etc.
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 - till next release, we need to manually define the paths
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null
let toolbarWin: BrowserWindow | null = null

function createToolbarWindow() {
  if (toolbarWin) return
  
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
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // This makes the window invisible to screen capture
  toolbarWin.setContentProtection(true)

  const toolbarUrl = VITE_DEV_SERVER_URL 
    ? `${VITE_DEV_SERVER_URL}?mode=toolbar` 
    : `file://${path.join(RENDERER_DIST, 'index.html')}?mode=toolbar`

  toolbarWin.loadURL(toolbarUrl)

  toolbarWin.on('closed', () => {
    toolbarWin = null
  })
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // For security reasons, contextIsolation is enabled by default
      // and nodeIntegration is disabled by default.
      // If you want to use Node.js APIs in the renderer process,
      // you need to enable it or use a preload script.
      nodeIntegration: false,
      contextIsolation: true,
    },
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
      height: 32
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.handle('get-desktop-sources', async (event, options) => {
  const sources = await desktopCapturer.getSources({ ...options, fetchWindowIcons: true })
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    display_id: source.display_id,
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null
  }))
})

ipcMain.on('minimize-main-window', () => {
  win?.minimize()
  createToolbarWindow()
})

ipcMain.on('restore-main-window', () => {
  win?.restore()
  win?.focus()
  toolbarWin?.close()
})

// Bridge IPC between windows
ipcMain.on('to-renderer', (event, { channel, data }) => {
  win?.webContents.send(channel, data)
  toolbarWin?.webContents.send(channel, data)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  // Start global input tracking
  uIOhook.start()
  
  let isClicked = false
  uIOhook.on('mousedown', () => {
    isClicked = true
  })
  uIOhook.on('mouseup', () => {
    isClicked = false
  })

  ipcMain.handle('get-primary-display', () => {
    const primary = screen.getPrimaryDisplay()
    return {
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height
    }
  })

  ipcMain.handle('get-cursor-state', () => {
    const point = screen.getCursorScreenPoint()
    return {
      x: point.x,
      y: point.y,
      isClicked,
      cursorType: isClicked ? 'handpointing' : 'default'
    }
  })

  // Register a global shortcut to start/stop recording
  const shortcut = 'CommandOrControl+Alt+R'
  const ret = globalShortcut.register(shortcut, () => {
    win?.webContents.send('toggle-recording')
  })

  if (!ret) {
    console.error('Registration of global shortcut failed:', shortcut)
  } else {
    console.log('Global shortcut registered:', shortcut)
  }
})

app.on('will-quit', () => {
  uIOhook.stop()
  globalShortcut.unregisterAll()
})
