/**
 * 飞书日程数据源
 * 支持获取用户日程、分析时间分配
 */

export class FeishuDataSource {
  constructor(config) {
    this.config = config;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.userId = config.userId;
    this.accessToken = null;
  }

  /**
   * 获取今日日程
   */
  async getTodayEvents(date) {
    await this.ensureAccessToken();

    const timeMin = this.getDayStart(date);
    const timeMax = this.getDayEnd(date);

    try {
      const events = await this.fetchEvents(timeMin, timeMax);
      const analysis = this.analyzeTime(events);

      return {
        date: this.formatDate(date),
        events,
        analysis,
        totalEvents: events.length,
        totalDuration: analysis.totalMinutes
      };
    } catch (error) {
      console.warn('⚠️ 获取飞书日程失败:', error.message);
      return {
        date: this.formatDate(date),
        events: [],
        analysis: { totalMinutes: 0, byCategory: {} },
        totalEvents: 0,
        totalDuration: 0
      };
    }
  }

  /**
   * 确保有访问令牌
   */
  async ensureAccessToken() {
    if (this.accessToken) return;

    // 如果没有配置 appId，尝试使用 webhook 方式
    if (!this.appId || !this.appSecret) {
      return;
    }

    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        this.accessToken = data.tenant_access_token;
      } else {
        throw new Error(data.msg);
      }
    } catch (error) {
      throw new Error(`获取 access token 失败: ${error.message}`);
    }
  }

  /**
   * 获取日程列表
   */
  async fetchEvents(timeMin, timeMax) {
    if (!this.accessToken || !this.userId) {
      return [];
    }

    const url = new URL('https://open.feishu.cn/open-apis/calendar/v4/calendar_list/events');
    url.searchParams.append('start_time', timeMin);
    url.searchParams.append('end_time', timeMax);
    url.searchParams.append('user_id_type', 'open_id');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg);
    }

    return (data.data?.items || []).map(event => ({
      id: event.event_id,
      summary: event.summary || '无标题',
      description: event.description || '',
      start: event.start_time?.timestamp,
      end: event.end_time?.timestamp,
      duration: this.calculateDuration(event.start_time?.timestamp, event.end_time?.timestamp),
      location: event.location?.name || '',
      attendees: (event.attendees || []).map(a => a.display_name || a.user_id),
      isRecurring: event.recurrence !== undefined,
      status: event.status
    }));
  }

  /**
   * 计算事件时长（分钟）
   */
  calculateDuration(start, end) {
    if (!start || !end) return 0;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return Math.round((endTime - startTime) / (1000 * 60));
  }

  /**
   * 分析时间分配
   */
  analyzeTime(events) {
    const analysis = {
      totalMinutes: 0,
      byCategory: {
        meeting: { label: '会议', minutes: 0, events: [] },
        coding: { label: '开发', minutes: 0, events: [] },
        review: { label: '评审', minutes: 0, events: [] },
        learning: { label: '学习', minutes: 0, events: [] },
        other: { label: '其他', minutes: 0, events: [] }
      }
    };

    for (const event of events) {
      analysis.totalMinutes += event.duration;

      // 根据标题关键词分类
      const category = this.categorizeEvent(event.summary);
      analysis.byCategory[category].minutes += event.duration;
      analysis.byCategory[category].events.push(event);
    }

    return analysis;
  }

  /**
   * 根据标题关键词分类事件
   */
  categorizeEvent(summary) {
    const text = summary.toLowerCase();
    
    if (/会议|例会|sync|review|评审|周会|月会|站立会|daily|scrum/.test(text)) {
      return 'meeting';
    }
    if (/开发|coding|programming|实现|功能|feature|bug|fix|修复/.test(text)) {
      return 'coding';
    }
    if (/代码评审|codereview|pr|pull|request/.test(text)) {
      return 'review';
    }
    if (/学习|培训|分享|seminar|workshop|学习会/.test(text)) {
      return 'learning';
    }
    
    return 'other';
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
