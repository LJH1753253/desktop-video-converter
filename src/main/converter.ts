import { spawn } from 'node:child_process'
import { extname, join, parse, resolve } from 'node:path'
import type {
  OutputFormat,
  QualityPreset,
  VideoConversionErrorCode
} from '../shared/video-conversion'

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

export function getConversionFormatLabel(format: OutputFormat): string {
  return CONVERSION_PROFILES[format].label
}

export function createDefaultOutputPath(inputPath: string, format: OutputFormat): string {
  const input = parse(inputPath)
  return join(input.dir, `${input.name}-converted.${format}`)
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

export function convertVideo(
  inputPath: string,
  outputPath: string,
  format: OutputFormat,
  qualityPreset: QualityPreset
): Promise<void> {
  if (isSameFilePath(inputPath, outputPath)) {
    throw new VideoConversionProcessError(
      'OUTPUT_MATCHES_INPUT',
      `Output path matches input path: ${inputPath}`
    )
  }

  const profile = CONVERSION_PROFILES[format]
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
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
    const ffmpeg = spawn('ffmpeg', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
    })

    ffmpeg.once('error', (error) => {
      rejectConversion(
        new VideoConversionProcessError(
          'FFMPEG_START_FAILED',
          `Failed to start ffmpeg: ${error.message}`
        )
      )
    })

    ffmpeg.once('close', (exitCode, signal) => {
      if (exitCode !== 0) {
        const errorOutput = Buffer.concat(stderr).toString('utf8').trim()
        const detail = errorOutput || `Exit code ${String(exitCode)}, signal ${signal ?? 'none'}`
        rejectConversion(
          new VideoConversionProcessError(
            'FFMPEG_EXIT_FAILED',
            `ffmpeg exited unsuccessfully: ${detail}`
          )
        )
        return
      }

      resolveConversion()
    })
  })
}
