import { useEffect, useRef, useState } from 'react'
import type {
  ConversionProgress,
  OutputFormat,
  QualityPreset,
  VideoConversionError
} from '../../shared/video-conversion'
import type {
  VideoMetadata,
  VideoSelectionError,
  VideoSelectionResult
} from '../../shared/video-metadata'
import AppHeader from './components/AppHeader'
import OutputSettingsPanel from './components/OutputSettingsPanel'
import StatusPanel, { SelectionErrorBanner } from './components/StatusPanel'
import VideoInputPanel from './components/VideoInputPanel'

function App(): React.JSX.Element {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null)
  const [errorInfo, setErrorInfo] = useState<VideoSelectionError | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp4')
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('balanced')
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [conversionCancelled, setConversionCancelled] = useState(false)
  const [conversionError, setConversionError] = useState<VideoConversionError | null>(null)
  const [convertedOutputPath, setConvertedOutputPath] = useState<string | null>(null)

  const acceptProgressRef = useRef(false)

  useEffect(
    () =>
      window.videoApi.onConversionProgress((progress) => {
        if (acceptProgressRef.current) {
          setConversionProgress(progress)
        }
      }),
    []
  )

  const applyVideoSelectionResult = (result: VideoSelectionResult): void => {
    if (result.status === 'success') {
      acceptProgressRef.current = false
      setMetadata(result.metadata)
      setThumbnailDataUrl(result.thumbnailDataUrl)
      setErrorInfo(null)
      setConversionProgress(null)
      setConversionError(null)
      setConversionCancelled(false)
      setConvertedOutputPath(null)
      void window.videoApi.enterWorkingMode().catch((error: unknown) => {
        console.error('Failed to enter working window mode:', error)
      })
    } else if (result.status === 'error') {
      acceptProgressRef.current = false
      setErrorInfo(result)
      setConversionProgress(null)
      setConversionError(null)
      setConversionCancelled(false)
      setConvertedOutputPath(null)
    }
  }

  const loadVideo = async (loader: () => Promise<VideoSelectionResult>): Promise<void> => {
    setIsSelecting(true)
    setErrorInfo(null)

    try {
      const result = await loader()
      applyVideoSelectionResult(result)
    } catch (error: unknown) {
      console.error('Failed to communicate with the main process:', error)
      acceptProgressRef.current = false
      setErrorInfo({
        code: 'UNKNOWN',
        title: '无法读取该视频',
        message: '无法与主进程通信，请重试。'
      })
    } finally {
      setIsSelecting(false)
    }
  }

  const handleSelectVideo = (): Promise<void> => loadVideo(() => window.videoApi.selectVideo())

  const handleDropVideo = (files: FileList): Promise<void> | void => {
    if (files.length !== 1) {
      setErrorInfo({
        code: 'DROPPED_FILE_INVALID',
        title: '一次只能添加一个视频',
        message: '请只拖入一个视频文件后重试。'
      })
      setConversionProgress(null)
      setConversionError(null)
      setConversionCancelled(false)
      setConvertedOutputPath(null)
      return
    }

    const file = files.item(0)
    return file ? loadVideo(() => window.videoApi.loadDroppedVideo(file)) : undefined
  }

  const handleConvertVideo = async (): Promise<void> => {
    acceptProgressRef.current = true
    setIsConverting(true)
    setIsCancelling(false)
    setConversionProgress(null)
    setConversionError(null)
    setConversionCancelled(false)
    setConvertedOutputPath(null)

    try {
      const result = await window.videoApi.convertVideo(outputFormat, qualityPreset)

      if (result.status === 'success') {
        acceptProgressRef.current = false
        setConversionProgress({ percent: 100, processedSeconds: null })
        setConvertedOutputPath(result.outputPath)
      } else if (result.status === 'cancelled') {
        acceptProgressRef.current = false
        setConversionProgress(null)
        if (result.reason === 'user') {
          setConversionCancelled(true)
        }
      } else if (result.status === 'error') {
        acceptProgressRef.current = false
        setConversionProgress(null)
        setConversionError(result)
      }
    } catch (error: unknown) {
      console.error('Failed to communicate with the main process:', error)
      acceptProgressRef.current = false
      setConversionError({
        code: 'UNKNOWN',
        title: '视频转换失败',
        message: '无法与主进程通信，请重试。'
      })
      setConversionProgress(null)
    } finally {
      setIsConverting(false)
      setIsCancelling(false)
    }
  }

  const handleCancelConversion = async (): Promise<void> => {
    if (!isConverting || isCancelling) {
      return
    }

    acceptProgressRef.current = false
    setIsCancelling(true)

    try {
      const result = await window.videoApi.cancelConversion()
      if (result.status === 'not-cancellable') {
        setIsCancelling(false)
      }
    } catch (error: unknown) {
      console.error('Failed to communicate with the main process:', error)
      setIsCancelling(false)
      setConversionError({
        code: 'UNKNOWN',
        title: '无法取消转换',
        message: '无法与主进程通信，请等待当前转换完成。'
      })
    }
  }

  const hasGlobalStatus = Boolean(
    errorInfo || conversionError || convertedOutputPath || conversionCancelled
  )
  const workspaceClassName = metadata ? 'workspace workspace--loaded' : 'workspace workspace--empty'

  return (
    <main className="app-shell">
      <AppHeader />

      <div className={`global-status-slot${hasGlobalStatus ? ' global-status-slot--active' : ''}`}>
        {errorInfo && <SelectionErrorBanner error={errorInfo} hasMetadata={metadata !== null} />}

        <StatusPanel
          conversionError={conversionError}
          convertedOutputPath={convertedOutputPath}
          conversionCancelled={conversionCancelled}
          isGlobal
        />
      </div>

      <section className={workspaceClassName} aria-label="视频转换工作区">
        <VideoInputPanel
          metadata={metadata}
          thumbnailDataUrl={thumbnailDataUrl}
          isLoading={isSelecting}
          isBusy={isConverting}
          onSelectVideo={handleSelectVideo}
          onDropVideo={handleDropVideo}
        />
        <OutputSettingsPanel
          metadata={metadata}
          outputFormat={outputFormat}
          qualityPreset={qualityPreset}
          conversionProgress={conversionProgress}
          isConverting={isConverting}
          isCancelling={isCancelling}
          isLoading={isSelecting}
          onOutputFormatChange={setOutputFormat}
          onQualityPresetChange={setQualityPreset}
          onConvert={handleConvertVideo}
          onCancel={handleCancelConversion}
        />
      </section>
    </main>
  )
}

export default App
