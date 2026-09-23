import type { VideoMetadata } from '../../../shared/video-metadata'

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

interface MetadataSummaryProps {
  metadata: VideoMetadata
}

function MetadataSummary({ metadata }: MetadataSummaryProps): React.JSX.Element {
  return (
    <div className="metadata-summary">
      <div className="metadata-highlights" aria-label="视频核心信息">
        <div className="metric-card">
          <span>分辨率</span>
          <strong>{formatResolution(metadata)}</strong>
        </div>
        <div className="metric-card">
          <span>时长</span>
          <strong>{formatDuration(metadata.duration)}</strong>
        </div>
        <div className="metric-card">
          <span>文件大小</span>
          <strong>{formatFileSize(metadata.fileSize)}</strong>
        </div>
      </div>

      <dl className="metadata-details">
        <div>
          <dt>视频编码</dt>
          <dd>{metadata.videoCodec ?? '未知'}</dd>
        </div>
        <div>
          <dt>音频编码</dt>
          <dd>{metadata.audioCodec ?? '无音频流'}</dd>
        </div>
        <div>
          <dt>帧率</dt>
          <dd>{formatFrameRate(metadata.frameRate)}</dd>
        </div>
        <div>
          <dt>容器格式</dt>
          <dd>{metadata.container ?? '未知'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default MetadataSummary
