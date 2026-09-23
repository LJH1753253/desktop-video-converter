import type { VideoConversionError } from '../../../shared/video-conversion'
import type { VideoSelectionError } from '../../../shared/video-metadata'

interface StatusPanelProps {
  conversionError: VideoConversionError | null
  convertedOutputPath: string | null
  isConverting: boolean
}

function StatusPanel({
  conversionError,
  convertedOutputPath,
  isConverting
}: StatusPanelProps): React.JSX.Element | null {
  if (isConverting) {
    return (
      <section className="status-panel status-progress" role="status" aria-live="polite">
        <span className="status-spinner" aria-hidden="true" />
        <div>
          <strong>正在转换视频</strong>
          <p>请稍候，完成后会显示保存位置。</p>
        </div>
      </section>
    )
  }

  if (conversionError) {
    return (
      <section className="status-panel status-error" role="alert">
        <span className="status-icon" aria-hidden="true">
          !
        </span>
        <div>
          <strong>{conversionError.title}</strong>
          <p>{conversionError.message}</p>
        </div>
      </section>
    )
  }

  if (convertedOutputPath) {
    return (
      <section className="status-panel status-success" role="status" aria-live="polite">
        <span className="status-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>转换完成</strong>
          <p>已保存到：</p>
          <p className="status-path">{convertedOutputPath}</p>
        </div>
      </section>
    )
  }

  return null
}

interface SelectionErrorBannerProps {
  error: VideoSelectionError
  hasMetadata: boolean
}

export function SelectionErrorBanner({
  error,
  hasMetadata
}: SelectionErrorBannerProps): React.JSX.Element {
  return (
    <section className="status-panel status-error global-error-banner" role="alert">
      <span className="status-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>{error.title}</strong>
        <p>{error.message}</p>
        {hasMetadata && <p>当前仍显示上一次成功加载的视频信息。</p>}
      </div>
    </section>
  )
}

export default StatusPanel
