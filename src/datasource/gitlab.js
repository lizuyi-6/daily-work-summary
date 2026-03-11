/**
 * GitLab 数据源
 * 支持获取 GitLab commits、merge requests
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

export class GitLabDataSource {
  constructor(config) {
    this.config = config;
    this.username = config.username;
    this.repositories = config.repositories || [];
    this.apiUrl = config.apiUrl || 'https://gitlab.com/api/v4';
    this.token = config.token;
  }

  /**
   * 获取指定日期的 commits 和 MRs
   */
  async getTodayActivity(date) {
    const dateStr = this.formatDate(date);
    const results = {
      date: dateStr,
      totalCommits: 0,
      totalMRs: 0,
      repositories: [],
      stats: {
        additions: 0,
        deletions: 0,
        filesChanged: 0
      }
    };

    for (const repo of this.repositories) {
      try {
        const repoData = await this.getRepoActivity(repo, date);
        if (repoData.commits.length > 0 || repoData.mergeRequests.length > 0) {
          results.repositories.push(repoData);
          results.totalCommits += repoData.commits.length;
          results.totalMRs += repoData.mergeRequests.length;
          results.stats.additions += repoData.stats.additions;
          results.stats.deletions += repoData.stats.deletions;
          results.stats.filesChanged += repoData.stats.filesChanged;
        }
      } catch (error) {
        console.warn(`⚠️ 获取 GitLab ${repo.name} 失败:`, error.message);
      }
    }

    return results;
  }

  /**
   * 获取单个仓库的活动
   */
  async getRepoActivity(repo, date) {
    const since = this.getDayStart(date);
    const until = this.getDayEnd(date);
    
    let commits = [];
    let mergeRequests = [];
    let stats = { additions: 0, deletions: 0, filesChanged: 0 };

    // 使用本地 git log 获取 commits
    if (repo.path && existsSync(repo.path)) {
      const localData = this.getGitLogCommits(repo, since, until);
      commits = localData.commits;
      stats = localData.stats;
    }

    // 通过 API 获取 Merge Requests
    if (this.token && repo.projectId) {
      try {
        mergeRequests = await this.getMergeRequests(repo.projectId, since, until);
      } catch (error) {
        // 静默失败
      }
    }

    return {
      name: repo.name,
      projectId: repo.projectId,
      path: repo.path,
      commits,
      mergeRequests,
      stats
    };
  }

  /**
   * 使用本地 git log 获取 commits
   */
  getGitLogCommits(repo, since, until) {
    if (!repo.path || !existsSync(repo.path)) {
      return { commits: [], stats: { additions: 0, deletions: 0, filesChanged: 0 } };
    }

    const format = '%H|%s|%an|%ad';
    const cmd = `cd "${repo.path}" && git log \
      --since="${since}" \
      --until="${until}" \
      --author="${this.username}" \
      --pretty=format:"${format}" \
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
      return { commits, stats };
    } catch (error) {
      return { commits: [], stats: { additions: 0, deletions: 0, filesChanged: 0 } };
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
   * 通过 API 获取 Merge Requests
   */
  async getMergeRequests(projectId, since, until) {
    const url = new URL(`${this.apiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests`);
    url.searchParams.append('state', 'all');
    url.searchParams.append('updated_after', since);
    url.searchParams.append('updated_before', until);
    url.searchParams.append('author_username', this.username);

    const response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': this.token
      }
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.map(mr => ({
      id: mr.iid,
      title: mr.title,
      state: mr.state,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      createdAt: mr.created_at,
      mergedAt: mr.merged_at,
      url: mr.web_url
    }));
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
