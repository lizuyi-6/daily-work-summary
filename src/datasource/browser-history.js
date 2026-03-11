/**
 * 浏览器历史分析器
 * 分析浏览器历史记录，生成效率报告
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class BrowserHistoryDataSource {
  constructor(config) {
    this.config = config;
    this.browsers = config.browsers || ['chrome', 'edge', 'firefox'];
  }

  /**
   * 获取今日浏览活动分析
   */
  async getTodayActivity(date) {
    const results = {
      date: this.formatDate(date),
      totalVisits: 0,
      uniqueSites: 0,
      topSites: [],
      categories: {
        work: { label: '工作相关', count: 0, sites: [] },
        development: { label: '开发', count: 0, sites: [] },
        learning: { label: '学习', count: 0, sites: [] },
        social: { label: '社交', count: 0, sites: [] },
        entertainment: { label: '娱乐', count: 0, sites: [] },
        other: { label: '其他', count: 0, sites: [] }
      },
      productivity: {
        score: 0,
        workHours: 0,
        devHours: 0,
        focusTime: 0
      }
    };

    // 尝试从各浏览器获取数据
    for (const browser of this.browsers) {
      try {
        const browserData = await this.getBrowserHistory(browser, date);
        results.totalVisits += browserData.visits.length;
        
        // 合并站点统计
        for (const [domain, count] of Object.entries(browserData.siteStats)) {
          const existing = results.topSites.find(s => s.domain === domain);
          if (existing) {
            existing.count += count;
          } else {
            results.topSites.push({ domain, count });
          }
        }
      } catch (error) {
        // 静默失败
      }
    }

    // 分类和排序
    results.uniqueSites = results.topSites.length;
    results.topSites.sort((a, b) => b.count - a.count);
    
    // 分类处理
    this.categorizeSites(results);
    
    // 计算效率分数
    this.calculateProductivity(results);

    return results;
  }

  /**
   * 获取浏览器历史记录
   * 注意：实际实现需要读取浏览器数据库，这里提供模拟/简化版本
   */
  async getBrowserHistory(browser, date) {
    // 实际实现需要读取:
    // Chrome: ~/Library/Application Support/Google/Chrome/Default/History (SQLite)
    // Edge: ~/Library/Application Support/Microsoft Edge/Default/History
    // Firefox: ~/Library/Application Support/Firefox/Profiles/*/places.sqlite
    
    // 由于浏览器数据库通常被锁定，这里使用模拟数据
    // 实际生产环境可以使用浏览器扩展或专门的工具导出
    
    return {
      browser,
      visits: [],
      siteStats: {}
    };
  }

  /**
   * 分类站点
   */
  categorizeSites(results) {
    const workPatterns = /github\.com|gitlab\.com|stackoverflow\.com|docs\.|notion\.so|feishu\.cn|larkoffice\.com/;
    const devPatterns = /localhost|127\.0\.0\.1|npmjs\.com|pypi\.org|docker\.com|kubernetes\.io/;
    const learningPatterns = /coursera|udemy|youtube\.com\/c|bilibili\.com|zhihu\.com|juejin\.cn/;
    const socialPatterns = /weibo|twitter|x\.com|facebook|instagram|tiktok|douyin/;
    const entertainmentPatterns = /bilibili\.com\/video|youtube\.com\/watch|netflix|twitch/;

    for (const site of results.topSites.slice(0, 20)) {
      const domain = site.domain.toLowerCase();
      
      if (workPatterns.test(domain)) {
        results.categories.work.count += site.count;
        results.categories.work.sites.push(site);
      } else if (devPatterns.test(domain)) {
        results.categories.development.count += site.count;
        results.categories.development.sites.push(site);
      } else if (learningPatterns.test(domain)) {
        results.categories.learning.count += site.count;
        results.categories.learning.sites.push(site);
      } else if (socialPatterns.test(domain)) {
        results.categories.social.count += site.count;
        results.categories.social.sites.push(site);
      } else if (entertainmentPatterns.test(domain)) {
        results.categories.entertainment.count += site.count;
        results.categories.entertainment.sites.push(site);
      } else {
        results.categories.other.count += site.count;
        results.categories.other.sites.push(site);
      }
    }
  }

  /**
   * 计算效率分数
   */
  calculateProductivity(results) {
    const work = results.categories.work.count;
    const dev = results.categories.development.count;
    const learning = results.categories.learning.count;
    const social = results.categories.social.count;
    const entertainment = results.categories.entertainment.count;
    
    const productive = work + dev + learning;
    const distracting = social + entertainment;
    const total = productive + distracting + results.categories.other.count;
    
    if (total > 0) {
      results.productivity.score = Math.round((productive / total) * 100);
      results.productivity.workHours = Math.round(work * 2 / 60 * 10) / 10; // 估算小时
      results.productivity.devHours = Math.round(dev * 2 / 60 * 10) / 10;
      results.productivity.focusTime = Math.round(productive * 2 / 60 * 10) / 10;
    }
  }

  /**
   * 获取模拟数据（用于测试）
   */
  getMockData() {
    return {
      totalVisits: 127,
      uniqueSites: 34,
      topSites: [
        { domain: 'github.com', count: 45 },
        { domain: 'stackoverflow.com', count: 23 },
        { domain: 'docs.python.org', count: 18 },
        { domain: 'feishu.cn', count: 15 },
        { domain: 'juejin.cn', count: 12 }
      ],
      categories: {
        work: { label: '工作相关', count: 60, sites: [] },
        development: { label: '开发', count: 41, sites: [] },
        learning: { label: '学习', count: 15, sites: [] },
        social: { label: '社交', count: 8, sites: [] },
        entertainment: { label: '娱乐', count: 3, sites: [] }
      },
      productivity: {
        score: 85,
        workHours: 2.0,
        devHours: 1.4,
        focusTime: 3.8
      }
    };
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}
