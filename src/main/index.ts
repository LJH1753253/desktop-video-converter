import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { ENTER_WORKING_MODE_CHANNEL } from '../shared/video-metadata'
import { registerVideoIpcHandlers } from './video-ipc'

const INITIAL_WIDTH_RATIO = 0.72
const EMPTY_HEIGHT_RATIO = 0.76
const WORKING_HEIGHT_RATIO = 0.92
const MAX_INITIAL_WIDTH = 1000
const MAX_EMPTY_HEIGHT = 550
const MAX_WORKING_HEIGHT = 780
const MIN_WINDOW_WIDTH = 760
const MIN_WINDOW_HEIGHT = 520
const WORK_AREA_MARGIN = 24
const EMPTY_SIZE_TOLERANCE = 24

type WindowMode = 'empty' | 'working'

interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

interface TargetWindowSize {
  width: number
  height: number
  workArea: WorkArea
}

let hasEnteredWorkingMode = false
let emptyWindowSize: { width: number; height: number } | null = null

function getTargetWindowSize(
  mode: WindowMode,
  display = screen.getPrimaryDisplay()
): TargetWindowSize {
  const workAreaSize = display.workAreaSize
  const workArea: WorkArea = {
    x: display.workArea.x,
    y: display.workArea.y,
    width: workAreaSize.width,
    height: workAreaSize.height
  }
  const availableWidth = Math.max(1, workArea.width - WORK_AREA_MARGIN * 2)
  const availableHeight = Math.max(1, workArea.height - WORK_AREA_MARGIN * 2)
  const heightRatio = mode === 'empty' ? EMPTY_HEIGHT_RATIO : WORKING_HEIGHT_RATIO
  const maxHeight = mode === 'empty' ? MAX_EMPTY_HEIGHT : MAX_WORKING_HEIGHT
  const targetWidth = Math.min(MAX_INITIAL_WIDTH, Math.floor(workArea.width * INITIAL_WIDTH_RATIO))
  const targetHeight = Math.min(maxHeight, Math.floor(workArea.height * heightRatio))

  return {
    width: Math.min(targetWidth, availableWidth),
    height: Math.min(targetHeight, availableHeight),
    workArea
  }
}

function getInitialWindowBounds(): {
  width: number
  height: number
  minWidth: number
  minHeight: number
} {
  const { width, height } = getTargetWindowSize('empty')

  return {
    width,
    height,
    minWidth: Math.min(MIN_WINDOW_WIDTH, width),
    minHeight: Math.min(MIN_WINDOW_HEIGHT, height)
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function resizeToWorkingMode(mainWindow: BrowserWindow): void {
  const currentBounds = mainWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const { width, height, workArea } = getTargetWindowSize('working', display)
  const currentCenterX = currentBounds.x + currentBounds.width / 2
  const currentCenterY = currentBounds.y + currentBounds.height / 2
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height
  const nextX = clamp(Math.round(currentCenterX - width / 2), workArea.x, maxX)
  const nextY = clamp(Math.round(currentCenterY - height / 2), workArea.y, maxY)

  mainWindow.setBounds({ x: nextX, y: nextY, width, height }, true)
}

function registerWindowLayoutIpcHandler(): void {
  ipcMain.handle(ENTER_WORKING_MODE_CHANNEL, (event): void => {
    if (hasEnteredWorkingMode) {
      return
    }

    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    hasEnteredWorkingMode = true

    if (emptyWindowSize === null) {
      return
    }

    const currentBounds = mainWindow.getBounds()
    const isNearDefaultEmptySize =
      Math.abs(currentBounds.width - emptyWindowSize.width) <= EMPTY_SIZE_TOLERANCE &&
      Math.abs(currentBounds.height - emptyWindowSize.height) <= EMPTY_SIZE_TOLERANCE

    if (isNearDefaultEmptySize) {
      resizeToWorkingMode(mainWindow)
    }
  })
}

function createWindow(): void {
  // Create the browser window.
  const windowBounds = getInitialWindowBounds()
  emptyWindowSize = { width: windowBounds.width, height: windowBounds.height }
  hasEnteredWorkingMode = false
  const mainWindow = new BrowserWindow({
    ...windowBounds,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerVideoIpcHandlers()
  registerWindowLayoutIpcHandler()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
