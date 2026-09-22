export const OUTPUT_FORMATS = ['mp4', 'mov', 'mkv', 'webm'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export type VideoConversionErrorCode =
  | 'INVALID_OUTPUT_FORMAT'
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

export const CONVERT_VIDEO_CHANNEL = 'video:convert' as const
