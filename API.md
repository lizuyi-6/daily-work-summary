# API 参考文档

## GitHubDataSource

获取 GitHub commits 数据。

### 构造函数

```javascript
const github = new GitHubDataSource({
  username: 'github-username',
  repositories: [
    { name: 'repo1', path: '/path/to/repo1', remote: 'owner/repo1' }
  ]
});
```

### 方法

#### `getTodayCommits(date)`

获取指定日期的 commits。

**参数：**
- `date` (Date): 日期对象

**返回：**
```javascript
{
  date: '2024-03-12',
  totalCommits: 5,
  repositories: [
    {
      name: 'repo1',
      commits: [
        { sha: 'abc1234', message: '...', author: '...', date: '...' }
      ],
      stats: { additions: 100, deletions: 20, filesChanged: 5 }
    }
  ],
  stats: { additions: 100, deletions: 20, filesChanged: 5 }
}
```

## FeishuDataSource

获取飞书日程数据。

### 构造函数

```javascript
const feishu = new FeishuDataSource({
  appId: 'cli_xxx',
  appSecret: 'secret',
  userId: 'ou_xxx'
});
```

### 方法

#### `getTodayEvents(date)`

获取指定日期的日程。

**返回：**
```javascript
{
  date: '2024-03-12',
  events: [
    {
      id: 'event-id',
      summary: '会议标题',
      start: '2024-03-12T10:00:00+08:00',
      end: '2024-03-12T11:00:00+08:00',
      duration: 60,
      location: '会议室',
      attendees: ['张三', '李四']
    }
  ],
  analysis: {
    totalMinutes: 120,
    byCategory: {
      meeting: { label: '会议', minutes: 60, events: [] },
      coding: { label: '开发', minutes: 0, events: [] }
    }
  }
}
```

## ReportGenerator

生成 Markdown 格式报告。

### 构造函数

```javascript
const generator = new ReportGenerator({
  title: '📋 每日工作摘要',
  includeCodeStats: true,
  includeTimeAnalysis: true,
  timezone: 'Asia/Shanghai'
});
```

### 方法

#### `generate(data)`

生成报告。

**参数：**
- `data` (Object): 包含 github, calendar, projects 的数据对象

**返回：**
- `string`: Markdown 格式报告

#### `saveToFile(report, date)`

保存报告到文件。

## FeishuPusher

推送报告到飞书。

### 构造函数

```javascript
const pusher = new FeishuPusher({
  webhookUrl: 'https://...',  // 方式一：Webhook
  // 或
  appId: 'cli_xxx',           // 方式二：API
  appSecret: 'secret',
  userId: 'ou_xxx'
});
```

### 方法

#### `push(report)`

推送报告。

**参数：**
- `report` (string): Markdown 格式报告

## ConfigManager

配置管理工具。

### 静态方法

#### `load()`

从文件加载配置。

**返回：**
- `Promise<Object>`: 配置对象

#### `getDefaultConfig()`

获取默认配置。

## Logger

日志工具。

### 方法

- `info(...args)`: 信息日志
- `warn(...args)`: 警告日志
- `error(...args)`: 错误日志
- `success(...args)`: 成功日志
