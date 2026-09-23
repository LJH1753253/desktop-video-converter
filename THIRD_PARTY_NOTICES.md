# Third-Party Notices

## FFmpeg

- 版本：9.0.2
- Build：essentials_build-www.gyan.dev
- 平台：Windows x64
- Archive SHA256：`60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA`
- 用途：本应用通过独立的 FFmpeg CLI 和 ffprobe CLI 进程进行视频转码、缩略图生成和媒体信息读取。
- 许可证标识：该分发 binary 标记为 GPLv3。
- 调用方式：Electron Main Process 通过 Node.js `child_process.spawn` 调用 CLI；本 Electron 应用不直接链接 FFmpeg 的 libav API。

本地打包资源：

- `ffmpeg.exe`：105423872 bytes；
- `ffprobe.exe`：105221120 bytes；
- 运行时能力已人工验证：`libx264`、`libvpx-vp9`、AAC、`libopus`。

相关页面：

- FFmpeg project homepage：<https://ffmpeg.org/>
- FFmpeg license information：<https://ffmpeg.org/legal.html>
- Gyan build source page：<https://www.gyan.dev/ffmpeg/builds/>
- Source revision：<https://github.com/FFmpeg/FFmpeg/commit/946fcce07b>

随实际下载包发现的文件已保存为：

- `resources/ffmpeg/licenses/LICENSE`；
- `resources/ffmpeg/licenses/README.txt`。

对应 source revision 来自随 Gyan 9.0.2 essentials 包提供的 `README.txt`。

本声明仅记录当前选择的第三方软件和来源信息，不构成法律意见，也不对项目的最终许可证义务作结论。
