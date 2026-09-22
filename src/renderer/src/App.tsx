import { useState } from 'react'
import type { VideoMetadata, VideoSelectionError } from '../../shared/video-metadata'

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function formatDuration(duration: number | null): string {
  if (duration === null) {
    return '未知'
  }

  const totalSeconds = Math.max(0, Math.round(duration))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join(':')
}

function formatResolution(metadata: VideoMetadata): string {
  return metadata.width !== null && metadata.height !== null
    ? `${metadata.width} × ${metadata.height}`
    : '未知'
}

function formatFrameRate(frameRate: number | null): string {
  return frameRate === null
    ? '未知'
    : `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(frameRate)} fps`
}

function App(): React.JSX.Element {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [errorInfo, setErrorInfo] = useState<VideoSelectionError | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const handleSelectVideo = async (): Promise<void> => {
    setIsSelecting(true)

    try {
      const result = await window.videoApi.selectVideo()

      if (result.status === 'success') {
        setMetadata(result.metadata)
        setErrorInfo(null)
      } else if (result.status === 'error') {
        setErrorInfo(result)
      }
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

  return (
    <main className="home">
      <h1>Desktop Video Converter</h1>
      <p className="subtitle">桌面视频格式转换器</p>

      <button type="button" onClick={handleSelectVideo} disabled={isSelecting}>
        {isSelecting ? '正在读取…' : '选择视频'}
      </button>

      {errorInfo && (
        <section className="error" role="alert">
          <strong>{errorInfo.title}</strong>
          <p>{errorInfo.message}</p>
          {metadata && <p>当前仍显示上一次成功加载的视频信息。</p>}
        </section>
      )}

      {metadata && (
        <dl className="metadata">
          <div>
            <dt>文件名</dt>
            <dd>{metadata.fileName}</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{formatFileSize(metadata.fileSize)}</dd>
          </div>
          <div>
            <dt>时长</dt>
            <dd>{formatDuration(metadata.duration)}</dd>
          </div>
          <div>
            <dt>分辨率</dt>
            <dd>{formatResolution(metadata)}</dd>
          </div>
          <div>
            <dt>帧率</dt>
            <dd>{formatFrameRate(metadata.frameRate)}</dd>
          </div>
          <div>
            <dt>视频编码</dt>
            <dd>{metadata.videoCodec ?? '未知'}</dd>
          </div>
          <div>
            <dt>音频编码</dt>
            <dd>{metadata.audioCodec ?? '无音频流'}</dd>
          </div>
          <div>
            <dt>容器格式</dt>
            <dd>{metadata.container ?? '未知'}</dd>
          </div>
        </dl>
      )}
    </main>
  )
}

export default App
