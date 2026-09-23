import { useRef, useState } from 'react'
import type { VideoMetadata } from '../../../shared/video-metadata'
import MetadataSummary from './MetadataSummary'

interface VideoInputPanelProps {
  metadata: VideoMetadata | null
  thumbnailDataUrl: string | null
  isLoading: boolean
  isBusy: boolean
  onSelectVideo: () => void
  onDropVideo: (files: FileList) => void
}

function VideoInputPanel({
  metadata,
  thumbnailDataUrl,
  isLoading,
  isBusy,
  onSelectVideo,
  onDropVideo
}: VideoInputPanelProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)

  const handleDragEnter = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()
    if (isBusy) {
      return
    }

    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()
    if (isBusy) {
      return
    }

    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()
    if (!isBusy) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)

    if (isBusy || isLoading) {
      return
    }

    if (event.dataTransfer.files.length > 0) {
      onDropVideo(event.dataTransfer.files)
    }
  }

  const panelClassName = `input-panel${isDragging ? ' is-dragging' : ''}`

  return (
    <section
      className={panelClassName}
      aria-label="输入视频"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay" aria-live="polite">
          松开鼠标以载入视频
        </div>
      )}

      {!metadata ? (
        <button className="drop-zone" type="button" onClick={onSelectVideo} disabled={isLoading}>
          <span className="drop-zone-icon" aria-hidden="true">
            ↓
          </span>
          <strong>{isLoading ? '正在读取视频…' : '拖入一个视频开始转换'}</strong>
          <span>{isLoading ? '请稍候' : '或点击这里选择本地文件'}</span>
          <small>支持 MP4、MOV、MKV、WebM</small>
        </button>
      ) : (
        <div className="loaded-video">
          <div className="section-heading">
            <div>
              <p className="section-kicker">INPUT VIDEO</p>
              <h2>当前视频</h2>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={onSelectVideo}
              disabled={isBusy || isLoading}
            >
              {isLoading ? '正在读取…' : '重新选择'}
            </button>
          </div>

          <div className="video-preview-frame">
            {thumbnailDataUrl ? (
              <img src={thumbnailDataUrl} alt={`${metadata.fileName} 的视频预览`} />
            ) : (
              <div className="preview-placeholder">无法生成视频预览</div>
            )}
          </div>

          <div className="file-heading">
            <span className="file-type-badge">VIDEO</span>
            <h3 title={metadata.fileName}>{metadata.fileName}</h3>
          </div>

          <MetadataSummary metadata={metadata} />
        </div>
      )}
    </section>
  )
}

export default VideoInputPanel
