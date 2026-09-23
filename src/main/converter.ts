import { spawn } from 'node:child_process'
import { extname, resolve } from 'node:path'
import type {
  ConversionProgressCallback,
  OutputFormat,
  QualityPreset,
  VideoConversionErrorCode
} from '../shared/video-conversion'
import { getFfmpegPath } from './media-binaries'

interface ConversionProfile {
  label: string
  codecArgs: (qualityPreset: QualityPreset) => readonly string[]
}

const H264_QUALITY_ARGS: Record<QualityPreset, readonly string[]> = {
  high: ['-crf', '18', '-b:a', '192k'],
  balanced: ['-crf', '23', '-b:a', '128k'],
  smaller: ['-crf', '28', '-b:a', '96k']
}

const VP9_QUALITY_ARGS: Record<QualityPreset, readonly string[]> = {
  high: ['-crf', '24', '-b:v', '0', '-b:a', '160k'],
  balanced: ['-crf', '31', '-b:v', '0', '-b:a', '128k'],
  smaller: ['-crf', '37', '-b:v', '0', '-b:a', '96k']
}

const CONVERSION_PROFILES: Record<OutputFormat, ConversionProfile> = {
  mp4: {
    label: 'MP4',
    codecArgs: (qualityPreset) => [
      '-c:v',
      'libx264',
      ...H264_QUALITY_ARGS[qualityPreset],
      '-c:a',
      'aac',
      '-pix_fmt',
      'yuv420p'
    ]
  },
  mov: {
    label: 'MOV',
    codecArgs: (qualityPreset) => [
      '-c:v',
      'libx264',
      ...H264_QUALITY_ARGS[qualityPreset],
      '-c:a',
      'aac',
      '-pix_fmt',
      'yuv420p'
    ]
  },
  mkv: {
    label: 'MKV',
    codecArgs: (qualityPreset) => [
      '-c:v',
      'libx264',
      ...H264_QUALITY_ARGS[qualityPreset],
      '-c:a',
      'aac',
      '-pix_fmt',
      'yuv420p'
    ]
  },
  webm: {
    label: 'WebM',
    codecArgs: (qualityPreset) => [
      '-c:v',
      'libvpx-vp9',
      ...VP9_QUALITY_ARGS[qualityPreset],
      '-c:a',
      'libopus'
    ]
  }
}

export class VideoConversionProcessError extends Error {
  constructor(
    readonly code: Extract<
      VideoConversionErrorCode,
      'OUTPUT_MATCHES_INPUT' | 'FFMPEG_START_FAILED' | 'FFMPEG_EXIT_FAILED'
    >,
    readonly technicalDetails: string
  ) {
    super('Video conversion failed.')
    this.name = 'VideoConversionProcessError'
  }
}

export type ConversionCompletion = { status: 'success' } | { status: 'cancelled' }

export function getConversionFormatLabel(format: OutputFormat): string {
  return CONVERSION_PROFILES[format].label
}

export function hasExpectedOutputExtension(outputPath: string, format: OutputFormat): boolean {
  return extname(outputPath).toLocaleLowerCase('en-US') === `.${format}`
}

function normalizePathForComparison(filePath: string): string {
  const normalized = resolve(filePath)
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized
}

function isSameFilePath(inputPath: string, outputPath: string): boolean {
  return normalizePathForComparison(inputPath) === normalizePathForComparison(outputPath)
}

export function assertOutputPathDiffersFromInput(inputPath: string, outputPath: string): void {
  if (isSameFilePath(inputPath, outputPath)) {
    throw new VideoConversionProcessError(
      'OUTPUT_MATCHES_INPUT',
      `Output path matches input path: ${inputPath}`
    )
  }
}

function hasValidDuration(duration: number | null): duration is number {
  return duration !== null && Number.isFinite(duration) && duration > 0
}

function createProgressParser(
  duration: number | null,
  onProgress: ConversionProgressCallback
): { push: (chunk: Buffer) => void; flush: () => void } {
  let buffer = ''
  let lastPercent: number | null = null
  let hasSentPercent = false

  const parseLine = (rawLine: string): void => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const separatorIndex = line.indexOf('=')

    if (separatorIndex <= 0 || line.slice(0, separatorIndex) !== 'out_time_us') {
      return
    }

    const microseconds = Number(line.slice(separatorIndex + 1))
    if (!Number.isFinite(microseconds) || microseconds < 0) {
      return
    }

    const processedSeconds = microseconds / 1_000_000
    if (!Number.isFinite(processedSeconds)) {
      return
    }

    if (!hasValidDuration(duration)) {
      onProgress({ percent: null, processedSeconds })
      return
    }

    const percent = Math.min(99, Math.max(0, Math.round((processedSeconds / duration) * 100)))

    if (hasSentPercent && percent === lastPercent) {
      return
    }

    lastPercent = percent
    hasSentPercent = true
    onProgress({ percent, processedSeconds })
  }

  const consumeLines = (): void => {
    let newlineIndex = buffer.indexOf('\n')

    while (newlineIndex >= 0) {
      parseLine(buffer.slice(0, newlineIndex))
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf('\n')
    }
  }

  return {
    push: (chunk: Buffer): void => {
      buffer += chunk.toString('utf8')
      consumeLines()
    },
    flush: (): void => {
      if (buffer.length > 0) {
        parseLine(buffer)
        buffer = ''
      }
    }
  }
}

export function convertVideo(
  inputPath: string,
  outputPath: string,
  format: OutputFormat,
  qualityPreset: QualityPreset,
  duration: number | null,
  onProgress: ConversionProgressCallback,
  signal: AbortSignal
): Promise<ConversionCompletion> {
  const profile = CONVERSION_PROFILES[format]
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-n',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    ...profile.codecArgs(qualityPreset),
    outputPath
  ]

  return new Promise((resolveConversion, rejectConversion) => {
    const stderr: Buffer[] = []
    const progressParser = createProgressParser(duration, onProgress)
    let abortRequested = signal.aborted
    let settled = false
    let processClosed = false
    let startError: Error | null = null
    let abortListener: (() => void) | null = null

    const cleanupAbortListener = (): void => {
      if (abortListener !== null) {
        signal.removeEventListener('abort', abortListener)
        abortListener = null
      }
    }

    const resolveOnce = (completion: ConversionCompletion): void => {
      if (settled) {
        return
      }

      settled = true
      cleanupAbortListener()
      resolveConversion(completion)
    }

    const rejectOnce = (error: VideoConversionProcessError): void => {
      if (settled) {
        return
      }

      settled = true
      cleanupAbortListener()
      rejectConversion(error)
    }

    if (signal.aborted) {
      resolveOnce({ status: 'cancelled' })
      return
    }

    const ffmpeg = spawn(getFfmpegPath(), args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    abortListener = (): void => {
      if (settled || processClosed) {
        return
      }

      abortRequested = true

      if (ffmpeg.exitCode !== null || ffmpeg.signalCode !== null || ffmpeg.killed) {
        return
      }

      try {
        ffmpeg.kill()
      } catch (error: unknown) {
        console.warn('Unable to terminate ffmpeg after cancellation request:', error)
      }
    }

    signal.addEventListener('abort', abortListener, { once: true })

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      progressParser.push(chunk)
    })

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
    })

    ffmpeg.once('error', (error) => {
      startError = error

      if (abortRequested) {
        return
      }

      rejectOnce(
        new VideoConversionProcessError(
          'FFMPEG_START_FAILED',
          `Failed to start ffmpeg: ${error.message}`
        )
      )
    })

    ffmpeg.once('close', (exitCode, signal) => {
      processClosed = true

      if (settled) {
        return
      }

      progressParser.flush()

      if (abortRequested) {
        resolveOnce({ status: 'cancelled' })
        return
      }

      if (startError !== null) {
        rejectOnce(
          new VideoConversionProcessError(
            'FFMPEG_START_FAILED',
            `Failed to start ffmpeg: ${startError.message}`
          )
        )
        return
      }

      if (exitCode !== 0) {
        const errorOutput = Buffer.concat(stderr).toString('utf8').trim()
        const detail = errorOutput || `Exit code ${String(exitCode)}, signal ${signal ?? 'none'}`
        rejectOnce(
          new VideoConversionProcessError(
            'FFMPEG_EXIT_FAILED',
            `ffmpeg exited unsuccessfully: ${detail}`
          )
        )
        return
      }

      resolveOnce({ status: 'success' })
    })
  })
}
