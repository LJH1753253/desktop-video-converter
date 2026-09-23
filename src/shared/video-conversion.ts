export const OUTPUT_FORMATS = ['mp4', 'mov', 'mkv', 'webm'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export const QUALITY_PRESETS = ['high', 'balanced', 'smaller'] as const

export type QualityPreset = (typeof QUALITY_PRESETS)[number]

export interface ConversionProgress {
  percent: number | null
  processedSeconds: number | null
}

export type ConversionProgressCallback = (progress: ConversionProgress) => void

export type VideoConversionErrorCode =
  | 'INVALID_OUTPUT_FORMAT'
  | 'INVALID_QUALITY_PRESET'
  | 'NO_INPUT_VIDEO'
  | 'INPUT_FILE_UNAVAILABLE'
  | 'INVALID_OUTPUT_EXTENSION'
  | 'OUTPUT_MATCHES_INPUT'
  | 'OUTPUT_PATH_UNAVAILABLE'
  | 'OUTPUT_CONFLICT'
  | 'OUTPUT_COMMIT_FAILED'
  | 'OUTPUT_REPLACE_FAILED'
  | 'CONVERSION_ALREADY_RUNNING'
  | 'FFMPEG_START_FAILED'
  | 'FFMPEG_EXIT_FAILED'
  | 'UNKNOWN'

export interface VideoConversionError {
  code: VideoConversionErrorCode
  title: string
  message: string
}

export type VideoConversionResult =
  | { status: 'success'; outputPath: string }
  | { status: 'cancelled'; reason: 'save-dialog' | 'user' }
  | ({ status: 'error' } & VideoConversionError)

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && OUTPUT_FORMATS.some((format) => format === value)
}

export function isQualityPreset(value: unknown): value is QualityPreset {
  return typeof value === 'string' && QUALITY_PRESETS.some((preset) => preset === value)
}

export function isConversionProgress(value: unknown): value is ConversionProgress {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const progress = value as Record<string, unknown>
  const hasValidPercent =
    progress.percent === null ||
    (typeof progress.percent === 'number' &&
      Number.isFinite(progress.percent) &&
      progress.percent >= 0 &&
      progress.percent <= 99)
  const hasValidProcessedSeconds =
    progress.processedSeconds === null ||
    (typeof progress.processedSeconds === 'number' &&
      Number.isFinite(progress.processedSeconds) &&
      progress.processedSeconds >= 0)

  return hasValidPercent && hasValidProcessedSeconds
}

export const CONVERT_VIDEO_CHANNEL = 'video:convert' as const
export const CONVERSION_PROGRESS_CHANNEL = 'video:conversion-progress' as const
export const CANCEL_CONVERSION_CHANNEL = 'video:cancel-conversion' as const

export type CancelConversionResult =
  | { status: 'accepted' }
  | { status: 'already-cancelling' }
  | { status: 'not-cancellable' }
  | { status: 'no-active' }
  | { status: 'not-owner' }
