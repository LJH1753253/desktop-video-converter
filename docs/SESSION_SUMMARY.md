# 累计 AI 辅助开发记录

本文记录项目截至 Phase 2.6 错误场景与恢复路径修复完成时，开发者与 Codex 共同完成的工作、实际决策与真实反馈。

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

## 4. 基础元数据里程碑当时状态

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

### 当时尚未实现

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

### 当时的实现状态（缩略图里程碑结束时）

在原有元数据功能基础上，已经新增：

- FFmpeg 单帧抽取
- JPEG image2pipe stdout
- Buffer 转 Base64 Data URL
- Renderer 缩略图显示
- 缩略图失败占位 UI
- 横屏 / 竖屏比例保持
- 加载失败后保留上一成功缩略图
- 用户取消选择时保留当前缩略图

在该里程碑结束时尚未实现：

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

### 当时的范围与后续改进

本轮当时尚未实现：

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

## 7. 里程碑：产品化 UI 与 Drag & Drop（Phase 2.1）

### UI 信息架构

在保留单窗口桌面工具定位的前提下，Renderer 重构为：

- 顶部应用 Header；
- 左侧输入视频区域，包含空状态拖放区、点击选择、缩略图和 metadata 摘要；
- 右侧输出设置区域，包含目标格式、保存说明和转换按钮；
- 状态区域用于错误、成功和后续状态扩展。

没有引入 Dashboard 或侧边栏，也没有把 FFmpeg 专业参数暴露给普通用户。

### 安全 Drag & Drop 链路

拖放采用受控路径方案：

```text
Renderer File
→ Preload webUtils.getPathForFile(file)
→ 受控 IPC
→ Main Process
→ ffprobe / FFmpeg thumbnail
```

Renderer 不使用旧的 `File.path`，也不接触 `fs`、`child_process` 或完整 `ipcRenderer`。原生文件选择与拖放都复用 Main 内部的 `loadVideoFromPath(filePath)` 流程；只有 metadata 成功后才更新当前输入路径。

### 真实反馈与修复

- 约 900×670 的默认窗口初始空状态曾出现不必要的纵向滚动条，后通过调整 App Shell、主体区域和卡片的布局关系修复，没有用 `overflow:hidden` 裁掉内容。
- 视频加载/拖放错误改为位于 Header 下方的全局错误 Banner，避免小窗口滚动时用户看不到错误。
- 这一重要结果优先在顶部可见的 UX 原则后来在 Phase 2.6 继续应用到转换成功提示。
- 多文件拖入显示“一次只能添加一个视频”；单个不支持格式显示“不支持的文件格式”；文件夹先识别为“无法添加文件夹”；支持扩展名但内容损坏仍显示“无法读取该视频”。

开发者人工验证了空状态、点击选择、正常拖放、中文路径、空格路径、加载失败后恢复、多文件、非支持格式、损坏文件、文件夹拖入、小窗口和转换期间控件锁定等流程。未记录未实际观察的像素、耗时或截图数据。

## 8. 里程碑：Quality Preset（Phase 2.2）

共享层定义受控的 `QualityPreset`：`high`、`balanced`、`smaller`，Renderer 默认使用 `balanced`。Main 对 IPC 输入执行运行时校验，React 不构造 FFmpeg 参数。

H.264/AAC（MP4、MOV、MKV）映射：

| Preset | 视频 | 音频 |
| --- | --- | --- |
| High Quality | CRF 18 | AAC 192k |
| Balanced | CRF 23 | AAC 128k |
| Smaller File | CRF 28 | AAC 96k |

VP9/Opus（WebM）映射：

| Preset | 视频 | 音频 |
| --- | --- | --- |
| High Quality | CRF 24，`b:v 0` | Opus 160k |
| Balanced | CRF 31，`b:v 0` | Opus 128k |
| Smaller File | CRF 37，`b:v 0` | Opus 96k |

该里程碑没有改变分辨率或帧率，也没有加入 Expert Mode。开发者人工测试同一输入视频得到的输出大小为：High Quality 3,235,303 bytes、Balanced 1,895,989 bytes、Smaller File 1,130,185 bytes。Balanced 输出中观察到的 AAC 实际 bitrate 不一定精确等于 128k，这是编码结果的正常差异，不代表 preset 参数未生效。三个 UI 选项、转换期间锁定以及 WebM preset 均完成了人工验证。

## 9. 里程碑：真实转换进度（Phase 2.3）

FFmpeg 使用 `-progress pipe:1`，stdout 专门承载 progress protocol，stderr 只保留技术错误。Main 解析 `out_time_us`，按 `processedSeconds / duration * 100` 计算，并在运行期间限制为 0~99；只有转换和最终文件提交都成功后，Renderer 才显示 100%。

解析器维护跨 chunk 的 buffer，按 `\n` 识别完整行、去除行尾 `\r`、保留未完成尾部，并在 stdout 结束时安全处理剩余内容。无效数字被忽略；duration 无效时 percent 为 `null`，UI 使用 indeterminate 进度，不产生 NaN 或 Infinity。相同整数 percent 不重复发送。Preload 通过自己的 wrapper 注册和 `removeListener` 清理，不使用 `removeAllListeners`。

开发者人工观察到约一分钟视频的实时 WebM 进度约达到 75%，成功后显示 100%；第二次转换会清除上一次的 100%；Save Dialog 取消不产生 progress；输入输出相同的保护不会伪造进度成功。

## 10. 里程碑：Cancel 与 FFmpeg 生命周期（Phase 2.4）

Main 使用 `activeConversion` 和 `AbortController` 管理单一活动任务，任务登记发生在第一个 `await` 之前，`finally` 按任务对象身份清理。converter 监听 `AbortSignal`，通过 `ChildProcess.kill()` 终止 FFmpeg，并等待 `close` 后才结算；`error`、`close` 和 abort 通过 settled/process-closed 机制保证 Promise 只结算一次。没有使用 `taskkill`、`shell:true` 或 `removeAllListeners`。

Renderer 状态为 `converting → cancelling → cancelled / success / error`；点击取消不会立即把 `isConverting` 设为 false。`acceptProgressRef` 在真正开始转换时开启，用户请求取消时立即关闭，避免已经排队的旧 progress 覆盖最后状态。进入 `committing` 后不可取消，返回 `not-cancellable`；窗口在 running 阶段销毁会自动 abort，在 committing 阶段不强行中断文件提交。

取消时等待 FFmpeg 关闭，并清理本轮转换产生的不完整工作输出；Phase 2.5 引入 staged output 后，该清理对象进一步统一为应用生成的 sibling temp。FFmpeg 失败、用户取消和窗口关闭均不删除原本已有的最终文件。开发者人工验证了中途取消、取消后的重试、接近结束时取消、已有输出文件、Save Dialog 取消、正常成功回归，以及关闭窗口后通过 `Get-Process ffmpeg` 未发现孤儿进程。

## 11. 里程碑：staged output 与安全提交（Phase 2.5）

### 触发原因与文件生命周期

早期实现使用 `-y` 直接写最终路径，存在转换中途失败或取消时破坏已有最终文件的风险。因此改为 staged output：FFmpeg 永远写最终路径同目录的 sibling temp，例如 `.final-name.dvc-<uuid>.webm`，保持目标扩展名；参数从 `-y` 改为 `-n`。取消、FFmpeg 失败或窗口关闭只清理 temp，最终文件不作为 FFmpeg 工作文件。

默认 Save Dialog 路径使用本机 local time：

```text
<原文件名>-converted-YYYY-MM-DD_HH-mm-ss.<格式>
```

不使用 `toISOString()`，年月日时分秒固定宽度且不含 Windows 非法字符 `:`；同秒已存在时依次尝试 `(1)`、`(2)` 等名称。该 fallback 只用于 defaultPath，不代表最终提交可以覆盖文件。

本阶段没有增加自定义的“自动重命名 / 替换 / 取消”三按钮冲突框。用户主动在原生 Save Dialog 中选择已有文件时，继续依赖 Windows 原生覆盖确认；Save Dialog 返回后 Main 再根据最终路径是否存在选择 create 或 replace 提交模式。

### Create / Replace 提交

- Create 模式使用 `link(temp, final)` 做 exclusive publish，成功后 `unlink(temp)`；最终文件已存在时不会覆盖。
- Replace 模式先保存 `dev`、`ino`、`size`、`mtimeMs` 身份快照；FFmpeg 成功后再次检查 final，使用 `link(final, backup)` 创建 sibling backup，再次检查身份，随后直接 `rename(temp, final)`，不先 `unlink(final)`。成功后清理 backup；失败时清理 temp 和 backup，不把 cleanup 失败误报为有效输出失败。
- 身份快照与第二次检查是 best-effort TOCTOU 防护，不声称完全消除竞态。Windows 文件被占用或 rename 失败时返回受控错误并记录技术日志。
- 阶段末审计进一步统一了异常清理路径，使应用生成的 temp 与 backup 都进入 cleanup，而 final 始终不作为清理对象。

最终 success 的条件是：FFmpeg exit code 为 0，且 temp 到 final 的提交成功。仅 FFmpeg 编码成功不能让 Renderer 显示 100%。

开发者人工观察过转换期间存在 `.dvc-<uuid>.webm` temp，最终文件没有作为 FFmpeg 工作文件；转换完成后 temp 消失，最终文件生成且大小为 21,481,609 bytes。开发者还验证了 Create 取消、Create 竞态、Replace 成功、身份变化、文件锁定、窗口关闭以及只有最终提交成功才显示 100%。

## 12. 里程碑：错误场景与恢复路径修复（Phase 2.6）

### 真实审计结论

本轮没有确认 P0 问题：未确认存在数据损坏、应用崩溃、孤儿 FFmpeg 进程或取消后错误显示 100% 的情况。审计重点是失败分类、可恢复性和用户提示。

### 最小修复

- 新增 `INPUT_FILE_UNAVAILABLE`：Main 在 Save Dialog 前、启动 FFmpeg 前各检查一次输入路径。文件被移动/删除时，Renderer 显示“无法访问原视频 / 原视频可能已被移动或删除，请重新选择视频后再试。”并保留当前成功视频状态。
- 新增 `OUTPUT_PATH_UNAVAILABLE`：对最终路径所在目录执行 `stat`、目录判断和可写性检查，并将底层文件系统异常转换为“无法保存输出”的受控错误。该检查是 best-effort 防护，不宣称能消除所有外部竞态。FFmpeg 失败后也会在合理情况下重新检查输出目录，但不通过解析 stderr 猜测原因。
- 拖放先 `stat` 判断目录，再做扩展名判断；文件夹统一显示“无法添加文件夹”，避免把 `folder.mp4` 目录送入 ffprobe。
- 成功状态改为顶部 Banner，仅显示最终输出路径，不显示 temp/backup 内部路径；长路径可换行且不产生横向滚动，路径支持选择/复制。取消仍为轻量状态，不伪装成 error。

开发者实际复测了正常转换后的顶部 success、长路径布局、已加载输入被删除、Save Dialog 打开后输入被删除、普通文件夹拖入、名称带视频扩展名的文件夹拖入、普通文件拖放回归、取消回归以及错误后再次正常转换恢复。Windows ACL 无写权限测试中，原生 Save Dialog 在路径返回 Main 前已显示“你没有权限在此位置保存文件。”；因此该次只证明了操作系统层面的权限拦截，没有把它记录为应用层 `OUTPUT_PATH_UNAVAILABLE` UI 已被直接触发。

## 13. 当前累计状态（截至 Phase 2.6）

已经完成并经过相应自动检查和开发者人工验证的范围包括：

- Electron 桌面应用骨架与 Main / Preload / Renderer 安全分层；
- 单视频选择、受控 Drag & Drop、ffprobe 元数据、FFmpeg 缩略图；
- MP4 / MOV / MKV / WebM 基础转换与 Quality Preset；
- 实时 progress、Cancel、activeConversion 并发保护；
- timestamp default path、sibling temp、Create exclusive publish、受保护的 Replace；
- 输入/输出同路径保护、文件夹拖放分类、输入不可用和输出不可用错误分类；
- 顶部 success/error Banner，以及失败后保留上一成功视频 metadata 和 thumbnail。

尚未完成或尚未作为最终交付验证的事项：

- Phase 3 的最终产品交付审查；
- Windows 安装包/最终打包；
- FFmpeg / ffprobe 随应用分发；
- 干净机器上的安装后验证；
- 更大规模或长时长压力测试；
- 网络盘、非 NTFS 环境下 hard-link 兼容性验证；
- 最终 README、文档审阅、GitHub 交付和面试材料整理。

批量转换、ETA、云功能、数据库、GPU 加速等仍不在当前范围内。

## 14. Phase 3.1：最终交付与 Windows Packaging 审计

Phase 2 功能封存后，对当前 Electron 项目的最终交付能力进行了审计。

审计确认：

- 项目已经包含 `electron-builder` 和 NSIS 配置基础；
- 开发态 FFmpeg / ffprobe 依赖系统 `PATH`；
- 如果 packaged app 不携带 FFmpeg / ffprobe，普通用户机器上无法独立完成视频读取和转换；
- 当前正式交付目标明确为 Windows x64；
- 继续使用 electron-builder，不切换到其他 packaging framework。

## 15. Phase 3.2A：统一 Media Binary Resolver

新增：

```text
src/main/media-binaries.ts
```

resolver 规则：

- 开发态返回 `ffmpeg` 和 `ffprobe`，继续使用系统 `PATH`；
- packaged 环境返回：
  - `process.resourcesPath/ffmpeg/ffmpeg.exe`；
  - `process.resourcesPath/ffmpeg/ffprobe.exe`。

`ffprobe.ts`、`thumbnail.ts` 和 `converter.ts` 中原先直接使用的 binary 名称统一改为调用 resolver。原有 `shell:false`、FFmpeg 参数、Progress、Cancel 和 staged output 均保持不变。

开发态回归验证了 metadata、thumbnail、conversion、Progress 和 success/final path。

对应提交：

```text
74b40d7 refactor: centralize media binary paths
```

## 16. Phase 3.2B：Bundled FFmpeg 与 Packaging 资源

### Binary 决策与人工核验

最终选择的目标 binary 为：

- FFmpeg 9.0.2；
- Gyan `essentials_build-www.gyan.dev`；
- Windows x64。

开发者从 Gyan 官方 build 获取 ZIP，并完成 SHA256 校验：

```text
60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA
```

开发者实际执行 `ffmpeg.exe -version` 和 `ffprobe.exe -version`，确认版本为 `9.0.2-essentials_build-www.gyan.dev`，并验证了：

- `libx264`；
- `libvpx-vp9`；
- AAC；
- `libopus`。

binary 大小为：

```text
ffmpeg.exe   105423872 bytes
ffprobe.exe  105221120 bytes
```

实际包内发现 `LICENSE` 和 `README.txt`。其中 `README.txt` 记录了 GPL v3 以及 source revision：

```text
https://github.com/FFmpeg/FFmpeg/commit/946fcce07b
```

### Packaging 策略

由于两个 exe 均超过 GitHub 普通 Git blob 的单文件限制：

- binary 不进入源码 Git；
- `.gitignore` 精确忽略 `resources/ffmpeg/*.exe`；
- license 文本保留在资源目录并允许进入 Git；
- 本地 packaging 时 binary 仍放在 `resources/ffmpeg`。

`electron-builder.yml` 在 `files` 中排除：

```text
!resources/ffmpeg/**
```

并使用：

```yaml
extraResources:
  - from: resources/ffmpeg
    to: ffmpeg
```

这样 FFmpeg 不会同时进入 `app.asar` / `app.asar.unpacked` 和 `extraResources`，最终 packaged 路径为：

```text
process.resourcesPath/ffmpeg/ffmpeg.exe
process.resourcesPath/ffmpeg/ffprobe.exe
```

`THIRD_PARTY_NOTICES.md` 记录了 binary 来源、SHA256、版本、能力、GPLv3 标识、source revision 以及 CLI `spawn` 调用方式。

对应提交：

```text
94ddbf5 build: bundle ffmpeg resources for Windows packaging
```

## 17. Unpacked Build 与 PATH 隔离验证

执行：

```text
npm run build:unpack
```

成功生成：

```text
dist/win-unpacked/
dist/win-unpacked/desktop-video-converter.exe
```

packaged resources 中确认存在：

```text
resources/ffmpeg/ffmpeg.exe
resources/ffmpeg/ffprobe.exe
resources/ffmpeg/licenses/LICENSE
resources/ffmpeg/licenses/README.txt
```

整个 unpacked 目录中没有发现第二份 FFmpeg binary。

开发者进一步创建只保留 Windows 系统目录的临时 PowerShell `PATH`，确认 `where.exe ffmpeg` 和 `where.exe ffprobe` 均无法找到系统 FFmpeg。随后从该环境启动 unpacked app，并人工验证了 metadata、thumbnail、conversion、Progress 和 final output 均正常。

该验证确认 packaged app 在系统 `PATH` 无法提供 FFmpeg / ffprobe 的条件下仍可正常完成媒体处理流程，与 packaged resolver 的 bundled binary 路径设计一致。

## 18. Phase 3.3：NSIS Installer 与安装版验收

执行：

```text
npm run build:win
```

成功生成：

```text
dist/desktop-video-converter-1.0.0-setup.exe
```

安装包大小为：

```text
149944621 bytes
```

当前 NSIS 配置和验收目标为：

- Windows x64；
- `oneClick=true`；
- `perMachine=false`。

开发者使用 `Get-AuthenticodeSignature` 检查安装包，结果为：

```text
NotSigned
```

因此安装包当前未进行 Authenticode 代码签名。electron-builder 日志中的 `signing with signtool.exe` 不作为最终文件已签名的依据。

开发者实际完成安装版人工验收：

- 双击 NSIS installer；
- 正常安装；
- 从桌面快捷方式启动 Desktop Video Converter；
- metadata 正常；
- thumbnail 正常；
- conversion 正常；
- Progress 正常；
- final output 正常。

安装版人工验收通过。

## 19. Phase 3.4：README 与真实应用截图

最终保留了五张真实应用截图：

```text
docs/screenshots/
  01-主界面-初始化.png
  02-主界面-已选中视频.png
  03-视频转换中.png
  04-转换成功.png
  05-友好错误状态.png
```

README 已从 electron-vite scaffold 改写为中文项目主页，包含：

- 项目功能；
- 界面截图；
- 技术栈；
- Renderer / Preload / IPC / Main 架构；
- 安全边界；
- 转换配置；
- 开发模式；
- Windows packaging；
- bundled FFmpeg；
- Windows 交付状态；
- 项目结构；
- AI-assisted development 工程决策；
- 开发记录和测试文档入口。

README 明确说明：开发模式依赖系统 `PATH` 中的 ffmpeg / ffprobe，Windows packaged app 使用 bundled binary，当前实际验证平台为 Windows x64，安装包尚未代码签名。

## 20. Phase 3 的开发者主导与 AI 辅助工作流

开发者负责：

- 需求拆解、技术选型和架构约束；
- 功能范围和 FFmpeg 集成方案；
- Renderer / Preload / IPC / Main 安全边界；
- staged output、输出冲突保护和失败恢复策略；
- packaging 方案、binary 来源和 SHA256 校验；
- diff review、人工测试和 installer 验收；
- 根据真实测试结果决定是否接受每个阶段的修改。

AI coding assistant 主要用于：

- 局部代码实现；
- 静态审计；
- 辅助修改；
- 工程文档整理。

项目采用 developer-led、AI-assisted 的工程方式推进；AI 输出始终处于明确任务边界、依赖审批、diff review 和人工运行验收之下。

## 21. Post-delivery Usability Review & Product Polish

开发者主动邀请一名未参与开发流程的外部体验者，对已交付版本进行体验。这属于 external usability feedback，不是 formal user study，也不是 large-scale user testing。

### 外部反馈与 UI 产品化优化

外部体验发现部分界面状态下存在不必要滚动，Empty、Loaded 和 Success 状态所需空间不同，固定窗口尺寸不能很好覆盖状态变化。开发者认可该反馈并进行二次产品化优化。该问题不是原 UI 的基本功能错误，而是 internal correctness testing 后由外部体验暴露出的最大正常使用状态布局预算问题。

最终方案包括：

- Empty Mode 与 Working Mode；
- 首次成功加载视频后只扩展窗口一次；
- 基于当前 display work area 自适应并进行边界限制；
- 用户提前手动 resize 时不强制覆盖；
- compact success/error status；
- 窄窗口下的响应式和 document scrolling fallback。

当前源码中的窗口 sizing 参数为：

- 初始宽度：`min(1000, floor(workAreaWidth * 0.72))`，并受 work area margin 约束；
- Empty 高度：`min(550, floor(workAreaHeight * 0.76))`，并受 available height 约束；
- Working 高度：`min(780, floor(workAreaHeight * 0.92))`，并受 available height 约束；
- 最小窗口：宽度 `760`、高度 `520`（均不超过实际目标窗口尺寸）；
- work area margin：每侧 `24px`；
- Empty → Working 只自动 resize 一次；
- 用户尺寸与默认 Empty 尺寸偏差不超过 `24px` 时才执行自动扩展。

### 外部反馈与安装包体审计

外部体验者认为安装包对于一个专用转换工具显得较大。开发者没有直接删除功能，而是进行了 package composition audit。审计确认业务 app payload 较小，主要体积来自 Electron runtime、bundled FFmpeg / ffprobe 和 Electron locales。

### Electron locale 优化

正式打包只保留：

- `zh-CN`；
- `en-US`。

从此前旧 Offline Installer `149,944,621 Bytes / 142.998334 MiB` 到后续实际构建 `143,858,405 Bytes / 137.194066 MiB`，跨这两次实际构建观察到的净变化约为 `6.09 MB`（十进制）、`5.80 MiB`、`4.06%`。此前旧 build 与当前源码版本并非严格 same-source A/B，因此不能将全部变化归因于 locale 删除。

### FFmpeg 体积审计与未实施方案

开发者曾研究进一步裁剪 FFmpeg，当前 binary 实测为：

- `ffmpeg.exe`：`105,423,872 Bytes`；
- `ffprobe.exe`：`105,221,120 Bytes`；
- unpacked 合计约 `200.96 MiB`。

custom minimal FFmpeg 会增加 codec 输入兼容风险、Windows build toolchain、回归测试以及 GPL / external library distribution review 成本，因此开发者决定不为了 take-home 包体指标牺牲普通视频兼容性。

System FFmpeg / Lite 方案也评估过但没有实施：它会把 FFmpeg 安装和 PATH 配置成本转嫁给用户，且 Electron / Chromium runtime 仍然较大，不符合默认“给人用”的产品目标。

### NSIS Web Installer 决策

最终采用 Offline Installer + NSIS Web Installer 双分发策略：不删除 FFmpeg、不要求用户安装 FFmpeg、不更换技术栈，使用 electron-builder 原生 `nsis-web`，不新增 downloader 或 npm dependency，并保持同一完整 application payload。Online / Offline 功能一致，Offline Installer 为网络受限环境保留。

最近一次实际 Web 构建结果为：

- Web Installer：`770,261 Bytes / 0.734578 MiB`；
- application package：`143,365,904 Bytes / 136.724380 MiB`；
- 相比 Offline Installer 的入口体积减少 `99.464570%`。

Web Installer 优化的是 distribution entry size，不是 installed footprint。对应的固定 release 规划为 `v1.0.1`，预期 payload 为 `desktop-video-converter-1.0.1-x64.nsis.7z`；不使用 `latest/download`，以确保旧 installer 始终匹配自己的 package version。`.nsis.7z` 是 Web Installer backend asset，不面向用户手动安装。

本阶段仅完成 v1.0.1 release preparation：未创建 GitHub Release、未 publish、未 tag、未 commit、未 push。

## 22. Phase 5C：Offline Acceptance & Release Documentation

开发者本人已完成 v1.0.1 Offline Installer 人工回归，测试对象为：

```text
dist/desktop-video-converter-1.0.1-setup.exe
```

人工确认通过：installer 安装、桌面快捷方式、应用启动、Empty / Working 窗口、adaptive resize、滚动、compact status、文件选择、metadata、thumbnail、MP4 / WebM conversion、progress、cancel、success、输出播放、bundled FFmpeg 和系统 PATH 独立性。

### 最终截图

开发者已使用最终 v1.0.1 UI 人工更新以下截图，文件名保持不变，README 原有引用路径继续有效：

```text
docs/screenshots/01-主界面-初始化.png
docs/screenshots/02-主界面-已选中视频.png
docs/screenshots/03-视频转换中.png
docs/screenshots/04-转换成功.png
docs/screenshots/05-友好错误状态.png
```

本阶段没有修改、重新生成、压缩或替换 `docs/screenshots/**`。

### 最终 clean Release Candidate

清除旧构建残留后，正式 v1.0.1 RC 产物为：

- Offline Installer：`desktop-video-converter-1.0.1-setup.exe`，`143,860,452 Bytes`，SHA-256 `74625D0CDD23D44CFB330F238BCC5BA1FF43725DE8D2BB1BDE57484BA6237FCB`；
- Web Installer：`desktop-video-converter-1.0.1-web-setup.exe`，`770,269 Bytes`，SHA-256 `070A9E31A9D575F5DF5BE8368A605FB4A72DD9767F390E5900151046C35E398A`；
- Web application package：`desktop-video-converter-1.0.1-x64.nsis.7z`，`143,367,781 Bytes`，SHA-256 `C568E9532536CE2F0583387A1EB74EF437CF8ABFB96C5FB2271FBA311DEA242A`。

Web Installer 是约 `0.7346 MiB` 的 download / installation entry，安装时下载约 `136.73 MiB` 的完整 payload；它不代表应用只有 0.7 MiB，也不减少 installed footprint。Online / Web 与 Offline 功能一致，都内置 FFmpeg / ffprobe，用户无需安装 FFmpeg 或配置 PATH。

固定版本下载策略为：

```text
https://github.com/LJH1753253/desktop-video-converter/releases/download/v1.0.1/desktop-video-converter-1.0.1-x64.nsis.7z
```

不使用 `latest/download`，以确保 installer 与自身版本匹配。

### 最终 RC 的包体审计与构建卫生

package composition audit 保留了以下结论：业务 app payload 本身较小，主要体积来自 Electron / Chromium runtime、bundled FFmpeg / ffprobe 和 Electron locales。locale filtering 继续只保留 `zh-CN` 与 `en-US`。

从旧 Offline Installer `149,944,621 Bytes / 142.998334 MiB` 到正式版本 `143,860,452 Bytes / 约 137.196 MiB`，两次实际 build 观察到约 `6.08 MB`（十进制）、`5.80 MiB`、`4.06%` 的净 installer 下降。这不是严格 same-source A/B，不能声称全部变化严格由 locale 删除产生。

当前 FFmpeg binary 仍为：`ffmpeg.exe` `105,423,872 Bytes`、`ffprobe.exe` `105,221,120 Bytes`，合计约 `200.96 MiB` unpacked。进一步裁剪 custom minimal FFmpeg 会增加 codec 兼容性、Windows toolchain、回归测试和许可证审查风险，因此开发者决定不为 take-home 包体指标牺牲普通用户视频兼容性。Lite / System FFmpeg 方案也评估过但未实施，因为会转嫁 FFmpeg 安装和 PATH 配置成本，且 Electron runtime 仍然较大。

发布前 RC 构建还发现仓库内隔离保存的旧 dist backup 可能被 electron-builder 重新计入 application package。这属于 release engineering / build hygiene issue，不是应用运行时 app.asar bug。处理过程包括识别包体异常、停用异常 artifact、隔离旧构建目录、处理旧 `app.asar` 文件锁、恢复预期 Git 状态、清理 dist，并使用正式 npm scripts 重新生成和核验 RC；最终 `app.asar` 稳定为 `2,658,378 Bytes`，FFmpeg 只保留在 bundled resource 路径。

截至本阶段，T63 Offline Installer 人工回归为 Pass；T64 Web 在线安装和 T65 Web Installer 无网络 / 下载失败仍为 Pending，因为 v1.0.1 payload 尚未上传 GitHub Release。尚未 commit、push、tag、创建 Release 或 publish。
