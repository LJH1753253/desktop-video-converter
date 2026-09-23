function AppHeader(): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          DV
        </div>
        <div>
          <p className="eyebrow">DESKTOP VIDEO TOOL</p>
          <h1>Desktop Video Converter</h1>
        </div>
      </div>
      <p className="app-description">简单、清晰地转换本地视频格式</p>
    </header>
  )
}

export default AppHeader
