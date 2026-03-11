/**
 * 统计数据工具
 * 提供本周/本月统计对比
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

export class StatsUtil {
  constructor(config) {
    this.config = config;
    this.githubRepos = config.github?.repositories || [];
    this.gitlabRepos = config.gitlab?.repositories || [];
    this.username = config.github?.username || '';
  }

  /**
   * 获取时间段内的代码统计
   */
  async getPeriodStats(days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const results = {
      period: days,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      totalCommits: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalFilesChanged: 0,
      dailyCommits: {},
      byRepository: {}
    };

    // 收集所有仓库
    const allRepos = [
      ...this.githubRepos.map(r => ({ ...r, type: 'github' })),
      ...this.gitlabRepos.map(r => ({ ...r, type: 'gitlab' }))
    ];

    for (const repo of allRepos) {
      const stats = await this.getRepoPeriodStats(repo, startDate, endDate);
      if (stats.commits > 0) {
        results.byRepository[repo.name] = stats;
        results.totalCommits += stats.commits;
        results.totalAdditions += stats.additions;
        results.totalDeletions += stats.deletions;
        results.totalFilesChanged += stats.filesChanged;
        
        // 合并每日提交
        for (const [date, count] of Object.entries(stats.dailyCommits)) {
          results.dailyCommits[date] = (results.dailyCommits[date] || 0) + count;
        }
      }
    }

    return results;
  }

  /**
   * 获取本周和上周对比
   */
  async getWeekComparison() {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    const [currentWeek, lastWeek] = await Promise.all([
      this.getPeriodStats(7),
      this.getStatsForRange(lastWeekStart, lastWeekEnd)
    ]);

    return {
      currentWeek,
      lastWeek,
      changes: {
        commits: this.calculateChange(currentWeek.totalCommits, lastWeek.totalCommits),
        additions: this.calculateChange(currentWeek.totalAdditions, lastWeek.totalAdditions),
        deletions: this.calculateChange(currentWeek.totalDeletions, lastWeek.totalDeletions),
        filesChanged: this.calculateChange(currentWeek.totalFilesChanged, lastWeek.totalFilesChanged)
      }
    };
  }

  /**
   * 获取本月和上月对比
   */
  async getMonthComparison() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0);

    const daysInCurrentMonth = today.getDate();
    const daysInLastMonth = lastMonthEnd.getDate();

    const [currentMonthStats, lastMonthStats] = await Promise.all([
      this.getStatsForRange(currentMonthStart, today),
      this.getStatsForRange(lastMonthStart, lastMonthEnd)
    ]);

    // 按天平均调整上月数据
    const adjustedLastMonth = {
      ...lastMonthStats,
      totalCommits: Math.round(lastMonthStats.totalCommits * daysInCurrentMonth / daysInLastMonth),
      totalAdditions: Math.round(lastMonthStats.totalAdditions * daysInCurrentMonth / daysInLastMonth),
      totalDeletions: Math.round(lastMonthStats.totalDeletions * daysInCurrentMonth / daysInLastMonth)
    };

    return {
      currentMonth: currentMonthStats,
      lastMonth: adjustedLastMonth,
      changes: {
        commits: this.calculateChange(currentMonthStats.totalCommits, adjustedLastMonth.totalCommits),
        additions: this.calculateChange(currentMonthStats.totalAdditions, adjustedLastMonth.totalAdditions),
        deletions: this.calculateChange(currentMonthStats.totalDeletions, adjustedLastMonth.totalDeletions)
      }
    };
  }

  /**
   * 获取指定日期范围的统计
   */
  async getStatsForRange(startDate, endDate) {
    const results = {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      totalCommits: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalFilesChanged: 0,
      dailyCommits: {}
    };

    const allRepos = [
      ...this.githubRepos.map(r => ({ ...r, type: 'github' })),
      ...this.gitlabRepos.map(r => ({ ...r, type: 'gitlab' }))
    ];

    for (const repo of allRepos) {
      const stats = await this.getRepoPeriodStats(repo, startDate, endDate);
      if (stats.commits > 0) {
        results.totalCommits += stats.commits;
        results.totalAdditions += stats.additions;
        results.totalDeletions += stats.deletions;
        results.totalFilesChanged += stats.filesChanged;
        
        for (const [date, count] of Object.entries(stats.dailyCommits)) {
          results.dailyCommits[date] = (results.dailyCommits[date] || 0) + count;
        }
      }
    }

    return results;
  }

  /**
   * 获取单个仓库在时间段内的统计
   */
  async getRepoPeriodStats(repo, startDate, endDate) {
    if (!repo.path || !existsSync(repo.path)) {
      return {
        commits: 0,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        dailyCommits: {}
      };
    }

    const since = startDate.toISOString();
    const until = endDate.toISOString();

    try {
      // 获取 commits 列表
      const format = '%H|%s|%an|%ad';
      const cmd = `cd "${repo.path}" && git log \
        --since="${since}" \
        --until="${until}" \
        --author="${this.username}" \
        --pretty=format:"${format}" \
        --date=short`;

      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const commits = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [sha, message, author, date] = line.split('|');
          return { sha: sha.slice(0, 7), message: message.trim(), author, date };
        });

      // 统计每日提交
      const dailyCommits = {};
      for (const commit of commits) {
        dailyCommits[commit.date] = (dailyCommits[commit.date] || 0) + 1;
      }

      // 获取代码统计
      const stats = this.getCodeStats(repo.path, since, until);

      return {
        commits: commits.length,
        additions: stats.additions,
        deletions: stats.deletions,
        filesChanged: stats.filesChanged,
        dailyCommits
      };
    } catch (error) {
      return {
        commits: 0,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        dailyCommits: {}
      };
    }
  }

  /**
   * 获取代码变更统计
   */
  getCodeStats(repoPath, since, until) {
    try {
      const cmd = `cd "${repoPath}" && git diff \
        --shortstat \
        $(git log --since="${since}" --until="${until}" --pretty=format:"%H" | tail -1)^..HEAD \
        2>/dev/null || echo ""`;

      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const additions = parseInt(output.match(/(\d+) insertions?/)?.[1] || 0);
      const deletions = parseInt(output.match(/(\d+) deletions?/)?.[1] || 0);
      const filesChanged = parseInt(output.match(/(\d+) files? changed/)?.[1] || 0);

      return { additions, deletions, filesChanged };
    } catch (error) {
      return { additions: 0, deletions: 0, filesChanged: 0 };
    }
  }

  /**
   * 计算变化百分比
   */
  calculateChange(current, previous) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round((current - previous) / previous * 100);
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}
