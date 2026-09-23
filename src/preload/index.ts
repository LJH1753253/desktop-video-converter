import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  CONVERT_VIDEO_CHANNEL,
  type OutputFormat,
  type VideoConversionResult
} from '../shared/video-conversion'
import {
  SELECT_VIDEO_CHANNEL,
  LOAD_DROPPED_VIDEO_CHANNEL,
  type DroppedVideoFile,
  type VideoApi,
  type VideoSelectionResult
} from '../shared/video-metadata'

const videoApi: VideoApi = Object.freeze({
  selectVideo: () => ipcRenderer.invoke(SELECT_VIDEO_CHANNEL) as Promise<VideoSelectionResult>,
  loadDroppedVideo: (file: DroppedVideoFile) => {
    const electronFile = file as unknown as Parameters<typeof webUtils.getPathForFile>[0]
    const filePath = webUtils.getPathForFile(electronFile)
    return ipcRenderer.invoke(LOAD_DROPPED_VIDEO_CHANNEL, filePath) as Promise<VideoSelectionResult>
  },
  convertVideo: (targetFormat: OutputFormat) =>
    ipcRenderer.invoke(CONVERT_VIDEO_CHANNEL, targetFormat) as Promise<VideoConversionResult>
})

contextBridge.exposeInMainWorld('videoApi', videoApi)
