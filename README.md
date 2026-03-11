# 每日工作智能摘要工具

自动整合 GitHub commits、飞书日程、项目进度等数据，生成结构化日报并推送到飞书。

## 功能特性

- 📊 多数据源整合（GitHub、飞书日历、项目进度）
- 📝 自动生成 Markdown 格式日报
- 🕐 智能时间分配分析
- 📅 明日待办建议
- 🚀 一键推送到飞书
- ⚙️ 灵活的配置管理

## 快速开始

### 1. 安装依赖

```bash
cd daily-work-summary
npm install
```

### 2. 初始化配置

```bash
npm run config
```

或手动编辑 `config/config.json` 文件。

### 3. 运行日报生成

```bash
npm start
```

## 配置文件说明

见 `config/config.example.json` 中的详细注释。

## 数据源说明

### GitHub Commits
- 使用 `gh` CLI 工具获取
- 支持多仓库配置
- 自动按项目分类

### 飞书日程
- 通过飞书 API 获取当日日程
- 分析时间分配
- 提取会议和待办事项

### 项目进度
- 支持本地项目跟踪
- 可关联 GitHub issues/PRs
- 自定义进度指标

## 输出示例

日报包含以下部分：
1. 今日概览 - 关键指标总结
2. 完成事项 - 按项目分类的 commits
3. 日程回顾 - 飞书日程时间分析
4. 明日计划 - 待办事项和建议
5. 统计图表 - 代码变更统计

## License

MIT
