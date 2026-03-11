#!/usr/bin/env node
/**
 * 测试脚本
 * 验证各模块功能
 */

import { GitHubDataSource } from '../src/datasource/github.js';
import { FeishuDataSource } from '../src/datasource/feishu.js';
import { ReportGenerator } from '../src/generator/report.js';
import { FeishuPusher } from '../src/pusher/feishu.js';

async function test() {
  console.log('🧪 开始测试...\n');

  // 测试 1: 配置加载
  console.log('Test 1: 配置加载');
  try {
    const { ConfigManager } = await import('../src/utils/config.js');
    const config = await ConfigManager.load();
    console.log('✅ 配置加载成功');
    console.log('  GitHub 用户名:', config.github?.username || '未配置');
    console.log('  仓库数量:', config.github?.repositories?.length || 0);
  } catch (error) {
    console.error('❌ 配置加载失败:', error.message);
  }

  // 测试 2: GitHub 数据源
  console.log('\nTest 2: GitHub 数据源');
  try {
    const githubDS = new GitHubDataSource({
      username: 'test-user',
      repositories: []
    });
    const today = new Date();
    const data = await githubDS.getTodayCommits(today);
    console.log('✅ GitHub 数据源正常');
    console.log('  返回数据结构:', Object.keys(data).join(', '));
  } catch (error) {
    console.error('❌ GitHub 数据源失败:', error.message);
  }

  // 测试 3: 报告生成器
  console.log('\nTest 3: 报告生成器');
  try {
    const generator = new ReportGenerator({
      title: '📋 测试日报',
      includeCodeStats: true,
      includeTimeAnalysis: true,
      timezone: 'Asia/Shanghai'
    });

    const mockData = {
      date: new Date(),
      github: {
        totalCommits: 5,
        repositories: [
          {
            name: 'test-repo',
            commits: [
              { sha: 'abc1234', message: 'feat: 添加新功能', author: 'Test', date: new Date().toISOString() }
            ],
            stats: { additions: 100, deletions: 20, filesChanged: 5 }
          }
        ],
        stats: { additions: 100, deletions: 20, filesChanged: 5 }
      },
      calendar: {
        events: [
          { summary: '团队例会', duration: 60, start: new Date().toISOString() }
        ],
        totalEvents: 1,
        totalDuration: 60,
        analysis: {
          totalMinutes: 60,
          byCategory: {
            meeting: { label: '会议', minutes: 60, events: [] },
            coding: { label: '开发', minutes: 0, events: [] },
            review: { label: '评审', minutes: 0, events: [] },
            learning: { label: '学习', minutes: 0, events: [] },
            other: { label: '其他', minutes: 0, events: [] }
          }
        }
      },
      projects: []
    };

    const result = generator.generate(mockData);
    const report = result.report;
    console.log('✅ 报告生成成功');
    console.log('  报告长度:', report.length, '字符');
    console.log('  包含部分:', report.includes('今日概览') ? '概览 ✓' : '概览 ✗');
  } catch (error) {
    console.error('❌ 报告生成失败:', error.message);
  }

  // 测试 4: 飞书推送器（不实际发送）
  console.log('\nTest 4: 飞书推送器');
  try {
    const pusher = new FeishuPusher({
      webhookUrl: 'https://test.example.com/webhook'
    });
    console.log('✅ 飞书推送器初始化成功');
    
    // 测试卡片构建
    const card = pusher.buildEnhancedCard('# 测试\n\n**日期**: 2024-01-01', {});
    console.log('  卡片结构:', Object.keys(card).join(', '));
  } catch (error) {
    console.error('❌ 飞书推送器失败:', error.message);
  }

  console.log('\n✨ 测试完成！');
}

test().catch(console.error);
