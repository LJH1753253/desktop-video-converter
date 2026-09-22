import { contextBridge, ipcRenderer } from 'electron'
import {
  SELECT_VIDEO_CHANNEL,
  type VideoApi,
  type VideoSelectionResult
} from '../shared/video-metadata'

const videoApi: VideoApi = Object.freeze({
  selectVideo: () => ipcRenderer.invoke(SELECT_VIDEO_CHANNEL) as Promise<VideoSelectionResult>
})

contextBridge.exposeInMainWorld('videoApi', videoApi)
