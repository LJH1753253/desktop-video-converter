export const OUTPUT_FORMATS = ['mp4', 'mov', 'mkv', 'webm'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export const QUALITY_PRESETS = ['high', 'balanced', 'smaller'] as const

export type QualityPreset = (typeof QUALITY_PRESETS)[number]

export type VideoConversionErrorCode =
  | 'INVALID_OUTPUT_FORMAT'
  | 'INVALID_QUALITY_PRESET'
  | 'NO_INPUT_VIDEO'
  | 'INVALID_OUTPUT_EXTENSION'
  | 'OUTPUT_MATCHES_INPUT'
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
  | { status: 'cancelled' }
  | ({ status: 'error' } & VideoConversionError)

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && OUTPUT_FORMATS.some((format) => format === value)
}

export function isQualityPreset(value: unknown): value is QualityPreset {
  return typeof value === 'string' && QUALITY_PRESETS.some((preset) => preset === value)
}

export const CONVERT_VIDEO_CHANNEL = 'video:convert' as const
