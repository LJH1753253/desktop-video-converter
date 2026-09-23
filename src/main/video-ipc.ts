import { dialog, ipcMain } from 'electron'
import { extname } from 'node:path'
import {
  CONVERT_VIDEO_CHANNEL,
  type ConversionProgress,
  CONVERSION_PROGRESS_CHANNEL,
  isQualityPreset,
  isOutputFormat,
  type VideoConversionResult
} from '../shared/video-conversion'
import {
  LOAD_DROPPED_VIDEO_CHANNEL,
  SELECT_VIDEO_CHANNEL,
  type VideoSelectionResult
} from '../shared/video-metadata'
import {
  convertVideo,
  createDefaultOutputPath,
  getConversionFormatLabel,
  hasExpectedOutputExtension,
  VideoConversionProcessError
} from './converter'
import { readVideoMetadata, VideoMetadataError } from './ffprobe'
import { generateVideoThumbnail, ThumbnailGenerationError } from './thumbnail'

interface CurrentVideo {
  filePath: string
  duration: number | null
}

let currentVideo: CurrentVideo | null = null

const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm'])

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

function unsupportedDroppedFileResult(): VideoSelectionResult {
  return {
    status: 'error',
    code: 'DROPPED_FILE_INVALID',
    title: '不支持的文件格式',
    message: '请选择 MP4、MOV、MKV 或 WebM 视频文件。'
  }
}

function isSupportedVideoPath(filePath: string): boolean {
  return SUPPORTED_VIDEO_EXTENSIONS.has(extname(filePath).toLowerCase())
}

async function loadVideoFromPath(filePath: string): Promise<VideoSelectionResult> {
  try {
    const metadata = await readVideoMetadata(filePath)
    let thumbnailDataUrl: string | null = null

    try {
      thumbnailDataUrl = await generateVideoThumbnail(filePath, metadata.duration)
    } catch (error: unknown) {
      logThumbnailFailure(error)
    }

    currentVideo = {
      filePath,
      duration: metadata.duration
    }

    return {
      status: 'success',
      metadata,
      thumbnailDataUrl
    }
  } catch (error: unknown) {
    return toErrorResult(error)
  }
}

function toConversionErrorResult(error: unknown): VideoConversionResult {
  if (error instanceof VideoConversionProcessError) {
    console.error(`[${error.code}] ${error.technicalDetails}`)

    if (error.code === 'OUTPUT_MATCHES_INPUT') {
      return {
        status: 'error',
        code: error.code,
        title: '无法保存到原视频',
        message: '输出文件不能与当前输入视频相同，请选择其他文件名或位置。'
      }
    }

    if (error.code === 'FFMPEG_START_FAILED') {
      return {
        status: 'error',
        code: error.code,
        title: '无法开始转换',
        message: '无法启动视频转换程序，请确认本机已正确安装 FFmpeg 后重试。'
      }
    }

    return {
      status: 'error',
      code: error.code,
      title: '视频转换失败',
      message: '视频转换未能完成，请确认输入文件可用后重试。'
    }
  }

  console.error('Unexpected error while converting video:', error)
  return {
    status: 'error',
    code: 'UNKNOWN',
    title: '视频转换失败',
    message: '转换过程中发生未知错误，请重试。'
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

      return loadVideoFromPath(selection.filePaths[0])
    } catch (error: unknown) {
      return toErrorResult(error)
    }
  })

  ipcMain.handle(
    LOAD_DROPPED_VIDEO_CHANNEL,
    async (_event, filePath: unknown): Promise<VideoSelectionResult> => {
      if (
        typeof filePath !== 'string' ||
        filePath.length === 0 ||
        !isSupportedVideoPath(filePath)
      ) {
        return unsupportedDroppedFileResult()
      }

      return loadVideoFromPath(filePath)
    }
  )

  ipcMain.handle(
    CONVERT_VIDEO_CHANNEL,
    async (
      event,
      targetFormat: unknown,
      qualityPreset: unknown
    ): Promise<VideoConversionResult> => {
      if (!isOutputFormat(targetFormat)) {
        return {
          status: 'error',
          code: 'INVALID_OUTPUT_FORMAT',
          title: '无法开始转换',
          message: '请选择受支持的输出格式。'
        }
      }

      if (!isQualityPreset(qualityPreset)) {
        return {
          status: 'error',
          code: 'INVALID_QUALITY_PRESET',
          title: '无法开始转换',
          message: '请选择受支持的质量选项。'
        }
      }

      if (currentVideo === null) {
        return {
          status: 'error',
          code: 'NO_INPUT_VIDEO',
          title: '请先选择视频',
          message: '成功加载一个视频后才能开始转换。'
        }
      }

      const inputPath = currentVideo.filePath
      const duration = currentVideo.duration
      const formatLabel = getConversionFormatLabel(targetFormat)

      try {
        const saveResult = await dialog.showSaveDialog({
          title: '保存转换后的视频',
          buttonLabel: '保存并转换',
          defaultPath: createDefaultOutputPath(inputPath, targetFormat),
          filters: [
            {
              name: `${formatLabel} 视频`,
              extensions: [targetFormat]
            }
          ]
        })

        if (saveResult.canceled || !saveResult.filePath) {
          return { status: 'cancelled' }
        }

        if (!hasExpectedOutputExtension(saveResult.filePath, targetFormat)) {
          return {
            status: 'error',
            code: 'INVALID_OUTPUT_EXTENSION',
            title: '输出格式不匹配',
            message: `输出文件名必须使用 .${targetFormat} 扩展名，请重新选择保存位置。`
          }
        }

        const sendProgress = (progress: ConversionProgress): void => {
          if (event.sender.isDestroyed()) {
            return
          }

          try {
            event.sender.send(CONVERSION_PROGRESS_CHANNEL, progress)
          } catch (error: unknown) {
            console.warn('Unable to send conversion progress to the renderer:', error)
          }
        }

        await convertVideo(
          inputPath,
          saveResult.filePath,
          targetFormat,
          qualityPreset,
          duration,
          sendProgress
        )

        return {
          status: 'success',
          outputPath: saveResult.filePath
        }
      } catch (error: unknown) {
        return toConversionErrorResult(error)
      }
    }
  )
}
