/**
 * 飞书推送器
 * 支持 webhook 和 API 两种方式推送消息，生成美观的飞书卡片
 */

export class FeishuPusher {
  constructor(config) {
    this.config = config;
    this.webhookUrl = config.webhookUrl;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.userId = config.userId;
    this.chatId = config.chatId;
  }

  /**
   * 推送日报到飞书
   */
  async push(report, data = {}) {
    if (this.webhookUrl) {
      return this.pushByWebhook(report, data);
    } else if (this.appId && (this.userId || this.chatId)) {
      return this.pushByAPI(report, data);
    } else {
      throw new Error('未配置飞书推送方式 (webhook 或 appId + userId/chatId)');
    }
  }

  /**
   * 通过 Webhook 推送（使用卡片消息）
   */
  async pushByWebhook(report, data) {
    const payload = {
      msg_type: 'interactive',
      card: this.buildEnhancedCard(report, data)
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.code !== 0 && result.StatusCode !== 0) {
      throw new Error(`Webhook 推送失败: ${result.msg || JSON.stringify(result)}`);
    }

    return result;
  }

  /**
   * 通过 API 推送（发送给指定用户或群）
   */
  async pushByAPI(report, data) {
    const token = await this.getAccessToken();
    
    // 优先发送到群，如果没有群ID则发送到用户
    const receiveId = this.chatId || this.userId;
    const receiveIdType = this.chatId ? 'chat_id' : 'open_id';
    
    const payload = {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(this.buildEnhancedCard(report, data))
    };

    const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`API 推送失败: ${result.msg}`);
    }

    return result;
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`获取 access token 失败: ${data.msg}`);
    }

    return data.tenant_access_token;
  }

  /**
   * 构建增强版卡片消息
   */
  buildEnhancedCard(report, data) {
    const { github, calendar, localProjects, weekComparison, monthComparison, efficiency } = data;
    
    // 计算汇总数据
    const totalCommits = (github?.totalCommits || 0) + (localProjects?.repositories?.reduce((sum, r) => sum + r.commits.length, 0) || 0);
    const totalFiles = (github?.stats?.filesChanged || 0) + (localProjects?.stats?.filesChanged || 0);
    const totalAdditions = (github?.stats?.additions || 0) + (localProjects?.stats?.additions || 0);
    const totalDeletions = (github?.stats?.deletions || 0) + (localProjects?.stats?.deletions || 0);

    const elements = [];

    // ===== 1. 概览区块 =====
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: '**📊 今日概览**'
      }
    });

    // 概览数据 - 4列布局
    elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**📝 代码提交**\n${totalCommits} 次`
          }
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**📅 日程事件**\n${calendar?.totalEvents || 0} 个`
          }
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**📁 变更文件**\n${totalFiles} 个`
          }
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**➕➖ 代码变更**\n+${totalAdditions}/-${totalDeletions}`
          }
        }
      ]
    });

    elements.push({ tag: 'hr' });

    // ===== 2. 效率评分区块 =====
    if (efficiency) {
      const { score, grade, dimensions } = efficiency;
      
      // 评分标题
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${grade.emoji} 效率评分: ${score}分 (${grade.desc})**`
        }
      });

      // 各维度评分 - 使用进度条样式
      const dimensionFields = [];
      const dimensionLabels = {
        coding: { label: '💻 代码', icon: '💻' },
        focus: { label: '🎯 专注', icon: '🎯' },
        consistency: { label: '📈 稳定', icon: '📈' },
        productivity: { label: '⚡ 产出', icon: '⚡' },
        balance: { label: '⚖️ 平衡', icon: '⚖️' }
      };

      for (const [key, info] of Object.entries(dimensionLabels)) {
        const dim = dimensions[key];
        if (dim?.score !== null && dim?.score !== undefined) {
          const progressBar = this.generateProgressBar(dim.score);
          dimensionFields.push({
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**${info.label}**\n${progressBar} ${dim.score}分`
            }
          });
        }
      }

      // 分两行显示
      if (dimensionFields.length > 0) {
        elements.push({
          tag: 'div',
          fields: dimensionFields.slice(0, 4)
        });
        if (dimensionFields.length > 4) {
          elements.push({
            tag: 'div',
            fields: dimensionFields.slice(4)
          });
        }
      }

      elements.push({ tag: 'hr' });
    }

    // ===== 3. 文件变更详情 =====
    const allFileChanges = [
      ...(github?.fileChanges || []),
      ...(localProjects?.repositories?.flatMap(r => 
        (r.fileChanges || []).map(f => ({ ...f, repo: r.name }))
      ) || [])
    ];

    if (allFileChanges.length > 0) {
      const topFiles = allFileChanges.sort((a, b) => b.total - a.total).slice(0, 8);

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📁 文件变更 (Top 8)**`
        }
      });

      const fileList = topFiles
        .map(f => {
          const filename = f.filename.split('/').pop();
          const icon = f.additions > f.deletions ? '🟢' : f.deletions > f.additions ? '🔴' : '🟡';
          return `${icon} \`${filename.slice(0, 25)}\` +${f.additions}/-${f.deletions}`;
        })
        .join('\n');

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: fileList
        }
      });

      elements.push({ tag: 'hr' });
    }

    // ===== 4. 代码提交详情 =====
    if (github?.repositories?.length > 0 || localProjects?.repositories?.length > 0) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**💻 代码提交详情**'
        }
      });

      // GitHub 提交
      if (github?.repositories?.length > 0) {
        for (const repo of github.repositories.slice(0, 2)) {
          if (repo.commits.length === 0) continue;
          
          const commitList = repo.commits
            .slice(0, 4)
            .map(c => `• \`${c.sha}\` ${c.message.slice(0, 35)}${c.message.length > 35 ? '...' : ''}`)
            .join('\n');
          
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**📁 ${repo.name}** (${repo.commits.length} commits)\n${commitList}`
            }
          });
        }
      }

      // 本地项目统计
      if (localProjects?.repositories?.length > 0) {
        const localCommits = localProjects.repositories.reduce((sum, r) => sum + r.commits.length, 0);
        const activeRepos = localProjects.repositories.filter(r => r.commits.length > 0);
        
        if (activeRepos.length > 0) {
          const repoList = activeRepos
            .slice(0, 3)
            .map(r => `• **${r.name}**: ${r.commits.length} commits (+${r.stats.additions}/-${r.stats.deletions})`)
            .join('\n');
          
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**🗂️ 本地项目** (${localProjects.activeProjects} 个活跃)\n${repoList}`
            }
          });
        }
      }

      elements.push({ tag: 'hr' });
    }

    // ===== 5. 日程回顾 =====
    if (calendar?.events?.length > 0) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**📅 日程回顾**'
        }
      });

      // 时间分配
      if (calendar.analysis?.byCategory) {
        const categories = Object.values(calendar.analysis.byCategory)
          .filter(c => c.minutes > 0)
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 4);

        if (categories.length > 0) {
          const timeBreakdown = categories
            .map(c => {
              const percentage = calendar.analysis.totalMinutes > 0 
                ? Math.round(c.minutes / calendar.analysis.totalMinutes * 100) 
                : 0;
              return `• ${c.label}: ${this.formatDuration(c.minutes)} (${percentage}%)`;
            })
            .join('\n');
          
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**⏱️ 时间分配**\n${timeBreakdown}`
            }
          });
        }
      }

      elements.push({ tag: 'hr' });
    }

    // ===== 6. 本周对比 =====
    if (weekComparison?.changes) {
      const { changes, currentWeek } = weekComparison;
      
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**📈 本周对比上周**'
        }
      });

      // 变化指标
      const commitArrow = changes.commits > 0 ? '📈' : changes.commits < 0 ? '📉' : '➡️';
      const codeArrow = changes.additions > 0 ? '📈' : changes.additions < 0 ? '📉' : '➡️';
      
      elements.push({
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Commits**\n${commitArrow} ${changes.commits > 0 ? '+' : ''}${changes.commits}%`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**代码量**\n${codeArrow} ${changes.additions > 0 ? '+' : ''}${changes.additions}%`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**本周提交**\n${currentWeek.totalCommits} 次`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**本周新增**\n+${currentWeek.totalAdditions} 行`
            }
          }
        ]
      });

      elements.push({ tag: 'hr' });
    }

    // ===== 7. 洞察与建议 =====
    if (efficiency?.insights?.length > 0) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**💡 今日洞察**'
        }
      });

      const insightList = efficiency.insights
        .slice(0, 3)
        .map(i => `• ${i}`)
        .join('\n');

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: insightList
        }
      });

      elements.push({ tag: 'hr' });
    }

    // ===== 8. 明日建议 =====
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: '**🎯 明日建议**'
      }
    });

    const suggestions = ['• 回顾今日完成的工作', '• 检查 pending 的 PR 和 issues', '• 规划明日重点任务'];
    
    // 根据日程添加智能建议
    if (calendar?.analysis) {
      const meeting = calendar.analysis.byCategory?.meeting;
      const coding = calendar.analysis.byCategory?.coding;
      
      if (meeting?.minutes > 240) {
        suggestions.push('• 📅 今日会议时间较长，明日建议预留更多专注开发时间');
      }
      if (coding?.minutes < 120) {
        suggestions.push('• 💻 今日开发时间较少，明日可安排更多编码任务');
      }
    }

    // 基于效率评分的建议
    if (efficiency?.suggestions) {
      const highPriority = efficiency.suggestions.filter(s => s.priority === 'high');
      for (const sug of highPriority.slice(0, 2)) {
        suggestions.push(`• ${sug.text}`);
      }
    }

    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: suggestions.slice(0, 5).join('\n')
      }
    });

    // ===== 9. 页脚 =====
    elements.push({ tag: 'hr' });
    elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: `由 每日工作智能摘要工具 自动生成 · ${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}`
        }
      ]
    });

    // 提取标题和日期
    const title = '📋 每日工作摘要';
    const dateStr = new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      timeZone: 'Asia/Shanghai'
    });

    // 根据效率评分选择主题色
    const score = efficiency?.score || 0;
    let template = 'blue';
    if (score >= 80) template = 'green';
    else if (score >= 60) template = 'blue';
    else if (score >= 40) template = 'orange';
    else template = 'red';

    return {
      config: {
        wide_screen_mode: true,
        enable_forward: true
      },
      header: {
        title: {
          tag: 'plain_text',
          content: title
        },
        subtitle: {
          tag: 'plain_text',
          content: dateStr
        },
        template
      },
      elements
    };
  }

  /**
   * 生成进度条
   */
  generateProgressBar(score) {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * 格式化时长
   */
  formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0分钟';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }
}
