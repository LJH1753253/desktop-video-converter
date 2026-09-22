import { contextBridge } from 'electron'

// Keep the preload boundary in place without exposing Node.js APIs.
contextBridge.exposeInMainWorld('desktopVideoConverter', Object.freeze({}))
