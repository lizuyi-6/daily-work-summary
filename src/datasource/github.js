import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

export class GitHubDataSource {
  constructor(config) {
    this.config = config;
    this.username = config.username;
    this.repositories = config.repositories || [];
  }

  /**
   * 获取指定日期的 commits
   */
  async getTodayCommits(date) {
    const dateStr = this.formatDate(date);
    const results = {
      date: dateStr,
      totalCommits: 0,
      repositories: [],
      stats: {
        additions: 0,
        deletions: 0,
        filesChanged: 0
      },
      fileChanges: [] // 新增：文件变更详情
    };

    for (const repo of this.repositories) {
      try {
        const repoData = await this.getRepoCommits(repo, date);
        if (repoData.commits.length > 0 || repoData.fileChanges.length > 0) {
          results.repositories.push(repoData);
          results.totalCommits += repoData.commits.length;
          results.stats.additions += repoData.stats.additions;
          results.stats.deletions += repoData.stats.deletions;
          results.stats.filesChanged += repoData.stats.filesChanged;
          results.fileChanges.push(...repoData.fileChanges);
        }
      } catch (error) {
        console.warn(`⚠️ 获取 ${repo.name} 失败:`, error.message);
      }
    }

    // 按变更量排序文件
    results.fileChanges.sort((a, b) => b.total - a.total);

    return results;
  }

  /**
   * 获取单个仓库的 commits
   */
  async getRepoCommits(repo, date) {
    const since = this.getDayStart(date);
    const until = this.getDayEnd(date);
    
    let commits = [];
    let stats = { additions: 0, deletions: 0, filesChanged: 0 };
    let fileChanges = [];

    // 检查 gh CLI 是否可用
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch {
      // 如果 gh 不可用，使用 git log
      return this.getGitLogCommits(repo, since, until);
    }

    // 使用 gh CLI 获取 commits
    if (repo.remote) {
      try {
        const cmd = `gh api repos/${repo.remote}/commits \\
          -q '.[] | select(.commit.committer.date >= "${since}" and .commit.committer.date <= "${until}") | {sha: .sha, message: .commit.message, author: .commit.author.name, date: .commit.committer.date}' \\
          --paginate`;
        
        const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        commits = this.parseGhOutput(output);
      } catch (error) {
        // 失败则回退到 git log
      }
    }

    // 使用本地 git log 获取 commits
    if (commits.length === 0 && repo.path && existsSync(repo.path)) {
      const localData = this.getGitLogCommits(repo, since, until);
      commits = localData.commits;
      stats = localData.stats;
      fileChanges = localData.fileChanges;
    }

    // 获取代码统计和文件详情
    if (repo.path && existsSync(repo.path) && commits.length > 0) {
      stats = this.getCodeStats(repo.path, since, until);
      fileChanges = this.getFileChanges(repo.path, since, until);
    }

    return {
      name: repo.name,
      remote: repo.remote,
      path: repo.path,
      commits,
      stats,
      fileChanges
    };
  }

  /**
   * 使用本地 git log 获取 commits
   */
  getGitLogCommits(repo, since, until) {
    if (!repo.path || !existsSync(repo.path)) {
      return { 
        commits: [], 
        stats: { additions: 0, deletions: 0, filesChanged: 0 },
        fileChanges: []
      };
    }

    const format = '%H|%s|%an|%ad';
    const cmd = `cd "${repo.path}" && git log \\
      --since="${since}" \\
      --until="${until}" \\
      --author="${this.username}" \\
      --pretty=format:"${format}" \\
      --date=iso`;

    try {
      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const commits = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [sha, message, author, date] = line.split('|');
          return { sha: sha.slice(0, 7), message: message.trim(), author, date };
        });

      const stats = this.getCodeStats(repo.path, since, until);
      const fileChanges = this.getFileChanges(repo.path, since, until);
      
      return { commits, stats, fileChanges };
    } catch (error) {
      return { 
        commits: [], 
        stats: { additions: 0, deletions: 0, filesChanged: 0 },
        fileChanges: []
      };
    }
  }

  /**
   * 获取代码变更统计
   */
  getCodeStats(repoPath, since, until) {
    try {
      // 获取时间段内的提交列表
      const commitsCmd = `cd "${repoPath}" && git log \
        --since="${since}" \
        --until="${until}" \
        --pretty=format:"%H" \
        --author="${this.username}"`;
      
      const commitsOutput = execSync(commitsCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const commits = commitsOutput.trim().split('\n').filter(line => line.trim());
      
      if (commits.length === 0) {
        return { additions: 0, deletions: 0, filesChanged: 0 };
      }

      // 使用第一个提交的父提交到 HEAD 的 diff
      let diffCmd;
      if (commits.length === 1) {
        // 单个提交：使用该提交的统计
        diffCmd = `cd "${repoPath}" && git show --shortstat ${commits[0]}`;
      } else {
        // 多个提交：从第一个提交的父提交到 HEAD
        const firstCommitParent = `${commits[commits.length - 1]}^`;
        diffCmd = `cd "${repoPath}" && git diff --shortstat ${firstCommitParent}..HEAD 2>/dev/null || git show --shortstat ${commits[0]}`;
      }

      const output = execSync(diffCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      // 解析 git diff --shortstat 或 git show --shortstat 输出
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
      // 获取时间段内的提交列表
      const commitsCmd = `cd "${repoPath}" && git log \
        --since="${since}" \
        --until="${until}" \
        --pretty=format:"%H" \
        --author="${this.username}"`;
      
      const commitsOutput = execSync(commitsCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const commits = commitsOutput.trim().split('\n').filter(line => line.trim());
      
      if (commits.length === 0) {
        return [];
      }

      // 使用第一个提交的父提交到 HEAD 的 diff
      let diffCmd;
      if (commits.length === 1) {
        // 单个提交：使用该提交的文件变更
        diffCmd = `cd "${repoPath}" && git show --numstat ${commits[0]}`;
      } else {
        // 多个提交：从第一个提交的父提交到 HEAD
        const firstCommitParent = `${commits[commits.length - 1]}^`;
        diffCmd = `cd "${repoPath}" && git diff --numstat ${firstCommitParent}..HEAD 2>/dev/null || git show --numstat ${commits[0]}`;
      }

      const output = execSync(diffCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
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
            total: additions + deletions,
            repo: repoPath.split('/').pop()
          });
        }
      }

      // 按变更量排序
      return files.sort((a, b) => b.total - a.total);
    } catch (error) {
      return [];
    }
  }

  /**
   * 解析 gh CLI 输出
   */
  parseGhOutput(output) {
    if (!output.trim()) return [];
    
    const commits = [];
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        commits.push({
          sha: data.sha.slice(0, 7),
          message: data.message.split('\n')[0], // 只取第一行
          author: data.author,
          date: data.date
        });
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    return commits;
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
