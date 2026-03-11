/**
 * 配置管理器
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ConfigManager {
  static async load() {
    const configPaths = [
      join(process.cwd(), 'config', 'config.json'),
      join(process.cwd(), 'config.json'),
    ];

    for (const path of configPaths) {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        const config = JSON.parse(content);
        
        // 合并环境变量
        return ConfigManager.mergeEnvVars(config);
      }
    }

    // 返回默认配置
    return ConfigManager.getDefaultConfig();
  }

  /**
   * 合并环境变量到配置
   */
  static mergeEnvVars(config) {
    return {
      ...config,
      github: {
        ...config.github,
        username: process.env.GITHUB_USERNAME || config.github?.username || '',
        token: process.env.GITHUB_TOKEN || config.github?.token || ''
      },
      gitlab: {
        ...config.gitlab,
        username: process.env.GITLAB_USERNAME || config.gitlab?.username || '',
        token: process.env.GITLAB_TOKEN || config.gitlab?.token || ''
      },
      feishu: {
        ...config.feishu,
        appId: process.env.FEISHU_APP_ID || config.feishu?.appId || '',
        appSecret: process.env.FEISHU_APP_SECRET || config.feishu?.appSecret || '',
        webhookUrl: process.env.FEISHU_WEBHOOK_URL || config.feishu?.webhookUrl || '',
        userId: process.env.FEISHU_USER_ID || config.feishu?.userId || '',
        chatId: process.env.FEISHU_CHAT_ID || config.feishu?.chatId || ''
      }
    };
  }

  static getDefaultConfig() {
    return {
      github: {
        username: process.env.GITHUB_USERNAME || '',
        repositories: [],
        includePrivate: false
      },
      gitlab: {
        username: process.env.GITLAB_USERNAME || '',
        repositories: [],
        apiUrl: 'https://gitlab.com/api/v4',
        token: process.env.GITLAB_TOKEN || ''
      },
      feishu: {
        appId: process.env.FEISHU_APP_ID || '',
        appSecret: process.env.FEISHU_APP_SECRET || '',
        webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
        userId: process.env.FEISHU_USER_ID || '',
        chatId: process.env.FEISHU_CHAT_ID || ''
      },
      localProjects: {
        enabled: true,
        scanPaths: [process.cwd()],
        maxDepth: 2,
        excludePatterns: ['node_modules', '.git', 'dist', 'build', 'vendor']
      },
      browserHistory: {
        enabled: false,
        browsers: ['chrome', 'edge', 'firefox']
      },
      report: {
        title: '📋 每日工作摘要',
        includeCodeStats: true,
        includeTimeAnalysis: true,
        includeCharts: true,
        includeWeeklyComparison: true,
        includeMonthlyComparison: true,
        timezone: 'Asia/Shanghai',
        workHours: { start: 9, end: 18 }
      },
      projects: [],
      cron: {
        enabled: true,
        schedule: '0 8 * * *',
        timezone: 'Asia/Shanghai'
      }
    };
  }
}
