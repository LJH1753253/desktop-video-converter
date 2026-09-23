import type { OutputFormat } from '../../../shared/video-conversion'
import type { VideoMetadata } from '../../../shared/video-metadata'

interface OutputSettingsPanelProps {
  metadata: VideoMetadata | null
  outputFormat: OutputFormat
  isConverting: boolean
  isLoading: boolean
  onOutputFormatChange: (format: OutputFormat) => void
  onConvert: () => void
}

function OutputSettingsPanel({
  metadata,
  outputFormat,
  isConverting,
  isLoading,
  onOutputFormatChange,
  onConvert
}: OutputSettingsPanelProps): React.JSX.Element {
  return (
    <section className="output-panel" aria-label="输出设置">
      <div className="section-heading">
        <div>
          <p className="section-kicker">OUTPUT SETTINGS</p>
          <h2>输出设置</h2>
        </div>
        <span className="local-badge">本地处理</span>
      </div>

      {!metadata ? (
        <div className="output-empty">
          <span className="output-empty-icon" aria-hidden="true">
            →
          </span>
          <strong>选择视频后设置输出格式</strong>
          <p>文件会在本机处理，不会上传到云端。</p>
        </div>
      ) : (
        <div className="output-controls">
          <label className="field-label" htmlFor="output-format">
            目标格式
          </label>
          <select
            id="output-format"
            className="format-select"
            value={outputFormat}
            onChange={(event) => onOutputFormatChange(event.target.value as OutputFormat)}
            disabled={isConverting}
          >
            <option value="mp4">MP4</option>
            <option value="mov">MOV</option>
            <option value="mkv">MKV</option>
            <option value="webm">WebM</option>
          </select>

          <div className="save-hint">
            <span className="save-hint-icon" aria-hidden="true">
              ▣
            </span>
            <p>点击转换后选择保存位置，原视频不会被覆盖。</p>
          </div>

          <button
            className="button button-primary convert-button"
            type="button"
            onClick={onConvert}
            disabled={isConverting || isLoading}
          >
            <span>{isConverting ? '正在转换…' : '开始转换'}</span>
            {!isConverting && <span aria-hidden="true">→</span>}
          </button>
        </div>
      )}
    </section>
  )
}

export default OutputSettingsPanel
