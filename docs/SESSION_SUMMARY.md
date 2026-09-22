# 累计 AI 辅助开发记录

本文记录项目截至“基础视频格式转换”里程碑结束时，开发者与 Codex 共同完成的工作、实际决策与真实反馈。

## 1. 项目目标

本项目用于三天限时 AI 工程笔试，目标是开发一个面向普通用户的 Electron 桌面视频格式转换器。

当前技术栈：

- Electron
- React
- TypeScript
- Vite
- Node.js
- FFmpeg / ffprobe
- Git / GitHub

## 2. AI 与开发者分工

### Codex

- 项目骨架实现
- Electron IPC / Main / Preload / Renderer 代码
- ffprobe 元数据解析
- 根据开发者反馈修改代码
- 自动执行 typecheck、lint 和 build

### 开发者

- 技术选型
- 范围控制
- 依赖变更审批
- Windows 环境搭建
- Git / GitHub
- 人工 UI 测试
- 实际视频测试
- UX 判断
- 接受、拒绝或修改 AI 建议
- 最终验收

## 3. 真实开发者决策和反馈

### 决策 1：Electron 而不是普通 Web

题目明确强调客户端，招聘 JD 也包含 Electron、Tauri 等桌面客户端技术，因此项目采用 Electron 桌面客户端，而不是普通 Web 页面。

### 决策 2：建立安全的 Electron 分层

项目采用以下调用链：

```text
Renderer
→ Preload
→ IPC
→ Main Process
→ FFmpeg / ffprobe
```

安全约束：

- `nodeIntegration=false`
- `contextIsolation=true`
- Renderer 不直接访问 `fs`、`child_process` 等 Node.js API
- 本地文件系统和外部进程能力通过受控的 Preload API 与 IPC 暴露

### 决策 3：拒绝 Codex 自动升级 Electron

项目初始化期间，Codex 发现 `npm audit` 报告 Electron 39 的间接依赖 `extract-zip` 存在 2 个 high severity 告警，并准备将 Electron 自动升级到 44。开发者叫停了该操作。

开发者认为，跨主版本升级属于工程边界和依赖决策，可能引入新的兼容性风险，不能仅因为 audit 告警由 AI 自动决定。该事件不表示漏洞已经被利用。

随后在 `AGENTS.md` 中增加约束：依赖和环境变更必须先向开发者报告，说明影响与可选方案，并获得明确批准后才能执行。

### 决策 4：中文路径的 canonical path

开发者手动运行 ffprobe 后发现：

- 中文路径的视频可以成功读取；
- 但 ffprobe JSON 中的 `format.filename` 在当前 Windows 环境显示乱码。

因此决定：

- `filePath` 使用 Electron 文件选择器返回的原始路径；
- `fileName` 从该原始路径提取；
- 不依赖 ffprobe 的 `format.filename`；
- ffprobe 仅负责媒体技术元数据。

### 决策 5：容器名称归一化

人工 UI 测试发现，MP4 的容器格式被直接显示为：

```text
mov,mp4,m4a,3gp,3g2,mj2
```

开发者认为这是 FFmpeg 的技术内部表示，不适合普通用户，因此要求在 Main Process 元数据层完成容器名称归一化，而不是在 React UI 中处理。

修改后经开发者人工复测，MP4 已正确显示为 `MP4`。

### 决策 6：技术错误与用户错误分离

开发者使用伪造的 `invalid_test.mp4` 进行人工测试。该文件扩展名为 `.mp4`，但实际内容不是视频。

首次测试时：

- 应用没有崩溃；
- ffprobe 失败被程序捕获；
- UI 直接显示了 `moov atom not found`、`Invalid data found when processing input` 等 FFmpeg stderr。

开发者认为普通用户不应该看到底层技术错误，因此要求：

- Main Process 保留 `technicalDetails` 用于开发诊断；
- UI 只显示“无法读取该视频”；
- UI 说明“所选文件不是有效的视频文件，或文件已损坏。”；
- 如果已有一个成功加载的视频，则继续保留其信息；
- UI 明确说明“当前仍显示上一次成功加载的视频信息。”。

修复后，开发者人工复测通过。

### 决策 7：限制 Codex 自动修改文档

Codex 曾在没有明确要求时主动创建或更新 `SESSION_SUMMARY.md` 和 `TEST_REPORT.md`。

开发者认为，代码任务不应该附带未经批准的文档修改，尤其人工测试结果必须先由开发者真实验证。因此，`AGENTS.md` 新增了文档修改权限规则，Codex 只有在获得明确授权时才能修改相关文档。

## 4. 当前里程碑状态

### 已实现

- Electron 桌面应用骨架
- 原生单视频文件选择
- ffprobe 元数据读取
- 文件名、文件大小和时长
- 分辨率
- 帧率
- 视频编码
- 音频编码
- 容器格式
- 无音频流处理
- 中文路径
- 空格路径
- 无效媒体友好错误
- 加载失败后保留上一次成功视频的信息
- FFmpeg 单帧缩略图生成
- JPEG image2pipe stdout 输出
- Buffer 转 Base64 Data URL
- Renderer 缩略图显示
- 缩略图失败占位 UI
- 横屏和竖屏缩略图比例保持
- 加载失败后保留上一次成功视频的缩略图
- 用户取消选择时保留当前缩略图
- MP4 / MOV / MKV / WebM 基础视频格式转换
- 原生 Save Dialog 输出路径选择
- 固定且受控的编码 profile
- 无音频输入转换
- 转换成功、取消和错误状态反馈
- 输入文件覆盖保护
- 转换期间保持当前 metadata 和 thumbnail

### 尚未实现

- Drag & Drop
- 转换百分比 Progress
- 转换中 Cancel
- Quality Preset
- Batch
- 最终安装包 / 正式打包
- FFmpeg 随应用分发

## 5. 里程碑：视频缩略图生成与显示

### 实现方式

缩略图生成与显示采用以下调用链：

```text
Renderer
→ Preload
→ IPC
→ Main Process
→ FFmpeg
→ JPEG stdout
→ Buffer
→ Base64 Data URL
→ Renderer <img>
```

实现使用系统 FFmpeg CLI，不创建临时 JPEG 文件。FFmpeg 通过以下方式执行：

```ts
spawn('ffmpeg', args, {
  shell: false
})
```

缩略图最大尺寸为 640×360，并通过以下过滤器保持原始宽高比：

```text
scale=640:360:force_original_aspect_ratio=decrease
```

### 开发者决策：不使用临时图片文件

开发者选择 FFmpeg `image2pipe`、stdout Buffer 和 Base64 Data URL 的实现方式。

原因：

- 避免临时文件的创建和清理；
- 避免 `file://` 路径和 Electron 本地资源访问问题；
- 单张低分辨率缩略图的数据量较小，适合当前三天 MVP；
- 保持 Renderer 不直接访问文件系统。

这不是唯一正确的缩略图方案。如果未来需要大量缩略图或批量任务，可以重新评估缓存文件或自定义协议方案。

### 开发者决策：抽帧时间点

当 `duration` 是有效正数时：

```text
timestamp = min(duration × 0.1, 10)
```

即：

- 大约取视频 10% 的位置；
- 最多不超过第 10 秒；
- `duration` 无效时 fallback 到 0 秒。

该策略用于减少固定取第 0 秒时遇到黑帧、片头或不具代表性的第一帧的概率。

### 开发者决策：缩略图失败必须非致命

元数据读取属于核心功能，缩略图属于辅助功能。

如果 ffprobe 成功而 FFmpeg 抽帧失败：

- 整体视频选择仍返回 `success`；
- `metadata` 正常显示；
- `thumbnailDataUrl` 为 `null`；
- Main Process 记录技术错误；
- Renderer 显示“无法生成视频预览”；
- 不把缩略图失败升级成整个视频加载失败。

这是 graceful degradation（优雅降级）。

### 当前实现状态

在原有元数据功能基础上，已经新增：

- FFmpeg 单帧抽取
- JPEG image2pipe stdout
- Buffer 转 Base64 Data URL
- Renderer 缩略图显示
- 缩略图失败占位 UI
- 横屏 / 竖屏比例保持
- 加载失败后保留上一成功缩略图
- 用户取消选择时保留当前缩略图

尚未实现：

- Progress
- Cancel
- Drag & Drop
- Quality Preset
- 最终打包
- FFmpeg 随应用分发

## 6. 里程碑：基础视频格式转换

### 基础转换调用链

基础视频转换采用以下调用链：

```text
Renderer
→ window.videoApi.convertVideo(targetFormat)
→ Preload
→ video:convert IPC
→ Main Process
→ Electron Save Dialog
→ converter.ts
→ spawn('ffmpeg', args, { shell: false })
→ 输出文件
→ success / cancelled / error
→ Renderer
```

### 支持的受控输出格式

共享 `OutputFormat` 类型只允许以下四种值：

- `mp4`
- `mov`
- `mkv`
- `webm`

Renderer 只能发送目标格式，不能控制任意 FFmpeg 参数、codec 名称、shell command、`inputPath` 或 `outputPath` 的直接 FFmpeg 执行逻辑。Main Process 使用 `isOutputFormat()` 对 IPC 输入再次进行运行时校验。

### 固定编码 profile

四种输出格式使用固定编码配置：

- MP4：`libx264`、`aac`、`yuv420p`
- MOV：`libx264`、`aac`、`yuv420p`
- MKV：`libx264`、`aac`、`yuv420p`
- WebM：`libvpx-vp9`、`libopus`

共同使用以下 stream mapping：

```text
-map 0:v:0
-map 0:a?
```

其中 `0:a?` 表示音频流为可选项，因此输入视频不存在音频流时仍可正常转换。

### 输出路径设计

Main Process 使用 Electron 原生 `showSaveDialog()` 让用户选择最终输出位置。默认输出文件名为：

```text
<原文件名>-converted.<目标格式>
```

文件名和路径通过 Node.js 的 `path.parse()`、`path.join()` 等路径 API 处理，不手工拆分路径。

如果用户取消 Save Dialog：

- 返回 `cancelled`；
- 不启动 FFmpeg；
- Renderer 不显示错误；
- 当前 metadata 和 thumbnail 保持不变。

### 当前输入视频状态

Main Process 保存最近一次成功加载的视频路径，只有新视频成功读取 metadata 后才更新当前输入路径。

因此，以下流程中当前可转换输入仍然是视频 A：

```text
成功加载 A
→ 尝试加载无效 B
→ B 读取失败
→ 当前可转换输入仍保持 A
```

Renderer 不需要重新传入任意 `inputPath`。

### 输入文件保护

转换前会比较 `inputPath` 和 `outputPath`。在 Windows 下，比较过程会先将路径解析为绝对路径并忽略路径大小写。

如果两个路径相同：

- 返回 `OUTPUT_MATCHES_INPUT`；
- 不启动 FFmpeg；
- UI 显示友好错误。

开发者已实际人工测试：在 Save Dialog 中选择原视频本身作为输出后，保护逻辑成功触发。开发者在转换前后分别计算原视频的 SHA256，结果完全一致，确认原文件没有被修改。

### FFmpeg 执行安全

FFmpeg 通过以下方式执行：

```ts
spawn('ffmpeg', args, {
  shell: false
})
```

输入路径和输出路径均为独立 argv 元素，不拼接 shell command。完整 stderr 只保留在 Main Process 技术日志中，不直接返回 Renderer。

用户在 Save Dialog 中明确确认输出路径后，FFmpeg 使用 `-y`，避免已有目标文件时在无 stdin 的情况下等待覆盖确认。

### Renderer 状态

只有成功加载 metadata 后才显示转换区域。转换区域包含：

- MP4 / MOV / MKV / WebM 目标格式选择；
- 开始转换按钮；
- “正在转换…”状态；
- success 输出路径；
- error 友好消息。

转换期间禁止再次选择输入视频、修改目标格式或重复点击开始转换。转换成功、转换失败或取消 Save Dialog 均不会破坏当前 metadata 和 thumbnail。

### 当前范围与后续改进

本轮尚未实现：

- 转换百分比 Progress
- 转换中 Cancel
- Drag & Drop
- Quality Preset
- Batch
- 最终安装包 / 正式打包
- FFmpeg 随应用分发

已知的非阻塞后续改进：

- FFmpeg 中途失败时可能留下不完整的输出文件，目前尚未实现“临时文件写入成功后再 rename”的策略；
- 最终随应用分发 FFmpeg 后，面向普通用户的错误提示不应再要求用户自行安装 FFmpeg。
