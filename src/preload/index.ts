import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  CONVERT_VIDEO_CHANNEL,
  CANCEL_CONVERSION_CHANNEL,
  CONVERSION_PROGRESS_CHANNEL,
  type CancelConversionResult,
  isConversionProgress,
  type OutputFormat,
  type QualityPreset,
  type VideoConversionResult
} from '../shared/video-conversion'
import {
  SELECT_VIDEO_CHANNEL,
  LOAD_DROPPED_VIDEO_CHANNEL,
  ENTER_WORKING_MODE_CHANNEL,
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
  enterWorkingMode: () => ipcRenderer.invoke(ENTER_WORKING_MODE_CHANNEL) as Promise<void>,
  onConversionProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isConversionProgress(payload)) {
        callback(payload)
      }
    }

    ipcRenderer.on(CONVERSION_PROGRESS_CHANNEL, listener)

    return () => {
      ipcRenderer.removeListener(CONVERSION_PROGRESS_CHANNEL, listener)
    }
  },
  convertVideo: (targetFormat: OutputFormat, qualityPreset: QualityPreset) =>
    ipcRenderer.invoke(
      CONVERT_VIDEO_CHANNEL,
      targetFormat,
      qualityPreset
    ) as Promise<VideoConversionResult>,
  cancelConversion: () =>
    ipcRenderer.invoke(CANCEL_CONVERSION_CHANNEL) as Promise<CancelConversionResult>
})

contextBridge.exposeInMainWorld('videoApi', videoApi)
