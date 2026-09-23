import { useState } from 'react'
import type { OutputFormat, VideoConversionError } from '../../shared/video-conversion'
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
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<VideoConversionError | null>(null)
  const [convertedOutputPath, setConvertedOutputPath] = useState<string | null>(null)

  const applyVideoSelectionResult = (result: VideoSelectionResult): void => {
    if (result.status === 'success') {
      setMetadata(result.metadata)
      setThumbnailDataUrl(result.thumbnailDataUrl)
      setErrorInfo(null)
      setConversionError(null)
      setConvertedOutputPath(null)
    } else if (result.status === 'error') {
      setErrorInfo(result)
      setConversionError(null)
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
      setConversionError(null)
      setConvertedOutputPath(null)
      return
    }

    const file = files.item(0)
    return file ? loadVideo(() => window.videoApi.loadDroppedVideo(file)) : undefined
  }

  const handleConvertVideo = async (): Promise<void> => {
    setIsConverting(true)
    setConversionError(null)
    setConvertedOutputPath(null)

    try {
      const result = await window.videoApi.convertVideo(outputFormat)

      if (result.status === 'success') {
        setConvertedOutputPath(result.outputPath)
      } else if (result.status === 'error') {
        setConversionError(result)
      }
    } catch (error: unknown) {
      console.error('Failed to communicate with the main process:', error)
      setConversionError({
        code: 'UNKNOWN',
        title: '视频转换失败',
        message: '无法与主进程通信，请重试。'
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <main className="app-shell">
      <AppHeader />

      {errorInfo && <SelectionErrorBanner error={errorInfo} hasMetadata={metadata !== null} />}

      <section className="workspace" aria-label="视频转换工作区">
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
          isConverting={isConverting}
          isLoading={isSelecting}
          onOutputFormatChange={setOutputFormat}
          onConvert={handleConvertVideo}
        />
      </section>

      <StatusPanel
        conversionError={conversionError}
        convertedOutputPath={convertedOutputPath}
        isConverting={isConverting}
      />
    </main>
  )
}

export default App
