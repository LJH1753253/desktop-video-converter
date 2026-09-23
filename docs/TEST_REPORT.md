# 测试报告

本文记录项目截至 Phase 2.6 错误场景与恢复路径修复完成时已经真实执行的人工测试和自动检查。

## 1. 开发者人工测试

以下测试均由开发者本人在 Windows 环境中执行。

### T01 普通 MP4 加载

测试文件：`324469248.mp4`

结果：通过。

人工观察到：

- 分辨率：1280×720
- 时长：约 8.7 秒
- 帧率：30 fps
- 视频编码：H.264
- 音频编码：AAC
- 容器格式：MP4

### T02 中文路径

测试文件位于中文目录。

结果：通过。

- 视频能够正常读取；
- UI 中的文件名没有乱码。

开发者此前直接调用 ffprobe 时，发现 `format.filename` 在当前终端环境存在中文乱码。因此，应用没有采用该字段作为 canonical path，而是使用 Electron 文件选择器返回的原始路径。

### T03 取消文件选择

步骤：已有成功加载的视频时打开文件选择器，然后取消。

结果：通过。

- 无报错；
- 无卡死；
- 原视频信息保持不变。

### T04 无效 / 损坏媒体

开发者创建了 `invalid_test.mp4`，其实际内容不是视频。

第一次测试：

- ffprobe 失败被正确捕获；
- 应用没有崩溃；
- UI 直接暴露了完整 FFmpeg stderr。

因此判定：功能错误处理存在，但用户体验不合格。

修复后重新人工测试，结果通过。UI 显示：

```text
无法读取该视频
所选文件不是有效的视频文件，或文件已损坏。
```

UI 不再向用户暴露 FFmpeg stderr。

### T05 加载失败后保留上一成功视频

步骤：

1. 加载正常视频；
2. 再选择 `invalid_test.mp4`。

结果：通过。

- 错误提示正常；
- 上一次成功视频的元数据仍然保留；
- UI 明确提示当前仍显示上一次成功加载的视频信息。

### T06 空格路径

测试路径：

```text
D:\Video Test\sample video.mp4
```

结果：通过。

目录名和文件名均包含空格，ffprobe 正常执行。

### T07 无音频视频

开发者使用 FFmpeg 创建了无音轨测试视频。

结果：通过。

UI 显示：

```text
无音频流
```

应用没有把无音轨当成视频加载失败。

### T08 WebM

开发者由测试 MP4 创建了 WebM 文件。

结果：通过。

- 应用能够读取该文件；
- 没有发生错误；
- WebM 容器识别正常。

### T09 MP4 容器名称归一化

第一次人工测试时，UI 显示：

```text
mov,mp4,m4a,3gp,3g2,mj2
```

判定：功能数据来源正确，但普通用户体验不合格。

修改后人工复测，结果通过。UI 显示：

```text
MP4
```

### T10 最终本机 Build

开发者本人执行：

```powershell
npm run build
```

结果：通过。

包括：

- Main / Preload TypeScript typecheck
- Renderer TypeScript typecheck
- Main build
- Preload build
- Renderer build

### T11 普通 MP4 缩略图

开发者加载：`324469248.mp4`

结果：通过。

- 缩略图成功显示；
- 元数据正常；
- 画面无明显拉伸；
- 无红色错误提示。

### T12 中文路径缩略图

普通测试视频本身位于中文目录。

结果：通过。

- FFmpeg 能从中文路径视频生成缩略图；
- 缩略图正常显示。

### T13 空格路径缩略图

测试路径：

```text
D:\Video Test\sample video.mp4
```

结果：通过。

- 目录和文件名包含空格；
- FFmpeg 抽帧正常；
- 缩略图正常显示。

### T14 无音频视频缩略图

测试文件：`sample video no audio.mp4`

结果：通过。

- 缩略图正常显示；
- 音频编码仍显示“无音频流”；
- 无音轨没有影响视频抽帧。

### T15 WebM 缩略图

测试文件：`sample video.webm`

结果：通过。

- WebM 正常读取；
- 缩略图正常显示；
- 无异常。

### T16 竖屏 / 非 16:9 视频

开发者使用 FFmpeg 将测试视频旋转为竖屏视频：`vertical video.mp4`。

UI 显示分辨率：

```text
720 × 1280
```

结果：通过。

- 缩略图保持竖屏比例；
- 没有被拉伸成横向 16:9；
- 元数据正常。

### T17 正常视频 → 无效视频

步骤：

1. 先加载正常视频并成功显示缩略图；
2. 再选择无效的 `invalid video.mp4`。

结果：通过。

- 显示友好错误提示；
- 应用不崩溃；
- 上一次成功视频的 metadata 保留；
- 上一次成功视频的缩略图保留。

### T18 正常视频 → 取消文件选择

步骤：

1. 当前已有正常视频及缩略图；
2. 点击选择视频；
3. 在文件选择器中取消。

结果：通过。

- 当前 metadata 不变；
- 当前 thumbnail 不变；
- 不新增错误。

### T19 本轮最终本机 Build

开发者本人执行：

```powershell
npm run build
```

结果：通过。

包括：

- Main / Preload TypeScript typecheck
- Renderer TypeScript typecheck
- Main build
- Preload build
- Renderer build

### T20 App 内 MP4 → WebM

输入：

```text
D:\Video Test\sample video.mp4
```

输出：

```text
D:\Video Test\ui-converted.webm
```

开发者确认：

- UI 转换流程正常；
- 文件生成成功；
- 文件可以正常播放；
- ffprobe 检查结果：
  - video codec：`vp9`
  - audio codec：`opus`
  - `format_name`：`matroska,webm`
  - duration：`8.741000`

结果：通过。

### T21 App 内 WebM → MP4

输入：`sample video.webm`

输出：

```text
D:\Video Test\webm-to-mp4.mp4
```

ffprobe 检查结果：

- video codec：`h264`
- `pix_fmt`：`yuv420p`
- audio codec：`aac`
- `format_name`：`mov,mp4,m4a,3gp,3g2,mj2`
- duration：`8.748500`

结果：通过。

### T22 无音频 MP4 → WebM

输入：`sample video no audio.mp4`

输出：

```text
D:\Video Test\no-audio-to-webm.webm
```

ffprobe 检查结果：

- 只有 video stream；
- video codec：`vp9`；
- 没有 audio stream；
- `format_name`：`matroska,webm`；
- duration：`8.666000`。

结果：通过。

该测试验证了 `-map 0:a?` 对无音频输入正常工作。

### T23 输入文件覆盖保护

输入：

```text
D:\Video Test\sample video.mp4
```

目标格式：MP4。

开发者在 Save Dialog 中故意选择输入文件本身作为输出。

结果：

- UI 显示“无法保存到原视频”；
- UI 提示输出文件不能与当前输入视频相同；
- 保护逻辑成功触发；
- metadata 保持；
- thumbnail 保持；
- 开发者在测试前后分别执行 SHA256；
- 前后 SHA256 完全一致；
- 确认原视频没有被修改。

结果：通过。

### T24 Save Dialog 取消

步骤：

1. 当前已有成功加载的视频；
2. 点击开始转换；
3. Save Dialog 出现；
4. 点击取消。

结果：

- 不启动转换；
- 不显示错误；
- 不显示伪成功；
- metadata 保持；
- thumbnail 保持；
- 开始转换按钮恢复可用。

结果：通过。

### T25 App 内 MP4 → MOV

输出：

```text
D:\Video Test\mp4-to-mov.mov
```

ffprobe 检查结果：

- video codec：`h264`
- `pix_fmt`：`yuv420p`
- audio codec：`aac`
- `format_name`：`mov,mp4,m4a,3gp,3g2,mj2`
- duration：`8.704500`
- `major_brand`：`"qt  "`

结果：通过。

### T26 App 内 MP4 → MKV

输出：

```text
D:\Video Test\mp4-to-mkv.mkv
```

ffprobe 检查结果：

- video codec：`h264`
- `pix_fmt`：`yuv420p`
- audio codec：`aac`
- `format_name`：`matroska,webm`
- duration：`8.725000`

结果：通过。

### T27 本轮最终本机 Build

开发者本人执行：

```powershell
npm run build
```

结果：通过。

实际包括：

- Main / Preload TypeScript typecheck：通过；
- Renderer TypeScript typecheck：通过；
- Main build：通过；
- Preload build：通过；
- Renderer build：通过。

### T28 Phase 2.1 空状态与桌面布局

开发者打开应用检查初始空状态、顶部 Header、输入区域和输出区域。

结果：通过。

- 首次打开即可理解“拖入视频”或“选择视频”；
- 单窗口桌面工具结构正常；
- 没有出现 Dashboard 或侧边栏。

### T29 Phase 2.1 默认窗口滚动与小窗口

开发者在约 900×670 的默认窗口尺寸下复测初始空状态，并缩小窗口检查内容是否仍可正常滚动。

结果：通过。

- 默认尺寸下初始空状态无需纵向滚动；
- 更小窗口内容确实放不下时仍可正常滚动；
- 没有通过裁切隐藏内容。

### T30 点击选择与 Drag & Drop 基本流程

开发者分别使用点击选择和拖放方式加载正常视频。

结果：通过。

- 点击选择继续可用；
- 单文件拖放成功；
- 加载后 metadata 与缩略图正常显示；
- 输入视频与输出设置视觉分区清晰。

### T31 Drag & Drop 路径与恢复场景

开发者人工测试中文路径、空格路径、正常视频 A 加载后再加载视频 B，以及加载失败后继续操作。

结果：通过。

- 中文路径和空格路径拖放成功；
- 新视频成功加载后替换旧视频；
- 失败后保留上一成功视频 metadata 和 thumbnail；
- 错误后仍可重新选择视频。

### T32 Drag & Drop 错误分类

开发者分别拖入多个文件、单个不支持格式、损坏视频和文件夹。

结果：通过。

- 多文件显示“一次只能添加一个视频”；
- 不支持格式显示“不支持的文件格式”；
- 损坏/伪造扩展名视频显示“无法读取该视频”；
- 文件夹显示“无法添加文件夹”；
- 错误后原视频状态保持，应用仍可继续使用。

### T33 Quality Preset 输出大小

开发者使用同一输入视频分别执行三个质量预设。

结果：通过。

- High Quality：3,235,303 bytes；
- Balanced：1,895,989 bytes；
- Smaller File：1,130,185 bytes。

Balanced 输出观察到的 AAC 实际 bitrate 不一定精确等于 128k；该现象符合编码结果差异，不作为失败判定。

### T34 Quality Preset UI 与转换锁定

开发者检查三个质量选项、默认值、转换期间的控件状态，并执行 WebM preset 转换。

结果：通过。

- 默认选项为 Balanced；
- High Quality、Balanced、Smaller File 文案和说明可见；
- 转换期间格式、质量和输入选择被锁定；
- WebM preset 转换正常。

### T35 实时转换进度

开发者使用约一分钟视频观察 WebM 转换过程。

结果：通过。

- 转换过程中看到实时百分比，约达到 75%；
- FFmpeg 成功且最终提交成功后显示 100%；
- 第二次转换会清除上一次的 100%；
- Save Dialog 取消不产生 progress；
- 输入输出同路径保护不会伪造 progress 成功。

### T36 转换取消与 UI 状态

开发者在转换中点击 Cancel，并观察接近结束时取消的行为。

结果：通过。

- Cancel 后先显示“正在取消…”；
- 取消期间控件保持锁定；
- 等 FFmpeg close 后返回 cancelled；
- 不显示 100%；
- 取消完成后可以重新转换；
- 接近结束时取消不会把取消错误显示成成功。

### T37 取消后的文件和重试

开发者检查取消后的 partial/temp 文件、已有输出文件，并随后重新执行转换。

结果：通过。

- 本次生成的 temp 被清理；
- 原本已经存在的输出文件没有被盲目删除；
- 取消后可以重新转换；
- Save Dialog 取消仍保持静默，不显示转换错误。

### T38 窗口关闭与 FFmpeg 进程

开发者在转换运行期间关闭窗口，并使用 PowerShell `Get-Process ffmpeg` 检查进程。

结果：通过。

- running 阶段任务被 abort；
- 没有观察到孤儿 `ffmpeg.exe`；
- temp 被清理；
- committing 阶段不会为了关闭窗口强行破坏文件提交。

### T39 staged output 运行观察

开发者在转换运行期间观察输出目录。

结果：通过。

- 看到 sibling `.dvc-<uuid>.webm` 临时文件；
- FFmpeg 没有把最终文件作为工作输出；
- 转换完成后 temp 消失；
- 最终生成文件大小为 21,481,609 bytes。

开发者曾在 WebM 约 56% 时观察到临时文件 Length=0；随后 FFmpeg 正常完成、临时文件消失、最终文件正常生成。该现象没有被判定为功能失败。

### T40 Create 提交取消与竞态

开发者人工验证 Create 模式下取消，以及目标文件在检查后出现的提交竞态。

结果：通过。

- 取消只清理 temp，final 保持不变；
- Create 使用 exclusive publish，不覆盖已出现的 final；
- 提交冲突返回受控错误，任务可以恢复。

### T41 Replace 提交、身份变化与文件锁定

开发者人工验证 Replace 成功、final 身份变化和文件被占用/锁定的情况。

结果：通过。

- Replace 成功后 final 为新视频；
- 身份快照变化时不继续替换；
- rename/文件锁定失败不会误报成功；
- temp/backup 清理后可以重新转换。

### T42 staged output 与最终 100% 关系

开发者观察 FFmpeg 编码成功但最终提交尚未完成的阶段。

结果：通过。

- 只有 temp→final 提交成功后才显示 100%；
- commit failure 不显示 100%；
- Cancel 不显示 100%。

### T43 Phase 2.6 输入文件不可用

开发者先成功加载视频，再在资源管理器中删除输入文件；另一次测试在 Save Dialog 打开后删除输入文件。

结果：通过。

- 应用不会崩溃；
- 显示“无法访问原视频”及重新选择提示；
- 上一次成功视频状态保持；
- 不产生伪成功；
- 失败后可重新选择新视频。

### T44 Phase 2.6 输出路径与成功 Banner

开发者执行正常转换并检查长输出路径与成功状态。

结果：通过。

- 成功信息位于顶部 Banner；
- 只显示最终输出路径，不暴露 temp/backup 路径；
- 长路径可以换行，不产生横向滚动；
- 正常转换后 metadata 和 thumbnail 保持可用。

### T45 Phase 2.6 文件夹与普通文件拖放回归

开发者分别拖入普通文件夹、名称带 `.mp4` 扩展名的文件夹，以及正常视频文件。

结果：通过。

- 文件夹均显示“无法添加文件夹”；
- 文件夹不会进入 ffprobe；
- 正常视频拖放没有回归。

### T46 Phase 2.6 错误后恢复

开发者先触发错误，再选择正常视频并重新转换。

结果：通过。

- 错误提示不会阻止后续操作；
- 可以重新加载正常视频；
- 可以再次完成转换；
- 旧错误不会污染新的 success 状态。

### T47 Windows ACL 无写权限观察

开发者使用 Windows ACL 创建无写权限目录并尝试在其中保存。

结果：操作系统层面拦截。

原生 Save Dialog 在路径返回 Main 前显示“你没有权限在此位置保存文件。”因此本次测试确认了 Windows 原生权限保护，但没有把它记录为应用层 `OUTPUT_PATH_UNAVAILABLE` UI 已被直接触发。

### T48 Phase 3.2A Media Binary Resolver 开发态回归

开发者执行 `npm run dev`，在 resolver 接入后人工验证：

- 正常视频 metadata 加载；
- thumbnail 生成；
- 视频转换；
- Progress；
- success 和 final path。

结果：通过。

这是开发态人工回归；此时 FFmpeg / ffprobe 仍由系统 `PATH` 提供。开发态 resolver 返回 `ffmpeg` 和 `ffprobe`，packaged resolver 则预留 `process.resourcesPath/ffmpeg/` 路径。

### T49 FFmpeg Essentials 下载完整性与来源校验

开发者对 FFmpeg 9.0.2 Gyan `essentials_build-www.gyan.dev` Windows x64 ZIP 执行 SHA256 校验。

结果：通过。

```text
60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA
```

该 hash 与官方提供的 checksum 一致。报告不记录开发者本地 Backup 下载路径作为项目依赖路径。

### T50 Bundled FFmpeg Binary 能力核验

开发者实际执行 `ffmpeg.exe -version` 和 `ffprobe.exe -version`，确认版本为 `9.0.2-essentials_build-www.gyan.dev`，并验证以下编码能力：

- `libx264`；
- `libvpx-vp9`；
- AAC；
- `libopus`。

实际 binary 大小：

```text
ffmpeg.exe   105423872 bytes
ffprobe.exe  105221120 bytes
```

实际包内发现 `LICENSE` 和 `README.txt`。其中 `README.txt` 记录 License: GPL v3 以及 source revision：

```text
https://github.com/FFmpeg/FFmpeg/commit/946fcce07b
```

结果：通过。

### T51 Git Binary 排除与 Packaging 资源配置

这是静态 / Git 配置检查，不是运行时测试。

开发者通过 `git check-ignore` 确认：

```text
resources/ffmpeg/ffmpeg.exe
resources/ffmpeg/ffprobe.exe
```

均被以下规则忽略：

```text
resources/ffmpeg/*.exe
```

license 文件没有被 ignore。

同时确认 electron-builder 配置包含：

```yaml
files:
  - '!resources/ffmpeg/**'

extraResources:
  - from: resources/ffmpeg
    to: ffmpeg
```

目标是避免 binary 同时进入 app files / ASAR 和 extraResources。

结果：通过。

### T52 Windows Unpacked Build 与资源完整性

开发者执行：

```text
npm run build:unpack
```

结果：通过。

实际输出：

```text
dist/win-unpacked/
dist/win-unpacked/desktop-video-converter.exe
```

确认 packaged resources：

```text
dist/win-unpacked/resources/ffmpeg/ffmpeg.exe
dist/win-unpacked/resources/ffmpeg/ffprobe.exe
dist/win-unpacked/resources/ffmpeg/licenses/LICENSE
dist/win-unpacked/resources/ffmpeg/licenses/README.txt
```

其中：

```text
ffmpeg.exe：105423872 bytes
SHA256：3256173F3F8BFFD7DF12227C68ADF68025EDB1832273A9530688A7BB1ED8EDEC

ffprobe.exe：105221120 bytes
SHA256：F0D36ECBBDD3BCFAC3EFA078C96C7271C2E68B3810595552AC3B7F17E9A65C52
```

检查整个 unpacked 输出后，没有发现第二份 `ffmpeg.exe` / `ffprobe.exe`，即没有 duplicate bundled FFmpeg binary。

### T53 Packaged App PATH 隔离运行测试

开发者新建 PowerShell 会话，将当前进程的 `PATH` 临时限制为 Windows 系统目录。随后确认：

```text
where.exe ffmpeg
where.exe ffprobe
```

均无法找到系统 FFmpeg。

在该环境中启动：

```text
dist/win-unpacked/desktop-video-converter.exe
```

人工验证结果：

- metadata 正常；
- thumbnail 正常；
- conversion 正常；
- Progress 正常；
- final output 正常。

结果：通过。

结论保持严谨：在系统 PATH 无法提供 FFmpeg / ffprobe 的条件下，packaged app 仍能正常完成媒体处理流程，与 bundled resolver 路径设计一致。

### T54 Windows NSIS Installer 构建

开发者执行：

```text
npm run build:win
```

其中 `npm run build`、typecheck 和 electron-vite build 均成功。electron-builder 成功生成：

```text
dist/desktop-video-converter-1.0.0-setup.exe
```

安装包大小：

```text
149944621 bytes
```

配置和目标为：

- Windows x64；
- NSIS；
- `oneClick=true`；
- `perMachine=false`。

结果：通过。

### T55 Authenticode 状态检查

开发者对以下文件执行 `Get-AuthenticodeSignature`：

```text
dist/desktop-video-converter-1.0.0-setup.exe
```

实际结果：

```text
Status: NotSigned
```

结果：状态检查完成，安装包当前未进行 Authenticode 代码签名。该结果是已确认的交付状态，不作为功能失败。electron-builder 日志中的 `signing with signtool.exe` 不被解释为最终文件已签名。

### T56 实际安装版人工验收

开发者实际操作：

1. 双击 NSIS installer；
2. 正常完成安装；
3. 从桌面快捷方式启动 Desktop Video Converter；
4. 加载视频；
5. 验证 metadata；
6. 验证 thumbnail；
7. 验证 conversion；
8. 验证 Progress；
9. 验证 final output。

结果：通过。

测试对象是实际安装后的应用，不是 `npm run dev`，也不是 `dist/win-unpacked`；这是最终 Windows 安装版人工验收。

## 2. 自动检查

以下为各阶段实际执行的自动检查与构建命令；本次文档更新本身没有重新执行代码检查：

这些命令在多个开发阶段重复执行并通过：

- Main / Preload TypeScript typecheck：通过
- Renderer TypeScript typecheck：通过
- ESLint：通过
- electron-vite build：通过

Phase 3 中另外执行并通过：

- `npm run build:unpack`；
- `npm run build:win`。

这些结果属于自动检查，不等同于开发者人工 UI 测试。

## 3. 当前未测试 / 后续测试

以下项目在本轮没有被记录为已完成测试：

- Authenticode code signing；
- Windows clean-machine / 第二台完全干净设备测试；
- macOS 安装测试；
- Linux 安装测试；
- 更大规模或长时长压力测试；
- 网络盘、非 NTFS 环境下 hard-link 兼容性；
- 其他未覆盖的跨平台安装场景。

批量转换不属于当前产品范围，不作为本阶段测试目标。

README 和 5 张应用截图属于交付材料，不作为运行时测试编号；截图来自实际应用运行流程。
