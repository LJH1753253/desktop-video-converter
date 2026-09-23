import type {
  ConversionProgress,
  OutputFormat,
  QualityPreset
} from '../../../shared/video-conversion'
import type { VideoMetadata } from '../../../shared/video-metadata'

interface OutputSettingsPanelProps {
  metadata: VideoMetadata | null
  outputFormat: OutputFormat
  qualityPreset: QualityPreset
  conversionProgress: ConversionProgress | null
  isConverting: boolean
  isCancelling: boolean
  isLoading: boolean
  onOutputFormatChange: (format: OutputFormat) => void
  onQualityPresetChange: (preset: QualityPreset) => void
  onConvert: () => void
  onCancel: () => void
}

function OutputSettingsPanel({
  metadata,
  outputFormat,
  qualityPreset,
  conversionProgress,
  isConverting,
  isCancelling,
  isLoading,
  onOutputFormatChange,
  onQualityPresetChange,
  onConvert,
  onCancel
}: OutputSettingsPanelProps): React.JSX.Element {
  const progressPercent = conversionProgress?.percent ?? null
  const showProgress = isConverting || conversionProgress !== null

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

          <fieldset className="quality-options" disabled={isConverting}>
            <legend className="field-label">质量</legend>
            <label className={`quality-option${qualityPreset === 'high' ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="quality-preset"
                value="high"
                checked={qualityPreset === 'high'}
                onChange={() => onQualityPresetChange('high')}
              />
              <span>
                <strong>高质量</strong>
                <small>优先保持画质，文件通常较大</small>
              </span>
            </label>
            <label
              className={`quality-option${qualityPreset === 'balanced' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="quality-preset"
                value="balanced"
                checked={qualityPreset === 'balanced'}
                onChange={() => onQualityPresetChange('balanced')}
              />
              <span>
                <strong>
                  均衡 <em>推荐</em>
                </strong>
                <small>质量和文件大小之间的推荐折中</small>
              </span>
            </label>
            <label className={`quality-option${qualityPreset === 'smaller' ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="quality-preset"
                value="smaller"
                checked={qualityPreset === 'smaller'}
                onChange={() => onQualityPresetChange('smaller')}
              />
              <span>
                <strong>更小文件</strong>
                <small>提高压缩强度，文件通常更小</small>
              </span>
            </label>
          </fieldset>

          <div className="save-hint">
            <span className="save-hint-icon" aria-hidden="true">
              ▣
            </span>
            <p>点击转换后选择保存位置，原视频不会被覆盖。</p>
          </div>

          {showProgress && (
            <div className="conversion-progress" role="status" aria-live="polite">
              <div className="progress-heading">
                <strong>
                  {progressPercent === 100 ? '转换完成' : isCancelling ? '正在取消…' : '正在转换…'}
                </strong>
                <span>{progressPercent === null ? '正在处理' : `${progressPercent}%`}</span>
              </div>
              <div
                className={`progress-track${progressPercent === null ? ' is-indeterminate' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent ?? undefined}
                aria-valuetext={progressPercent === null ? '正在转换' : `${progressPercent}%`}
              >
                <span
                  className="progress-fill"
                  style={{ width: progressPercent === null ? '35%' : `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isConverting ? (
            <button
              className="button button-secondary convert-button"
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
            >
              <span>{isCancelling ? '正在取消…' : '取消转换'}</span>
            </button>
          ) : (
            <button
              className="button button-primary convert-button"
              type="button"
              onClick={onConvert}
              disabled={isLoading}
            >
              <span>开始转换</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default OutputSettingsPanel
