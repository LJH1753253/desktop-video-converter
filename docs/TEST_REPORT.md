# 测试报告

本文记录项目截至“基础视频格式转换”里程碑结束时已经真实执行的人工测试和自动检查。

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

## 2. 自动检查

以下为 Codex 在本轮自动/代理环境中执行的检查：

- Main / Preload TypeScript typecheck：通过
- Renderer TypeScript typecheck：通过
- ESLint：通过
- electron-vite build：通过

这些结果属于自动检查，不等同于开发者人工 UI 测试。

## 3. 当前未测试 / 后续测试

- FFmpeg 缩略图生成失败时的实际降级行为
- 中文路径下的视频转换
- FFmpeg 真正失败时的转换错误 UI
- 转换过程中取消
- 转换百分比 Progress
- 已有的非输入目标文件覆盖
- 输出扩展名不匹配
- 最终安装包
- FFmpeg 随应用分发
- 大文件 / 长视频转换
- 批量转换
