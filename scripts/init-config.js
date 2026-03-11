#!/usr/bin/env node
/**
 * 配置初始化脚本
 * 交互式创建配置文件
 */

import { writeFile, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  console.log('🚀 每日工作智能摘要工具 - 配置初始化\n');

  const config = {
    github: {},
    feishu: {},
    report: {},
    projects: []
  };

  // GitHub 配置
  console.log('📦 GitHub 配置');
  config.github.username = await question('GitHub 用户名: ');
  config.github.includePrivate = (await question('包含私有仓库? (y/n): ')).toLowerCase() === 'y';

  // 仓库配置
  const repoCount = parseInt(await question('要监控的仓库数量 (默认1): ') || '1');
  config.github.repositories = [];

  for (let i = 0; i < repoCount; i++) {
    console.log(`\n📁 仓库 ${i + 1}:`);
    const repo = {
      name: await question('  名称 (如: my-project): '),
      path: await question('  本地路径 (如: /home/user/projects/my-project): '),
      remote: await question('  GitHub remote (如: owner/repo, 可选): ')
    };
    if (repo.name && repo.path) {
      config.github.repositories.push(repo);
    }
  }

  // 飞书配置
  console.log('\n📨 飞书配置');
  config.feishu.webhookUrl = await question('Webhook URL (可选): ');
  config.feishu.appId = await question('App ID (可选): ');
  config.feishu.appSecret = await question('App Secret (可选): ');
  config.feishu.userId = await question('用户 OpenID (可选): ');

  // 报告配置
  console.log('\n📝 报告配置');
  config.report.title = await question('报告标题 (默认: 📋 每日工作摘要): ') || '📋 每日工作摘要';
  config.report.includeCodeStats = (await question('包含代码统计? (y/n, 默认y): ') || 'y').toLowerCase() === 'y';
  config.report.includeTimeAnalysis = (await question('包含时间分析? (y/n, 默认y): ') || 'y').toLowerCase() === 'y';
  config.report.timezone = await question('时区 (默认: Asia/Shanghai): ') || 'Asia/Shanghai';

  // 项目配置
  console.log('\n🏗️ 项目分类配置');
  const projectCount = parseInt(await question('项目数量 (默认0): ') || '0');
  
  for (let i = 0; i < projectCount; i++) {
    console.log(`\n项目 ${i + 1}:`);
    const project = {
      name: await question('  项目名称: '),
      repo: await question('  对应仓库名: '),
      category: await question('  项目分类 (如: 前端/后端/设计): ')
    };
    if (project.name) {
      config.projects.push(project);
    }
  }

  // 保存配置
  const configPath = join(process.cwd(), 'config', 'config.json');
  
  if (existsSync(configPath)) {
    const overwrite = await question('\n⚠️ 配置文件已存在, 是否覆盖? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ 已取消');
      rl.close();
      return;
    }
  }

  writeFile(configPath, JSON.stringify(config, null, 2), (err) => {
    if (err) {
      console.error('❌ 保存配置失败:', err);
    } else {
      console.log(`\n✅ 配置已保存到: ${configPath}`);
      console.log('\n使用方式:');
      console.log('  npm start    # 生成并推送日报');
    }
    rl.close();
  });
}

main().catch(console.error);
