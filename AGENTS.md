\# 项目目标



开发一个面向普通用户的桌面视频格式转换器，用于三天限时 AI 工程能力笔试。



项目必须是实际的桌面客户端，而不是普通 Web 页面。



主技术栈固定为：



\- Electron

\- React

\- TypeScript

\- Vite

\- Node.js

\- FFmpeg / ffprobe



除非开发者明确要求，否则不要修改主技术栈。



\# 当前开发策略



项目必须分阶段增量开发。



不要一次性实现整个应用。



每个开发阶段必须：



1\. 只实现当前明确要求的功能范围；

2\. 执行相关类型检查、测试和构建；

3\. 总结本次修改内容；

4\. 停止并等待开发者人工检查；

5\. 未经开发者确认，不进入下一阶段。



\# 架构约束



项目采用：



Renderer

→ Preload

→ IPC

→ Electron Main Process

→ FFmpeg / ffprobe / 文件系统



要求：



\- `nodeIntegration` 必须保持关闭；

\- `contextIsolation` 必须保持开启；

\- Renderer 不得直接访问 Node.js API，例如：

&#x20; - `fs`

&#x20; - `child\_process`

\- 本地系统能力必须通过受控的 Preload API 和 IPC 暴露。



\# FFmpeg 调用规范



FFmpeg 和 ffprobe 必须由 Electron Main Process 调用。



调用外部进程时：



\- 优先使用 `child\_process.spawn()` 或 `execFile()`；

\- 参数必须以参数数组形式传入；

\- 不要通过字符串拼接用户提供的文件路径来构造 shell 命令；

\- 必须支持 Windows 路径中的空格和中文字符。



\# 产品原则



项目面向普通用户，而不是 FFmpeg 专家。



主界面应保持简单、清晰、易理解。



除非开发者明确要求，否则不要在主界面暴露大量复杂编码参数。



\# 工程规范



每次有实质性代码修改后：



\- 执行 TypeScript 类型检查；

\- 执行相关测试；

\- 执行构建；

\- 修复错误后再声明当前任务完成。



不要为了快速通过检查而随意使用：



\- `any`

\- `@ts-ignore`

\- 空 catch



除非确实有必要，并且必须说明原因。



Codex 不得声称人工 UI 测试已经通过。



人工产品测试由开发者本人完成。



\# 功能范围控制



除非开发者明确要求，目前不要加入：



\- 云服务

\- 数据库

\- 用户账号

\- AI 功能

\- 视频编辑

\- 字幕编辑

\- 批量转换

\- GPU 加速

\- 数据分析

\- 后端服务器



\# 文档要求



后续需要维护：



\- `docs/SESSION\_SUMMARY.md`

\- `docs/TEST\_REPORT.md`



需要记录：



\- 开发者决策

\- AI 建议

\- 开发者反馈

\- 实际测试发现的问题

\- 修复过程



不得编造没有真实发生过的：



\- 开发决策

\- Bug

\- 测试结果



\# Git 约束



除非开发者明确要求，否则 Codex 不得：



\- 创建 Git commit

\- push 到 GitHub



正常 Git 提交和 GitHub push 由开发者本人执行。



# 依赖与环境变更权限

Codex 不得自行修改开发环境、核心依赖版本或工具链。

除非开发者明确批准，否则禁止：

- 升级或降级 Electron；
- 升级或降级 Node.js、npm；
- 升级或降级 React、Vite、TypeScript 等核心依赖；
- 执行 `npm audit fix`；
- 执行 `npm audit fix --force`；
- 因安全告警自动升级依赖；
- 更换包管理器；
- 删除或重新生成 lockfile；
- 安装新的系统级软件；
- 修改系统 PATH 或环境变量；
- 修改 Git 全局配置。

如果发现：

- npm audit 告警；
- deprecated package；
- peer dependency warning；
- version mismatch；
- 安全漏洞；
- 模板版本较旧；

必须先：

1. 停止相关修改；
2. 向开发者报告问题；
3. 说明严重程度；
4. 说明是否影响当前功能；
5. 给出可选处理方案；
6. 等待开发者明确批准。

不得因为“更安全”“更新”“最佳实践”等理由自行执行版本升级。

项目首次初始化完成后，如果需要新增 npm package，
必须先说明：

- 包名；
- 用途；
- 是否必须；
- 是否会修改 package.json / package-lock.json；

得到开发者批准后才能安装。

