import type {
  ConversionProgressCallback,
  OutputFormat,
  QualityPreset,
  CancelConversionResult,
  VideoConversionResult
} from './video-conversion'

export interface VideoMetadata {
  filePath: string
  fileName: string
  fileSize: number
  duration: number | null
  width: number | null
  height: number | null
  frameRate: number | null
  videoCodec: string | null
  audioCodec: string | null
  container: string | null
  bitRate: number | null
}

export interface DroppedVideoFile {
  name: string
  size: number
  type: string
}

export type VideoSelectionErrorCode =
  | 'FILE_ACCESS_FAILED'
  | 'FFPROBE_START_FAILED'
  | 'FFPROBE_EXIT_FAILED'
  | 'FFPROBE_INVALID_JSON'
  | 'VIDEO_STREAM_NOT_FOUND'
  | 'DROPPED_FILE_INVALID'
  | 'DROPPED_FOLDER'
  | 'UNKNOWN'

export interface VideoSelectionError {
  code: VideoSelectionErrorCode
  title: string
  message: string
}

export type VideoSelectionResult =
  | { status: 'success'; metadata: VideoMetadata; thumbnailDataUrl: string | null }
  | { status: 'cancelled' }
  | ({ status: 'error' } & VideoSelectionError)

export interface VideoApi {
  selectVideo: () => Promise<VideoSelectionResult>
  loadDroppedVideo: (file: DroppedVideoFile) => Promise<VideoSelectionResult>
  enterWorkingMode: () => Promise<void>
  convertVideo: (
    targetFormat: OutputFormat,
    qualityPreset: QualityPreset
  ) => Promise<VideoConversionResult>
  cancelConversion: () => Promise<CancelConversionResult>
  onConversionProgress: (callback: ConversionProgressCallback) => () => void
}

export const SELECT_VIDEO_CHANNEL = 'video:select' as const
export const LOAD_DROPPED_VIDEO_CHANNEL = 'video:load-dropped' as const
export const ENTER_WORKING_MODE_CHANNEL = 'desktop-layout:enter-working-mode' as const
