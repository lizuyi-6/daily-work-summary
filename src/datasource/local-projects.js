/**
 * 本地项目扫描器
 * 自动发现本地 Git 仓库并统计代码活动
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

export class LocalProjectsDataSource {
  constructor(config) {
    this.config = config;
    this.username = config.username || this.getGitUsername();
    this.scanPaths = config.scanPaths || [process.cwd()];
    this.maxDepth = config.maxDepth || 2;
    this.excludePatterns = config.excludePatterns || ['node_modules', '.git', 'dist', 'build', 'vendor'];
  }

  /**
   * 获取 Git 用户名
   */
  getGitUsername() {
    try {
      return execSync('git config user.name', { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }

  /**
   * 扫描本地项目
   */
  async scanProjects(date) {
    const discoveredRepos = [];
    
    for (const scanPath of this.scanPaths) {
      if (!existsSync(scanPath)) continue;
      const repos = this.findGitRepos(scanPath, 0);
      discoveredRepos.push(...repos);
    }

    // 去重
    const uniqueRepos = [...new Set(discoveredRepos)];
    
    // 获取今日活动
    const results = {
      date: this.formatDate(date),
      totalProjects: uniqueRepos.length,
      activeProjects: 0,
      repositories: [],
      stats: {
        additions: 0,
        deletions: 0,
        filesChanged: 0
      }
    };

    for (const repoPath of uniqueRepos.slice(0, 20)) { // 最多处理20个仓库
      try {
        const repoData = await this.getRepoActivity(repoPath, date);
        if (repoData.commits.length > 0) {
          results.repositories.push(repoData);
          results.activeProjects++;
          results.stats.additions += repoData.stats.additions;
          results.stats.deletions += repoData.stats.deletions;
          results.stats.filesChanged += repoData.stats.filesChanged;
        }
      } catch (error) {
        // 静默跳过
      }
    }

    return results;
  }

  /**
   * 递归查找 Git 仓库
   */
  findGitRepos(basePath, depth) {
    if (depth > this.maxDepth) return [];
    
    const repos = [];
    const gitDir = join(basePath, '.git');
    
    // 检查当前目录是否是 Git 仓库
    if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
      return [resolve(basePath)];
    }

    // 递归扫描子目录
    try {
      const entries = readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (this.excludePatterns.includes(entry.name)) continue;
        
        const subPath = join(basePath, entry.name);
        const subRepos = this.findGitRepos(subPath, depth + 1);
        repos.push(...subRepos);
      }
    } catch (error) {
      // 权限问题等，静默跳过
    }

    return repos;
  }

  /**
   * 获取单个仓库的活动
   */
  async getRepoActivity(repoPath, date) {
    const since = this.getDayStart(date);
    const until = this.getDayEnd(date);
    
    const repoName = repoPath.split('/').pop();
    
    // 获取 commits
    const format = '%H|%s|%an|%ad';
    const cmd = `cd "${repoPath}" && git log \
      --since="${since}" \
      --until="${until}" \
      --author="${this.username}" \
      --pretty=format:"${format}" \
      --date=iso`;

    let commits = [];
    try {
      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      commits = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [sha, message, author, date] = line.split('|');
          return { sha: sha.slice(0, 7), message: message.trim(), author, date };
        });
    } catch (error) {
      // 无 commits
    }

    // 获取代码统计和文件详情
    const stats = this.getCodeStats(repoPath, since, until);
    const fileChanges = this.getFileChanges(repoPath, since, until);

    return {
      name: repoName,
      path: repoPath,
      commits,
      fileChanges,
      stats
    };
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
   * 获取文件变更详情
   */
  getFileChanges(repoPath, since, until) {
    try {
      const cmd = `cd "${repoPath}" && git diff \
        --numstat \
        $(git log --since="${since}" --until="${until}" --pretty=format:"%H" | tail -1)^..HEAD \
        2>/dev/null || echo ""`;

      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const files = [];
      const lines = output.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parts[0] === '-' ? 0 : parseInt(parts[0]) || 0;
          const deletions = parts[1] === '-' ? 0 : parseInt(parts[1]) || 0;
          const filename = parts[2];
          
          files.push({
            filename,
            additions,
            deletions,
            total: additions + deletions
          });
        }
      }

      // 按变更量排序，取前10
      return files
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  getDayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  getDayEnd(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }
}
