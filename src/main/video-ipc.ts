import { dialog, ipcMain } from 'electron'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import {
  CONVERT_VIDEO_CHANNEL,
  CANCEL_CONVERSION_CHANNEL,
  type CancelConversionResult,
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
  assertOutputPathDiffersFromInput,
  getConversionFormatLabel,
  hasExpectedOutputExtension,
  VideoConversionProcessError
} from './converter'
import { readVideoMetadata, VideoMetadataError } from './ffprobe'
import {
  cleanupStagedFile,
  commitCreate,
  commitReplace,
  createBackupPath,
  createTempOutputPath,
  createTimestampedDefaultPath,
  getFileIdentity,
  OutputStagingError,
  type CommitMode,
  validateOutputDirectory
} from './output-staging'
import { generateVideoThumbnail, ThumbnailGenerationError } from './thumbnail'

interface CurrentVideo {
  filePath: string
  duration: number | null
}

class InputFileUnavailableError extends Error {
  constructor(readonly technicalDetails: string) {
    super('The input video is unavailable.')
    this.name = 'InputFileUnavailableError'
  }
}

type ActiveConversionPhase = 'preparing' | 'running' | 'cancelling' | 'committing' | 'completed'
type InternalCancelReason = 'user' | 'renderer-destroyed'

interface ActiveConversion {
  controller: AbortController
  senderId: number
  phase: ActiveConversionPhase
  cancelReason: InternalCancelReason | null
  finalOutputPath: string | null
  tempOutputPath: string | null
  backupPath: string | null
  commitMode: CommitMode | null
}

let currentVideo: CurrentVideo | null = null
let activeConversion: ActiveConversion | null = null

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

async function assertInputFileAvailable(filePath: string): Promise<void> {
  try {
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
      throw new Error('The input path is not a regular file.')
    }
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new InputFileUnavailableError(`Input file validation failed for ${filePath}: ${detail}`)
  }
}

async function validateDroppedVideoPath(filePath: string): Promise<VideoSelectionResult | null> {
  try {
    const fileStats = await stat(filePath)

    if (fileStats.isDirectory()) {
      return {
        status: 'error',
        code: 'DROPPED_FOLDER',
        title: '无法添加文件夹',
        message: '请拖入一个 MP4、MOV、MKV 或 WebM 视频文件。'
      }
    }

    if (!fileStats.isFile()) {
      return {
        status: 'error',
        code: 'FILE_ACCESS_FAILED',
        title: '无法访问该文件',
        message: '拖入的路径不是有效文件，请重新选择视频。'
      }
    }
  } catch (error: unknown) {
    console.error('Unable to inspect dropped path:', error)
    return {
      status: 'error',
      code: 'FILE_ACCESS_FAILED',
      title: '无法访问该文件',
      message: '拖入的文件无法读取，请确认文件仍然存在且可访问。'
    }
  }

  return null
}

async function cleanupConversionArtifacts(task: ActiveConversion): Promise<void> {
  await cleanupStagedFile(task.tempOutputPath)
  await cleanupStagedFile(task.backupPath)
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
  if (error instanceof InputFileUnavailableError) {
    console.error(`[INPUT_FILE_UNAVAILABLE] ${error.technicalDetails}`)
    return {
      status: 'error',
      code: 'INPUT_FILE_UNAVAILABLE',
      title: '无法访问原视频',
      message: '原视频可能已被移动或删除，请重新选择视频后再试。'
    }
  }

  if (error instanceof OutputStagingError) {
    console.error(`[${error.code}] ${error.technicalDetails}`)

    if (error.code === 'OUTPUT_PATH_UNAVAILABLE') {
      return {
        status: 'error',
        code: error.code,
        title: '无法保存转换结果',
        message: '请选择其他保存位置，或确认当前文件夹可写后重试。'
      }
    }

    if (error.code === 'OUTPUT_CONFLICT') {
      return {
        status: 'error',
        code: error.code,
        title: '输出文件发生变化',
        message: '目标文件在保存过程中发生变化，请重新选择保存位置后重试。'
      }
    }

    if (error.code === 'OUTPUT_REPLACE_FAILED') {
      return {
        status: 'error',
        code: error.code,
        title: '无法替换现有文件',
        message: '请关闭正在使用该文件的其他程序后重试。'
      }
    }

    return {
      status: 'error',
      code: error.code,
      title: '无法保存转换结果',
      message: '视频已经转换完成，但最终文件保存失败，请重试。'
    }
  }

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
      if (typeof filePath !== 'string' || filePath.length === 0 || filePath.trim().length === 0) {
        return unsupportedDroppedFileResult()
      }

      const droppedPathError = await validateDroppedVideoPath(filePath)
      if (droppedPathError !== null) {
        return droppedPathError
      }

      if (!isSupportedVideoPath(filePath)) {
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

      if (activeConversion !== null) {
        return {
          status: 'error',
          code: 'CONVERSION_ALREADY_RUNNING',
          title: '已有转换正在进行',
          message: '请等待当前视频转换完成后再开始新的转换。'
        }
      }

      const inputPath = currentVideo.filePath
      const duration = currentVideo.duration
      const formatLabel = getConversionFormatLabel(targetFormat)
      const task: ActiveConversion = {
        controller: new AbortController(),
        senderId: event.sender.id,
        phase: 'preparing',
        cancelReason: null,
        finalOutputPath: null,
        tempOutputPath: null,
        backupPath: null,
        commitMode: null
      }

      activeConversion = task

      const onSenderDestroyed = (): void => {
        if (
          activeConversion !== task ||
          task.phase === 'completed' ||
          task.phase === 'committing'
        ) {
          return
        }

        task.cancelReason = 'renderer-destroyed'
        task.phase = 'cancelling'
        task.controller.abort()
      }

      event.sender.once('destroyed', onSenderDestroyed)

      try {
        await assertInputFileAvailable(inputPath)
        const defaultPath = await createTimestampedDefaultPath(inputPath, targetFormat)

        if (task.controller.signal.aborted) {
          task.phase = 'completed'
          return { status: 'cancelled', reason: 'user' }
        }

        const saveResult = await dialog.showSaveDialog({
          title: '保存转换后的视频',
          buttonLabel: '保存并转换',
          defaultPath,
          filters: [
            {
              name: `${formatLabel} 视频`,
              extensions: [targetFormat]
            }
          ]
        })

        if (saveResult.canceled || !saveResult.filePath) {
          task.phase = 'completed'
          return { status: 'cancelled', reason: 'save-dialog' }
        }

        if (!hasExpectedOutputExtension(saveResult.filePath, targetFormat)) {
          return {
            status: 'error',
            code: 'INVALID_OUTPUT_EXTENSION',
            title: '输出格式不匹配',
            message: `输出文件名必须使用 .${targetFormat} 扩展名，请重新选择保存位置。`
          }
        }

        await assertInputFileAvailable(inputPath)
        assertOutputPathDiffersFromInput(inputPath, saveResult.filePath)
        await validateOutputDirectory(saveResult.filePath)

        const originalIdentity = await getFileIdentity(saveResult.filePath)
        const commitMode: CommitMode = originalIdentity === null ? 'create' : 'replace'
        task.finalOutputPath = saveResult.filePath
        task.commitMode = commitMode
        task.tempOutputPath = await createTempOutputPath(saveResult.filePath, targetFormat)
        const tempOutputPath = task.tempOutputPath

        if (task.controller.signal.aborted) {
          task.phase = 'completed'
          await cleanupConversionArtifacts(task)
          return { status: 'cancelled', reason: 'user' }
        }

        task.phase = 'running'

        const sendProgress = (progress: ConversionProgress): void => {
          if (task.phase !== 'running' || event.sender.isDestroyed()) {
            return
          }

          try {
            event.sender.send(CONVERSION_PROGRESS_CHANNEL, progress)
          } catch (error: unknown) {
            console.warn('Unable to send conversion progress to the renderer:', error)
          }
        }

        const completion = await convertVideo(
          inputPath,
          tempOutputPath,
          targetFormat,
          qualityPreset,
          duration,
          sendProgress,
          task.controller.signal
        )

        if (completion.status === 'cancelled') {
          task.phase = 'completed'
          await cleanupConversionArtifacts(task)
          return {
            status: 'cancelled',
            reason: 'user'
          }
        }

        task.phase = 'committing'

        if (commitMode === 'create') {
          await commitCreate(tempOutputPath, saveResult.filePath)
        } else {
          if (originalIdentity === null) {
            throw new OutputStagingError(
              'OUTPUT_CONFLICT',
              `Final output disappeared before replacement: ${saveResult.filePath}`
            )
          }

          task.backupPath = await createBackupPath(saveResult.filePath, targetFormat)
          const backupPath = task.backupPath
          await commitReplace(tempOutputPath, saveResult.filePath, originalIdentity, backupPath)
        }

        task.phase = 'completed'

        return {
          status: 'success',
          outputPath: saveResult.filePath
        }
      } catch (error: unknown) {
        task.phase = 'completed'
        await cleanupConversionArtifacts(task)

        let classifiedError = error
        if (
          error instanceof VideoConversionProcessError &&
          error.code === 'FFMPEG_EXIT_FAILED' &&
          task.finalOutputPath !== null
        ) {
          try {
            await validateOutputDirectory(task.finalOutputPath)
          } catch (directoryError: unknown) {
            classifiedError = directoryError
          }
        }

        return toConversionErrorResult(classifiedError)
      } finally {
        event.sender.removeListener('destroyed', onSenderDestroyed)
        if (activeConversion === task) {
          activeConversion = null
        }
      }
    }
  )

  ipcMain.handle(CANCEL_CONVERSION_CHANNEL, (event): CancelConversionResult => {
    const task = activeConversion

    if (task === null || task.phase === 'completed') {
      return { status: 'no-active' }
    }

    if (task.senderId !== event.sender.id) {
      return { status: 'not-owner' }
    }

    if (task.phase === 'committing') {
      return { status: 'not-cancellable' }
    }

    if (task.phase === 'cancelling' || task.controller.signal.aborted) {
      return { status: 'already-cancelling' }
    }

    task.cancelReason = 'user'
    task.phase = 'cancelling'
    task.controller.abort()
    return { status: 'accepted' }
  })
}
