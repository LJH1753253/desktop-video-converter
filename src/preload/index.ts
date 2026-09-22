import { contextBridge, ipcRenderer } from 'electron'
import {
  CONVERT_VIDEO_CHANNEL,
  type OutputFormat,
  type VideoConversionResult
} from '../shared/video-conversion'
import {
  SELECT_VIDEO_CHANNEL,
  type VideoApi,
  type VideoSelectionResult
} from '../shared/video-metadata'

const videoApi: VideoApi = Object.freeze({
  selectVideo: () => ipcRenderer.invoke(SELECT_VIDEO_CHANNEL) as Promise<VideoSelectionResult>,
  convertVideo: (targetFormat: OutputFormat) =>
    ipcRenderer.invoke(CONVERT_VIDEO_CHANNEL, targetFormat) as Promise<VideoConversionResult>
})

contextBridge.exposeInMainWorld('videoApi', videoApi)
