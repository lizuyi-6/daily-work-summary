/**
 * 日报生成器
 * 整合数据生成 Markdown 格式报告，支持 ASCII 图表和飞书卡片
 */

import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ChartUtil } from '../utils/charts.js';
import { EfficiencyScorer } from '../utils/efficiency.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ReportGenerator {
  constructor(config) {
    this.config = config;
    this.timezone = config.timezone || 'Asia/Shanghai';
    this.workHours = config.workHours || { start: 9, end: 18 };
    this.includeCharts = config.includeCharts !== false;
    this.includeWeeklyComparison = config.includeWeeklyComparison !== false;
    this.includeMonthlyComparison = config.includeMonthlyComparison !== false;
    this.efficiencyScorer = new EfficiencyScorer(config);
  }

  /**
   * 生成日报
   */
  generate(data) {
    const { date, github, calendar, localProjects, browser, weekComparison, monthComparison } = data;
    const dateStr = this.formatDisplayDate(date);
    
    // 计算效率评分
    const efficiency = this.efficiencyScorer.calculateScore(data);
    
    const sections = [
      this.generateHeader(dateStr),
      this.generateOverview(github, calendar, localProjects, browser, efficiency),
      this.generateEfficiencySection(efficiency),
      this.generateFileChangesSection(github, localProjects),
      this.generateGitHubSection(github),
      localProjects?.activeProjects > 0 ? this.generateLocalProjectsSection(localProjects) : '',
      this.generateCalendarSection(calendar),
      weekComparison ? this.generateWeeklyComparison(weekComparison) : '',
      monthComparison ? this.generateMonthlyComparison(monthComparison) : '',
      this.generateTomorrowSuggestions(calendar, efficiency),
      this.generateFooter()
    ];

    return {
      report: sections.filter(Boolean).join('\n\n'),
      efficiency // 返回效率数据供飞书卡片使用
    };
  }

  /**
   * 生成标题
   */
  generateHeader(dateStr) {
    const title = this.config.title || '📋 每日工作摘要';
    const header = [
      `╔════════════════════════════════════════╗`,
      `║     ${title}     ║`,
      `╚════════════════════════════════════════╝`,
      '',
      `📅 **日期**: ${dateStr}`,
      `⏰ **生成时间**: ${this.getCurrentTime()}`,
      ''
    ];
    return header.join('\n');
  }

  /**
   * 生成概览
   */
  generateOverview(github, calendar, localProjects, browser, efficiency) {
    const totalCommits = (github?.totalCommits || 0) + (localProjects?.repositories?.reduce((sum, r) => sum + r.commits.length, 0) || 0);
    const totalFiles = (github?.stats?.filesChanged || 0) + (localProjects?.stats?.filesChanged || 0);
    const totalAdditions = (github?.stats?.additions || 0) + (localProjects?.stats?.additions || 0);
    const totalDeletions = (github?.stats?.deletions || 0) + (localProjects?.stats?.deletions || 0);
    
    // 效率评分显示
    const grade = efficiency?.grade || { level: '-', emoji: '📊', desc: '计算中' };
    const score = efficiency?.score || 0;
    
    const parts = [
      '## 📊 今日概览',
      '',
      '```',
      '┌─────────────────┬────────┐',
      `│ 📝 代码提交     │ ${String(totalCommits).padStart(4)}   │`,
      `│ 📅 日程事件     │ ${String(calendar?.totalEvents || 0).padStart(4)}   │`,
      `│ 📁 变更文件     │ ${String(totalFiles).padStart(4)}   │`,
      `│ ➕ 代码新增     │ ${String(totalAdditions).padStart(4)}   │`,
      `│ ➖ 代码删除     │ ${String(totalDeletions).padStart(4)}   │`,
      `│ 📦 活跃项目     │ ${String(localProjects?.activeProjects || 0).padStart(4)}   │`,
      `│ 🎯 效率评分     │ ${grade.emoji} ${String(score).padStart(2)}分  │`,
      '└─────────────────┴────────┘',
      '```'
    ];

    // 添加 ASCII 图表（如果启用）
    if (this.includeCharts && (totalAdditions > 0 || totalDeletions > 0)) {
      parts.push('');
      parts.push('### 📈 代码变更分布');
      parts.push('```');
      parts.push(ChartUtil.horizontalBar([
        { label: '新增', value: totalAdditions },
        { label: '删除', value: totalDeletions }
      ], { suffix: ' 行' }));
      parts.push('```');
    }

    return parts.join('\n');
  }

  /**
   * 生成文件变更详情
   */
  generateFileChangesSection(github, localProjects) {
    const allFileChanges = [
      ...(github?.fileChanges || []),
      ...(localProjects?.repositories?.flatMap(r => 
        (r.fileChanges || []).map(f => ({ ...f, repo: r.name }))
      ) || [])
    ];

    if (allFileChanges.length === 0) return '';

    // 按总量排序，取前15
    const topFiles = allFileChanges
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const sections = [
      '## 📁 文件变更详情',
      '',
      `> 共变更 ${allFileChanges.length} 个文件，以下为 Top 15`,
      '',
      '```',
      '文件名                              新增    删除    总计  项目',
      '───────────────────────────────────────────────────────────────'
    ];

    for (const file of topFiles) {
      const name = file.filename.split('/').pop().slice(-30).padStart(30);
      const adds = String(file.additions).padStart(4);
      const dels = String(file.deletions).padStart(4);
      const total = String(file.total).padStart(4);
      const repo = (file.repo || '-').slice(0, 10).padStart(10);
      sections.push(`${name}  +${adds}  -${dels}  ${total}  ${repo}`);
    }

    sections.push('```');

    // 添加文件类型统计
    const fileTypes = {};
    for (const file of allFileChanges) {
      const ext = file.filename.split('.').pop() || 'unknown';
      if (!fileTypes[ext]) {
        fileTypes[ext] = { count: 0, additions: 0, deletions: 0 };
      }
      fileTypes[ext].count++;
      fileTypes[ext].additions += file.additions;
      fileTypes[ext].deletions += file.deletions;
    }

    const sortedTypes = Object.entries(fileTypes)
      .sort((a, b) => (b[1].additions + b[1].deletions) - (a[1].additions + a[1].deletions))
      .slice(0, 6);

    if (sortedTypes.length > 0) {
      sections.push('');
      sections.push('### 📊 按文件类型统计');
      sections.push('');
      sections.push('```');
      sections.push('类型      文件数    新增      删除');
      sections.push('─────────────────────────────────────');
      for (const [ext, stats] of sortedTypes) {
        sections.push(
          `.${ext.padEnd(7)} ${String(stats.count).padStart(4)}    +${String(stats.additions).padStart(5)}    -${String(stats.deletions).padStart(5)}`
        );
      }
      sections.push('```');
    }

    // 添加图表
    if (this.includeCharts && topFiles.length > 0) {
      sections.push('');
      sections.push('### 📈 变更量 Top 5');
      sections.push('```');
      sections.push(ChartUtil.horizontalBar(
        topFiles.slice(0, 5).map(f => ({
          label: f.filename.split('/').pop().slice(0, 12),
          value: f.total
        })),
        { maxWidth: 25, suffix: '' }
      ));
      sections.push('```');
    }

    return sections.join('\n');
  }

  /**
   * 生成 GitHub Commits 部分
   */
  generateGitHubSection(github) {
    if (!github?.repositories || github.repositories.length === 0) {
      return '## 💻 GitHub 代码提交\n\n> 今日暂无代码提交记录';
    }

    const sections = ['## 💻 GitHub 代码提交'];

    for (const repo of github.repositories) {
      if (repo.commits.length === 0) continue;

      sections.push(`\n### 📁 ${repo.name}`);
      sections.push('');
      
      for (const commit of repo.commits.slice(0, 8)) {
        const message = commit.message.length > 50 
          ? commit.message.slice(0, 50) + '...' 
          : commit.message;
        sections.push(`• \`${commit.sha}\` ${message}`);
      }

      if (repo.commits.length > 8) {
        sections.push(`\n> 还有 ${repo.commits.length - 8} 个 commits...`);
      }

      // 添加代码统计
      if (repo.stats && (repo.stats.additions || repo.stats.deletions)) {
        sections.push(`\n📊 **代码变更**: +${repo.stats.additions}/-${repo.stats.deletions} 行`);
      }
    }

    return sections.join('\n');
  }

  /**
   * 生成本地项目部分
   */
  generateLocalProjectsSection(localProjects) {
    const sections = [
      '## 🗂️ 本地项目活动',
      '',
      `> 扫描发现 ${localProjects.totalProjects} 个项目，${localProjects.activeProjects} 个今日有活动`,
      ''
    ];

    for (const repo of localProjects.repositories.slice(0, 5)) {
      sections.push(`### 📂 ${repo.name}`);
      sections.push('');
      
      for (const commit of repo.commits.slice(0, 5)) {
        const message = commit.message.length > 45 
          ? commit.message.slice(0, 45) + '...' 
          : commit.message;
        sections.push(`• \`${commit.sha}\` ${message}`);
      }
      
      if (repo.commits.length > 5) {
        sections.push(`> 还有 ${repo.commits.length - 5} 个 commits...`);
      }
      
      sections.push(`\n<small>📊 +${repo.stats.additions}/-${repo.stats.deletions} 行代码变更</small>`);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 生成日程部分
   */
  generateCalendarSection(calendar) {
    if (!calendar?.events || calendar.events.length === 0) {
      return '## 📅 日程回顾\n\n> 今日暂无日程安排';
    }

    const sections = ['## 📅 日程回顾', ''];

    // 时间分配表
    if (calendar.analysis) {
      sections.push('### ⏱️ 时间分配');
      sections.push('');
      sections.push('```');
      sections.push('类别          时长        占比');
      sections.push('─────────────────────────────');

      const total = calendar.analysis.totalMinutes;
      const categoryData = [];
      
      for (const [key, cat] of Object.entries(calendar.analysis.byCategory)) {
        if (cat.minutes > 0) {
          const percentage = total > 0 ? Math.round(cat.minutes / total * 100) : 0;
          const bar = '█'.repeat(Math.round(percentage / 5));
          sections.push(`${cat.label.padEnd(8)} ${this.formatDuration(cat.minutes).padStart(8)} ${bar} ${percentage}%`);
          categoryData.push({ label: cat.label, value: cat.minutes });
        }
      }
      sections.push('```');

      // 添加饼图
      if (this.includeCharts && categoryData.length > 0) {
        sections.push('');
        sections.push('```');
        sections.push(ChartUtil.pie(categoryData));
        sections.push('```');
      }
      
      sections.push('');
    }

    // 日程列表
    sections.push('### 🗓️ 今日事件');
    sections.push('');
    sections.push('| 时间 | 事件 | 时长 |');
    sections.push('|------|------|------|');

    for (const event of calendar.events.slice(0, 12)) {
      const timeStr = this.formatEventTime(event);
      const duration = this.formatDuration(event.duration);
      const summary = event.summary.length > 22 
        ? event.summary.slice(0, 22) + '...' 
        : event.summary;
      sections.push(`| ${timeStr} | ${summary} | ${duration} |`);
    }

    if (calendar.events.length > 12) {
      sections.push(`\n> 还有 ${calendar.events.length - 12} 个事件...`);
    }

    return sections.join('\n');
  }

  /**
   * 生成效率分析部分
   */
  generateEfficiencySection(efficiency) {
    if (!efficiency) return '';

    const { score, grade, dimensions, insights, suggestions } = efficiency;
    
    const sections = [
      '## 🎯 效率分析',
      '',
      `### ${grade.emoji} 效率评分: ${score}分 (${grade.desc})`,
      '',
      '```',
      '维度评分',
      '─────────────────────────────────'
    ];

    // 各维度得分
    const dimensionLabels = {
      coding: '💻 代码贡献',
      focus: '🎯 专注度',
      consistency: '📈 稳定性',
      productivity: '⚡ 生产力',
      balance: '⚖️ 平衡度'
    };

    for (const [key, label] of Object.entries(dimensionLabels)) {
      const dim = dimensions[key];
      if (dim?.score !== null && dim?.score !== undefined) {
        const bar = '█'.repeat(Math.round(dim.score / 10)) + '░'.repeat(10 - Math.round(dim.score / 10));
        sections.push(`${label}  [${bar}] ${dim.score}分`);
      }
    }
    sections.push('```');

    // 洞察
    if (insights?.length > 0) {
      sections.push('');
      sections.push('### 💡 今日洞察');
      sections.push('');
      for (const insight of insights.slice(0, 4)) {
        sections.push(`- ${insight}`);
      }
    }

    // 建议
    if (suggestions?.length > 0) {
      sections.push('');
      sections.push('### 📝 改进建议');
      sections.push('');
      const highPriority = suggestions.filter(s => s.priority === 'high');
      const otherSuggestions = suggestions.filter(s => s.priority !== 'high').slice(0, 2);
      
      for (const sug of [...highPriority, ...otherSuggestions]) {
        const icon = sug.priority === 'high' ? '🔴' : sug.priority === 'medium' ? '🟡' : '🟢';
        sections.push(`${icon} ${sug.text}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * 生成本周对比
   */
  generateWeeklyComparison(comparison) {
    const { currentWeek, lastWeek, changes } = comparison;
    
    const sections = [
      '## 📈 本周对比上周',
      '',
      '### 📊 数据对比',
      '',
      '```',
      '指标              本周          上周          变化',
      '─────────────────────────────────────────────────'
    ];

    const formatRow = (label, current, previous, change) => {
      const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
      const color = change > 0 ? '+' : '';
      const changeStr = `${arrow}${color}${change}%`;
      return `${label.padEnd(12)} ${String(current).padStart(6)} ${String(previous).padStart(12)} ${changeStr.padStart(8)}`;
    };

    sections.push(formatRow('Commits', currentWeek.totalCommits, lastWeek.totalCommits, changes.commits));
    sections.push(formatRow('Additions', currentWeek.totalAdditions, lastWeek.totalAdditions, changes.additions));
    sections.push(formatRow('Deletions', currentWeek.totalDeletions, lastWeek.totalDeletions, changes.deletions));
    sections.push(formatRow('Files', currentWeek.totalFilesChanged, lastWeek.totalFilesChanged, changes.filesChanged || 0));
    sections.push('```');

    // 添加变化趋势图
    if (this.includeCharts) {
      sections.push('');
      sections.push('### 📉 变化趋势');
      sections.push('```');
      sections.push(ChartUtil.horizontalBar([
        { label: 'Commits', value: Math.abs(changes.commits) },
        { label: 'Additions', value: Math.min(Math.abs(changes.additions), 100) },
        { label: 'Deletions', value: Math.min(Math.abs(changes.deletions), 100) }
      ], { suffix: '%' }));
      sections.push('```');
    }

    // 每日提交分布
    if (currentWeek.dailyCommits && Object.keys(currentWeek.dailyCommits).length > 0) {
      sections.push('');
      sections.push('### 📅 本周每日提交');
      sections.push('');
      sections.push('```');
      
      const days = Object.entries(currentWeek.dailyCommits)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7);
      
      const maxCommits = Math.max(...days.map(d => d[1], 1));
      
      for (const [date, count] of days) {
        const weekday = new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' });
        const bar = '█'.repeat(Math.round(count / maxCommits * 15));
        sections.push(`${weekday} (${date.slice(5)}) ${bar} ${count}`);
      }
      sections.push('```');
    }

    // 周总结
    sections.push('');
    sections.push('### 💡 周总结');
    sections.push('');
    
    if (changes.commits > 20) {
      sections.push('- 🚀 本周提交显著增长，保持出色状态！');
    } else if (changes.commits > 0) {
      sections.push('- 📈 本周产出稳步增长，继续保持');
    } else if (changes.commits < -20) {
      sections.push('- ⚠️ 本周提交下降，检查是否有阻塞');
    } else {
      sections.push('- 📊 本周产出稳定，寻求突破机会');
    }

    if (changes.additions > 50) {
      sections.push('- 💻 代码量大幅增长，注意代码质量');
    }

    return sections.join('\n');
  }

  /**
   * 生成本月对比
   */
  generateMonthlyComparison(comparison) {
    const { currentMonth, lastMonth, changes } = comparison;
    
    const sections = [
      '## 📅 本月对比上月',
      '',
      '```',
      '指标              本月          上月          变化',
      '─────────────────────────────────────────────────'
    ];

    const formatRow = (label, current, previous, change) => {
      const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
      const changeStr = `${arrow}${Math.abs(change)}%`;
      return `${label.padEnd(12)} ${String(current).padStart(6)} ${String(previous).padStart(12)} ${changeStr.padStart(8)}`;
    };

    sections.push(formatRow('Commits', currentMonth.totalCommits, lastMonth.totalCommits, changes.commits));
    sections.push(formatRow('Additions', currentMonth.totalAdditions, lastMonth.totalAdditions, changes.additions));
    sections.push(formatRow('Deletions', currentMonth.totalDeletions, lastMonth.totalDeletions, changes.deletions));
    sections.push('```');

    return sections.join('\n');
  }

  /**
   * 生成明日建议
   */
  generateTomorrowSuggestions(calendar, efficiency) {
    const sections = [
      '## 🎯 明日建议',
      '',
      '### 📋 待办事项',
      '',
      '- [ ] 回顾今日完成的工作',
      '- [ ] 检查 pending 的 PR 和 issues',
      '- [ ] 规划明日重点任务',
      ''
    ];

    // 根据今日日程给出建议
    if (calendar?.analysis) {
      const coding = calendar.analysis.byCategory?.coding;
      const meeting = calendar.analysis.byCategory?.meeting;

      sections.push('### 💡 智能建议');
      sections.push('');

      if (meeting && meeting.minutes > 240) {
        sections.push('- 📅 今日会议时间较长（' + this.formatDuration(meeting.minutes) + '），明日建议预留更多专注开发时间');
      }
      if (coding && coding.minutes < 120) {
        sections.push('- 💻 今日开发时间较少（' + this.formatDuration(coding.minutes) + '），明日可安排更多编码任务');
      }
      
      sections.push('- 🔄 建议在明日开始前列出 2-3 个最重要的任务');
    }

    // 基于效率评分的建议
    if (efficiency?.suggestions) {
      sections.push('');
      sections.push('### 🎯 效率提升建议');
      sections.push('');
      
      const highPrioritySuggestions = efficiency.suggestions.filter(s => s.priority === 'high');
      for (const sug of highPrioritySuggestions.slice(0, 2)) {
        sections.push(`- ${sug.text}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * 生成页脚
   */
  generateFooter() {
    return [
      '',
      '─'.repeat(50),
      '',
      '*由 每日工作智能摘要工具 自动生成*',
      `*生成时间: ${this.getCurrentTime()}*`
    ].join('\n');
  }

  /**
   * 保存报告到文件
   */
  async saveToFile(report, date) {
    const reportsDir = join(process.cwd(), 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const dateStr = date.toISOString().split('T')[0];
    const filename = join(reportsDir, `daily-report-${dateStr}.md`);
    
    await writeFile(filename, report, 'utf-8');
    console.log(`📄 报告已保存: ${filename}`);
  }

  /**
   * 格式化显示日期
   */
  formatDisplayDate(date) {
    const d = new Date(date);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[d.getDay()];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`;
  }

  /**
   * 格式化时长
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }

  /**
   * 格式化事件时间
   */
  formatEventTime(event) {
    if (!event.start) return '--:--';
    const d = new Date(event.start);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * 获取当前时间
   */
  getCurrentTime() {
    return new Date().toLocaleString('zh-CN', { 
      timeZone: this.timezone,
      hour12: false 
    });
  }
}
