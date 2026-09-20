# Tauri React 模板

一个“开箱即用”的模板，用于使用 **Tauri v2**、**React** 和 **TypeScript** 构建可直接投入生产的桌面应用。采用带有明确主张的架构模式，帮助人类开发者和 AI 编码代理从一开始就构建结构良好的应用。

## 为什么选择这个模板？

大多数 Tauri 启动模板只给你一块空白画布，而这个模板直接提供了一个**可运行的应用**，并且已经建立好一套成熟的模式：

- 通过 tauri-specta 实现 **Rust ↔ TypeScript 的类型安全桥接**
- **通过工具强制执行性能模式** —— 常规 lint 之外，还使用 ast-grep 检测常见反模式
- **多窗口架构** 已经实现（示例：带全局快捷键的快速面板）
- **跨平台就绪**，包含平台特有的标题栏、窗口控件和原生菜单集成
- **内置 i18n**，支持 RTL（从右到左）布局

## 技术栈

| 层级     | 技术                                            |
| -------- | ----------------------------------------------- |
| 前端     | React 19, TypeScript, Vite 7                    |
| UI       | shadcn/ui v4, Tailwind CSS v4, Lucide React     |
| 状态管理 | Zustand v5, TanStack Query v5                   |
| 后端     | Tauri v2, Rust                                  |
| 测试     | Vitest v4, Testing Library                      |
| 质量保障 | ESLint, Prettier, ast-grep, knip, jscpd, clippy |

## 已实现内容

该模板包含一个已经实现以下功能的完整应用：

### 核心功能

- **命令面板**（`Cmd+K`）—— 可搜索的命令启动器，支持键盘导航
- **快速面板** —— 全局快捷键（`Cmd+Shift+.`），可在任意应用中（包括全屏）弹出悬浮窗口；在 macOS 上使用原生 NSPanel，保证全屏覆盖行为正确
- **键盘快捷键** —— 平台感知的快捷键，并自动集成到菜单中
- **原生菜单** —— 使用 JavaScript 构建的“文件 / 编辑 / 视图”菜单，完整支持 i18n
- **偏好设置系统** —— 设置对话框，Rust 侧持久化，React Hooks 接口，全程类型安全
- **可折叠侧边栏** —— 左右侧边栏已预留，支持可调整面板并持久化状态
- **主题系统** —— 浅色 / 深色模式，支持系统偏好检测，并在多窗口间同步
- **通知系统** —— 应用内 Toast 通知 + 原生系统通知
- **自动更新** —— 已配置 Tauri 更新插件，集成 GitHub Releases，并在启动时检查更新
- **日志系统** —— Rust 与 TypeScript 通用的结构化日志工具，格式统一
- **崩溃恢复** —— 异常退出后用于恢复未保存工作的紧急数据持久化机制

### 架构模式

- **三层状态管理** —— 清晰的决策路径：`useState`（组件内）→ `Zustand`（全局 UI）→ `TanStack Query`（应用“不拥有”的持久化数据）
- **事件驱动的 Rust-React 桥接** —— 菜单、快捷键和命令面板统一走同一套命令系统
- **React Compiler** —— 自动记忆化，无需手动使用 `useMemo` / `useCallback`

### 跨平台支持

| 平台    | 标题栏              | 窗口控件   | 打包格式    |
| ------- | ------------------- | ---------- | ----------- |
| macOS   | 自定义 + 毛玻璃效果 | 红绿灯按钮 | `.dmg`      |
| Windows | 自定义              | 右侧       | `.msi`      |
| Linux   | 原生 + 工具栏       | 原生       | `.AppImage` |

平台检测工具、平台特有的 UI 文案（如 “Reveal in Finder” vs “Show in Explorer”），以及每个平台独立的 Tauri 配置都已设置完成。

### 开发体验

- **类型安全的 Tauri 命令** —— tauri-specta 从 Rust 生成 TypeScript 绑定，具备完整自动补全和编译期检查
- **静态分析** —— ESLint、Prettier、ast-grep（架构约束）、knip（未使用代码）、jscpd（重复代码）
- **统一质量关卡** —— `npm run check:all` 一次运行 TypeScript、ESLint、Prettier、ast-grep、clippy 和全部测试
- **测试模式** —— 基于 Vitest，并支持 Tauri 命令的 mock

## 已集成的 Tauri 插件

| 插件名            | 用途                        |
| ----------------- | --------------------------- |
| single-instance   | 防止多实例运行              |
| window-state      | 记住窗口位置和大小          |
| fs                | 文件系统访问                |
| dialog            | 原生打开 / 保存对话框       |
| notification      | 系统通知                    |
| clipboard-manager | 剪贴板访问                  |
| global-shortcut   | 全局键盘快捷键              |
| updater           | 应用内自动更新              |
| opener            | 使用默认应用打开 URL / 文件 |
| tauri-nspanel     | macOS 悬浮面板行为          |

## 面向 AI 的开发设计

该模板专为与 Claude Code 等 AI 编码代理高效协作而设计：

- **完整文档** 位于 `docs/developer/`，覆盖所有模式，重点解释“为什么这么做”，不是废话
- **Claude Code 集成** —— 自定义命令（`/check`、`/cleanup`）以及一些专用代理
- **合理的文件结构** —— React 代码在 `src/`，按 components / hooks / stores / services 清晰拆分；Rust 代码在 `src-tauri/src/`，命令模块化组织。结构对人和 AI 都可预测

## 快速开始

请查看 **[Using This Template](docs/USING_THIS_TEMPLATE.md)** 获取安装说明和工作流指南。

### Quick Start

```bash
# 前置条件：Node.js 18+，Rust（最新稳定版）
# 平台相关依赖见 https://tauri.app/start/prerequisites/

git clone <your-repo>
cd your-app
npm install
npm run dev
```

## 文档

- **[开发者文档](docs/developer/)** —— 架构、模式和详细指南
- **[用户指南](docs/userguide/)** —— 面向最终用户的文档模板
- **[使用本模板](docs/USING_THIS_TEMPLATE.md)** —— 安装与工作流说明

## 许可证

[MIT](LICENSE.md)

---

基于 [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) 构建

## 出处

来源：[tauri-template](https://github.com/dannysmith/tauri-template)
已关注，据说会增加drag and drop功能：[tauri-template](https://github.com/elibroftw/modern-desktop-app-template)
