# UITab Local Clone

本项目是一个本地自用的浏览器新标签页插件（Manifest V3），目标是复刻 `uitab` 的核心效率体验，并保持轻量、可维护、可扩展。

## 已实现功能

- 新标签页替换（`chrome_url_overrides.newtab`）
- 搜索框 + 搜索引擎切换（Google / Bing / DuckDuckGo / Baidu / 自定义）
- 快捷网站卡片（新增、编辑、删除、拖拽排序）
- 主题与背景（浅色/深色/跟随系统 + 背景预设 + 自动轮换）
- 设置面板（布局、显示、搜索、组件、数据管理）
- 小组件
  - 时钟（支持 24 小时制）
  - 天气（Open-Meteo，无需 API Key）
  - 待办（新增、完成、删除）
- 数据持久化（`chrome.storage.local`，开发环境自动降级到 `localStorage`）
- 配置导入/导出（JSON）
- 快捷键
  - `/` 聚焦搜索
  - `Ctrl + ,` 打开设置
  - `Alt + 1..9` 打开第 N 个快捷网站

## 使用方式（Chrome / Edge）

1. 打开浏览器扩展管理页：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目根目录：`D:\1A-workspace\projects\Browser plugin`
5. 新开一个标签页，即可看到插件界面。

## 项目结构

```text
Browser plugin/
  manifest.json
  newtab.html
  styles/
    newtab.css
  src/
    defaults.js
    newtab.js
    storage.js
    utils.js
  UITab-复刻计划书.md
```

## 配置与升级

- 配置存储键：`uitab_local_clone_config`
- 配置有版本号与迁移逻辑（`src/defaults.js`）
- 升级时通过 `migrateConfig` 保证兼容旧数据结构

## 后续建议

- 增加可插拔 Widget Registry
- 增加站点图标本地缓存
- 加入更多背景来源（本地图包/每日图片）
- 增加单元测试（迁移、URL 校验、搜索模板）
