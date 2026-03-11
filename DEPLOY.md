# 部署与使用指南

## 📁 项目结构

```
daily-work-summary/
├── src/
│   ├── index.js                 # 入口文件
│   ├── datasource/
│   │   ├── github.js            # GitHub 数据源
│   │   └── feishu.js            # 飞书日程数据源
│   ├── generator/
│   │   └── report.js            # 报告生成器
│   ├── pusher/
│   │   └── feishu.js            # 飞书推送器
│   └── utils/
│       ├── config.js            # 配置管理
│       └── logger.js            # 日志工具
├── config/
│   ├── config.example.json      # 配置示例
│   └── config.json              # 实际配置文件 (gitignored)
├── scripts/
│   └── init-config.js           # 配置初始化脚本
├── test/
│   └── test.js                  # 测试脚本
├── reports/                     # 生成的报告存储目录
├── package.json
├── README.md
└── DEPLOY.md                    # 本文件
```

## 🚀 快速部署

### 1. 克隆/复制项目

```bash
cd /path/to/your/workspace
cp -r daily-work-summary ~/tools/daily-work-summary
cd ~/tools/daily-work-summary
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 GitHub 访问

确保已安装 GitHub CLI 并登录：

```bash
# 安装 gh (如未安装)
# macOS: brew install gh
# Ubuntu: sudo apt install gh
# 其他: https://github.com/cli/cli#installation

# 登录 GitHub
gh auth login
```

### 4. 配置数据源

#### 方式一：交互式配置（推荐）

```bash
npm run config
```

按提示输入：
- GitHub 用户名
- 要监控的仓库路径
- 飞书 Webhook URL（可选）
- 报告偏好设置

#### 方式二：手动配置

复制示例配置文件：

```bash
cp config/config.example.json config/config.json
```

编辑 `config/config.json`：

```json
{
  "github": {
    "username": "你的GitHub用户名",
    "repositories": [
      {
        "name": "项目显示名称",
        "path": "/本地/项目/路径",
        "remote": "owner/repo"
      }
    ]
  },
  "feishu": {
    "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"
  },
  "report": {
    "title": "📋 每日工作摘要"
  }
}
```

### 5. 测试运行

```bash
npm start
```

## 📅 设置定时任务

### Linux/macOS - Crontab

每天 18:30 自动生成日报：

```bash
# 编辑 crontab
crontab -e

# 添加以下行
30 18 * * * cd /path/to/daily-work-summary && /usr/bin/node src/index.js >> /var/log/daily-summary.log 2>&1
```

常用定时配置：

| 时间 | Cron 表达式 | 说明 |
|------|------------|------|
| 每天 18:00 | `0 18 * * *` | 下班前 |
| 每天 18:30 | `30 18 * * *` | 下班前 |
| 每周五 17:00 | `0 17 * * 5` | 周五周报 |
| 每小时 | `0 * * * *` | 每小时（调试用）|

### Windows - 任务计划程序

1. 打开任务计划程序
2. 创建基本任务
3. 设置触发器：每天 18:30
4. 设置操作：
   - 程序：`node.exe`
   - 参数：`src/index.js`
   - 起始于：`C:\path\to\daily-work-summary`

### Docker 方式（可选）

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
VOLUME ["/app/config", "/app/reports"]

CMD ["node", "src/index.js"]
```

构建和运行：

```bash
docker build -t daily-summary .
docker run -v $(pwd)/config:/app/config -v $(pwd)/reports:/app/reports daily-summary
```

## 🔧 飞书机器人配置

### 方式一：Webhook 机器人（简单）

1. 在飞书群聊中，点击「设置」→「群机器人」→「添加机器人」
2. 选择「自定义机器人」
3. 复制 Webhook URL
4. 粘贴到 `config.json` 的 `feishu.webhookUrl`

### 方式二：自建应用（高级）

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 开启「消息」和「日历」权限
5. 将应用添加到需要接收消息的群组
6. 配置到 `config.json`

## 📝 环境变量配置

支持通过环境变量覆盖配置：

```bash
export GITHUB_USERNAME="your-username"
export FEISHU_WEBHOOK_URL="https://..."
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"

npm start
```

## 🔍 故障排查

### 问题：无法获取 GitHub commits

**检查清单：**
1. `gh --version` 确认 gh CLI 已安装
2. `gh auth status` 确认已登录
3. 检查仓库路径是否正确
4. 检查 Git 仓库是否有今日提交

### 问题：飞书推送失败

**检查清单：**
1. Webhook URL 是否正确
2. 机器人是否已添加到群聊
3. 网络是否可访问飞书 API

### 问题：时区不正确

修改 `config.json`：

```json
{
  "report": {
    "timezone": "Asia/Shanghai"
  }
}
```

支持的时区列表：https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## 🔄 更新与维护

### 更新工具

```bash
git pull origin main
npm install
```

### 查看日志

```bash
# 如果是通过 crontab 运行
tail -f /var/log/daily-summary.log

# 或直接运行查看输出
npm start
```

### 手动生成历史日报

修改 `src/index.js` 中的日期：

```javascript
// 改为过去日期
const today = new Date('2024-03-01');
```

## 🛡️ 隐私与安全

- `config/config.json` 已添加到 `.gitignore`，不会被提交
- 敏感信息（App Secret 等）建议通过环境变量传入
- Webhook URL 等同于密码，请勿泄露

## 📊 扩展开发

### 添加新数据源

1. 在 `src/datasource/` 创建新文件
2. 实现 `getData(date)` 方法
3. 在 `src/index.js` 中引入和使用

### 自定义报告模板

修改 `src/generator/report.js` 中的生成逻辑。

## 💡 最佳实践

1. **首次使用**：先运行 `npm start` 确认配置正确
2. **定时任务**：建议设置在工作日，避免周末打扰
3. **备份配置**：定期备份 `config/config.json`
4. **监控日志**：定期检查日志确保运行正常
