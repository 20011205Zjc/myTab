# UITab 浏览器插件复刻计划书（本地自用版）

## 1. 项目目标

- 目标：开发一个仅本地自用的浏览器插件，核心体验尽量接近 `uitab`，重点复刻新标签页效率工作台能力。
- 成果形态：可在 Chromium 内核浏览器（Chrome / Edge）以“开发者模式”加载使用。
- 使用边界：仅个人本地使用，不对外分发，不上架商店。

## 2. 约束与原则

- 本地优先：数据默认存储在本机（`chrome.storage.local` / IndexedDB），不依赖云端。
- 隐私优先：不采集、不上传任何用户数据。
- 高可维护：采用模块化架构，功能按组件拆分，方便后续迭代。
- 可替换设计：UI 风格可主题化，支持逐步贴近 `uitab` 视觉与交互。
- 合规原则：避免直接复制对方受保护素材（图标、插画、文案、品牌元素），采用自制或开源替代资源。

## 3. 复刻范围定义（MVP -> 完整版）

## 3.1 MVP（第一阶段必须完成）

- 新标签页替换（`chrome_url_overrides.newtab`）。
- 顶部搜索框（支持多搜索引擎切换，默认 1 个即可）。
- 快捷网站卡片（增删改、拖拽排序、打开链接）。
- 背景与主题（至少支持浅色/深色、1 套背景图）。
- 本地配置持久化（刷新后状态不丢失）。
- 设置面板（基础项：搜索引擎、是否显示时间、主题模式）。

## 3.2 第二阶段（增强体验）

- 小组件系统：时钟、天气（可选，需 API Key）、待办。
- 快捷键支持：聚焦搜索框、打开设置面板等。
- 多布局模式：紧凑/宽松、卡片网格列数调整。
- 导入导出：JSON 备份恢复。
- 背景自动切换：定时或随机切换本地背景。

## 3.3 第三阶段（高级能力）

- 可插拔组件框架（Widget Registry）。
- 数据版本迁移机制（schema version + migration）。
- 性能优化（首屏懒加载、组件按需渲染）。
- 离线缓存优化（静态资源缓存策略）。

## 4. 技术方案

## 4.1 技术栈建议

- 插件规范：Manifest V3。
- 前端：`TypeScript + React + Vite`（或 `Vue + Vite`，二选一，建议 React）。
- 状态管理：轻量方案（Zustand / Pinia / Context）。
- 样式：CSS Variables + 模块化样式（或 Tailwind，按团队偏好）。
- 拖拽：`dnd-kit`（React）或同类库。
- 数据校验：`zod`（保证配置结构稳定）。

## 4.2 目录结构（建议）

```text
browser-plugin/
  manifest.json
  public/
    icons/
    backgrounds/
  src/
    newtab/
      App.tsx
      pages/
      components/
      widgets/
      styles/
    options/
      index.html
      OptionsApp.tsx
    shared/
      storage/
      config/
      types/
      utils/
      constants/
    background/
      service-worker.ts
  scripts/
    pack.ps1
  docs/
    plan.md
    changelog.md
```

## 4.3 核心模块拆分

- `NewTab Shell`：页面骨架、布局、主题注入。
- `Search Module`：搜索引擎配置、关键词拼接、回车跳转。
- `Quick Links Module`：站点卡片 CRUD、拖拽排序、图标回退策略。
- `Widget Module`：时钟/天气/待办等可插拔组件。
- `Settings Module`：用户偏好设置与配置表单。
- `Storage Module`：统一读写接口、默认配置、迁移能力。
- `Theme Module`：主题变量、背景策略、动态切换。

## 5. 数据模型设计（示例）

```ts
interface AppConfig {
  version: number;
  theme: {
    mode: 'light' | 'dark' | 'auto';
    backgroundType: 'image' | 'solid';
    backgroundValue: string;
  };
  search: {
    engine: 'google' | 'bing' | 'baidu' | 'custom';
    customUrlTemplate?: string;
  };
  quickLinks: Array<{
    id: string;
    title: string;
    url: string;
    icon?: string;
    order: number;
  }>;
  widgets: {
    clock: { enabled: boolean; format24h: boolean };
    weather: { enabled: boolean; city?: string; unit: 'C' | 'F' };
    todo: { enabled: boolean };
  };
}
```

## 6. 迭代排期（4 周示例）

## 第 1 周：框架与基础能力

- 初始化工程（MV3 + Vite + TS）。
- 搭建 `newtab` 页面路由与基础布局。
- 封装 `storage` 层与默认配置加载。
- 完成主题切换与基础设置面板。

交付标准：可替换新标签页、可保存和读取基本配置。

## 第 2 周：核心交互

- 实现搜索模块（至少 1 个引擎 + 可扩展配置）。
- 实现快捷网站卡片（增删改查、拖拽排序）。
- 完成首版 UI 样式贴近与响应式适配。

交付标准：MVP 核心体验可日常使用。

## 第 3 周：增强功能

- 加入时钟、待办小组件。
- 增加导入导出能力。
- 增加快捷键与交互细节（空状态、提示、错误处理）。

交付标准：功能完整度达到 80%+。

## 第 4 周：稳定性与打磨

- 性能优化（渲染拆分、资源压缩）。
- 数据迁移与异常恢复策略。
- 编写使用文档、备份说明、已知问题列表。

交付标准：本地长期可用，升级不丢数据。

## 7. 验收标准（Definition of Done）

- 新开标签页加载时间在可接受范围（目标 < 1.5s，冷启动）。
- 快捷卡片 50 条以内操作流畅，无明显卡顿。
- 设置变更后可立即生效并持久化。
- 关闭浏览器重开后，配置与数据一致。
- 异常数据（损坏 JSON）可自动回退默认配置并提示。

## 8. 测试计划

- 单元测试：配置解析、URL 校验、数据迁移函数。
- 组件测试：卡片 CRUD、拖拽排序、设置面板表单。
- 手工回归：
  - 新安装初次启动。
  - 导入旧版本配置。
  - 清空配置后恢复。
  - 无网环境下打开新标签页。
- 兼容测试：Chrome 最新稳定版、Edge 最新稳定版。

## 9. 风险与应对

- UI 相似度风险：原插件细节较多，先保证功能一致，再做视觉逐步逼近。
- 第三方 API 风险：天气等依赖外部服务，做“可关闭 + 超时回退”。
- 数据膨胀风险：长期使用数据变多，增加上限策略和清理机制。
- 版本升级风险：严格执行 `version + migration`，避免结构变更导致数据丢失。

## 10. 交付物清单

- 可运行插件源码（MV3）。
- 本地加载说明（README，含截图）。
- 配置结构文档（字段说明 + 示例）。
- 变更日志（版本号 + 功能点 + 迁移说明）。

## 11. 后续可选扩展

- 跨设备同步（可选接入浏览器同步存储）。
- 多套视觉主题市场（本地主题包）。
- 数据统计面板（打开频次、效率分析，本地计算）。
- AI 快捷命令入口（本地配置，不上传私密数据）。

## 12. 执行建议（从今天开始）

- 第一步：先做 MVP，不要一开始追求 100% 视觉复刻。
- 第二步：建立“功能对照清单”，每完成一项就打勾。
- 第三步：每周固定一次备份配置，防止开发阶段误操作。

---

如需，我可以在下一步直接为你生成该插件的初始项目骨架（`manifest.json + newtab 页面 + 快捷卡片基础功能`）。
