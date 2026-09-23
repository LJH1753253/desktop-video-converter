import { spawn } from 'node:child_process'
import type { Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { VideoMetadata, VideoSelectionErrorCode } from '../shared/video-metadata'
import { getFfprobePath } from './media-binaries'

interface TechnicalMetadata {
  duration: number | null
  width: number | null
  height: number | null
  frameRate: number | null
  videoCodec: string | null
  audioCodec: string | null
  rawFormatName: string | null
  bitRate: number | null
}

const SUPPORTED_CONTAINERS = {
  '.mp4': { displayName: 'MP4', formatNames: ['mp4', 'mov'] },
  '.mov': { displayName: 'MOV', formatNames: ['mov', 'mp4'] },
  '.mkv': { displayName: 'MKV', formatNames: ['matroska'] },
  '.webm': { displayName: 'WebM', formatNames: ['webm', 'matroska'] }
} as const

export class VideoMetadataError extends Error {
  constructor(
    readonly code: VideoSelectionErrorCode,
    readonly userTitle: string,
    userMessage: string,
    readonly technicalDetails: string
  ) {
    super(userMessage)
    this.name = 'VideoMetadataError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  return parsed !== null && parsed >= 0 ? parsed : null
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function normalizeContainerName(filePath: string, rawFormatName: string | null): string | null {
  const formatNames =
    rawFormatName
      ?.split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== '') ?? []
  const extension = extname(filePath).toLowerCase() as keyof typeof SUPPORTED_CONTAINERS
  const supportedContainer = SUPPORTED_CONTAINERS[extension]

  if (
    supportedContainer &&
    (formatNames.length === 0 ||
      supportedContainer.formatNames.some((formatName) => formatNames.includes(formatName)))
  ) {
    return supportedContainer.displayName
  }

  if (formatNames.includes('mp4') && formatNames.includes('mov')) {
    return 'MP4 / MOV'
  }

  if (formatNames.includes('matroska') && formatNames.includes('webm')) {
    return 'MKV / WebM'
  }

  if (formatNames.includes('mp4')) return 'MP4'
  if (formatNames.includes('mov')) return 'MOV'
  if (formatNames.includes('webm')) return 'WebM'
  if (formatNames.includes('matroska')) return 'MKV'

  const fallback = formatNames[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 16)
  return fallback ? fallback.toUpperCase() : null
}

export function parseFrameRate(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (normalized === '') {
    return null
  }

  const parts = normalized.split('/')
  if (parts.length === 1) {
    const frameRate = parseFiniteNumber(parts[0])
    return frameRate !== null && frameRate > 0 ? frameRate : null
  }

  if (parts.length !== 2) {
    return null
  }

  const numerator = parseFiniteNumber(parts[0])
  const denominator = parseFiniteNumber(parts[1])
  if (numerator === null || denominator === null || numerator <= 0 || denominator === 0) {
    return null
  }

  const frameRate = numerator / denominator
  return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : null
}

function parseTechnicalMetadata(output: string): TechnicalMetadata {
  let parsed: unknown

  try {
    parsed = JSON.parse(output) as unknown
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new VideoMetadataError(
      'FFPROBE_INVALID_JSON',
      '无法读取该视频',
      '无法解析该视频的媒体信息。',
      `ffprobe JSON parse failed: ${detail}`
    )
  }

  if (!isRecord(parsed)) {
    throw new VideoMetadataError(
      'FFPROBE_INVALID_JSON',
      '无法读取该视频',
      '无法解析该视频的媒体信息。',
      'ffprobe JSON root value was not an object.'
    )
  }

  const streams = Array.isArray(parsed['streams']) ? parsed['streams'].filter(isRecord) : []
  const videoStream = streams.find((stream) => stream['codec_type'] === 'video')
  const audioStream = streams.find((stream) => stream['codec_type'] === 'audio') ?? null

  if (!videoStream) {
    throw new VideoMetadataError(
      'VIDEO_STREAM_NOT_FOUND',
      '无法读取该视频',
      '所选文件中没有可识别的视频流。',
      'ffprobe output did not contain a stream with codec_type=video.'
    )
  }

  const format = isRecord(parsed['format']) ? parsed['format'] : null
  const averageFrameRate = parseFrameRate(videoStream['avg_frame_rate'])
  const realFrameRate = parseFrameRate(videoStream['r_frame_rate'])

  return {
    duration:
      parseNonNegativeNumber(format?.['duration']) ??
      parseNonNegativeNumber(videoStream['duration']),
    width: parsePositiveInteger(videoStream['width']),
    height: parsePositiveInteger(videoStream['height']),
    frameRate: averageFrameRate ?? realFrameRate,
    videoCodec: readString(videoStream, 'codec_name'),
    audioCodec: readString(audioStream, 'codec_name'),
    rawFormatName: readString(format, 'format_name'),
    bitRate:
      parseNonNegativeNumber(format?.['bit_rate']) ??
      parseNonNegativeNumber(videoStream['bit_rate'])
  }
}

function runFfprobe(filePath: string): Promise<string> {
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath]

  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const ffprobe = spawn(getFfprobePath(), args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    ffprobe.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk)
    })

    ffprobe.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
    })

    ffprobe.once('error', (error) => {
      reject(
        new VideoMetadataError(
          'FFPROBE_START_FAILED',
          '无法读取视频信息',
          '无法启动视频信息读取工具，请检查 ffprobe 是否可用。',
          `Failed to start ffprobe: ${error.message}`
        )
      )
    })

    ffprobe.once('close', (exitCode, signal) => {
      if (exitCode !== 0) {
        const errorOutput = Buffer.concat(stderr).toString('utf8').trim()
        const detail = errorOutput || `退出码 ${String(exitCode)}，信号 ${signal ?? '无'}`
        reject(
          new VideoMetadataError(
            'FFPROBE_EXIT_FAILED',
            '无法读取该视频',
            '所选文件不是有效的视频文件，或文件已损坏。',
            `ffprobe exited unsuccessfully: ${detail}`
          )
        )
        return
      }

      resolve(Buffer.concat(stdout).toString('utf8'))
    })
  })
}

export async function readVideoMetadata(filePath: string): Promise<VideoMetadata> {
  let fileStats: Stats

  try {
    fileStats = await stat(filePath)
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new VideoMetadataError(
      'FILE_ACCESS_FAILED',
      '无法访问该文件',
      '所选文件无法读取，请确认文件仍然存在且可访问。',
      `Failed to stat selected file: ${detail}`
    )
  }

  if (!fileStats.isFile()) {
    throw new VideoMetadataError(
      'FILE_ACCESS_FAILED',
      '无法访问该文件',
      '所选路径不是有效文件。',
      'Selected path did not resolve to a file.'
    )
  }

  const technicalMetadata = parseTechnicalMetadata(await runFfprobe(filePath))
  const { rawFormatName, ...metadataWithoutContainer } = technicalMetadata

  return {
    filePath,
    fileName: basename(filePath),
    fileSize: fileStats.size,
    ...metadataWithoutContainer,
    container: normalizeContainerName(filePath, rawFormatName)
  }
}
