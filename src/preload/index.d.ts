import type { VideoApi } from '../shared/video-metadata'

declare global {
  interface Window {
    videoApi: VideoApi
  }
}

export {}
