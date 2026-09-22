import { dialog, ipcMain } from 'electron'
import { SELECT_VIDEO_CHANNEL, type VideoSelectionResult } from '../shared/video-metadata'
import { readVideoMetadata, VideoMetadataError } from './ffprobe'

function toErrorResult(error: unknown): VideoSelectionResult {
  if (error instanceof VideoMetadataError) {
    console.error(`[${error.code}] ${error.technicalDetails}`)
    return {
      status: 'error',
      code: error.code,
      title: error.userTitle,
      message: error.message
    }
  }

  console.error('Unexpected error while loading video metadata:', error)
  return {
    status: 'error',
    code: 'UNKNOWN',
    title: '无法读取该视频',
    message: '读取视频信息时发生未知错误，请重试。'
  }
}

export function registerVideoIpcHandlers(): void {
  ipcMain.handle(SELECT_VIDEO_CHANNEL, async (): Promise<VideoSelectionResult> => {
    try {
      const selection = await dialog.showOpenDialog({
        title: '选择视频',
        properties: ['openFile'],
        filters: [
          {
            name: '视频文件',
            extensions: ['mp4', 'mov', 'mkv', 'webm']
          }
        ]
      })

      if (selection.canceled || selection.filePaths.length === 0) {
        return { status: 'cancelled' }
      }

      const filePath = selection.filePaths[0]
      return {
        status: 'success',
        metadata: await readVideoMetadata(filePath)
      }
    } catch (error: unknown) {
      return toErrorResult(error)
    }
  })
}
