import { app } from 'electron'
import { join } from 'node:path'

export function getFfmpegPath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg'
}

export function getFfprobePath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'ffmpeg', 'ffprobe.exe') : 'ffprobe'
}
