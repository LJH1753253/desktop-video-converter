import { dialog, ipcMain } from 'electron'
import { SELECT_VIDEO_CHANNEL, type VideoSelectionResult } from '../shared/video-metadata'
import { readVideoMetadata, VideoMetadataError } from './ffprobe'
import { generateVideoThumbnail, ThumbnailGenerationError } from './thumbnail'

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

function logThumbnailFailure(error: unknown): void {
  if (error instanceof ThumbnailGenerationError) {
    console.warn(`[THUMBNAIL_GENERATION_FAILED] ${error.technicalDetails}`)
    return
  }

  console.error('Unexpected error while generating video thumbnail:', error)
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
      const metadata = await readVideoMetadata(filePath)
      let thumbnailDataUrl: string | null = null

      try {
        thumbnailDataUrl = await generateVideoThumbnail(filePath, metadata.duration)
      } catch (error: unknown) {
        logThumbnailFailure(error)
      }

      return {
        status: 'success',
        metadata,
        thumbnailDataUrl
      }
    } catch (error: unknown) {
      return toErrorResult(error)
    }
  })
}
