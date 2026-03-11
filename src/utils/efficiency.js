/**
 * 工作效率评分工具
 * 基于代码提交、日程安排、专注时间等多维度计算效率分数
 */

export class EfficiencyScorer {
  constructor(config) {
    this.workHours = config?.workHours || { start: 9, end: 18 };
    this.timezone = config?.timezone || 'Asia/Shanghai';
  }

  /**
   * 计算综合效率评分
   */
  calculateScore(data) {
    const { github, calendar, localProjects, browser, weekComparison } = data;
    
    // 各维度得分 (0-100)
    const dimensions = {
      coding: this.calculateCodingScore(github, localProjects),
      focus: this.calculateFocusScore(calendar),
      consistency: this.calculateConsistencyScore(weekComparison),
      productivity: this.calculateProductivityScore(browser),
      balance: this.calculateBalanceScore(calendar)
    };

    // 权重配置
    const weights = {
      coding: 0.30,       // 代码贡献权重
      focus: 0.25,        // 专注度权重
      consistency: 0.20,  // 稳定性权重
      productivity: 0.15, // 生产力权重
      balance: 0.10       // 平衡度权重
    };

    // 计算加权总分
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [key, weight] of Object.entries(weights)) {
      if (dimensions[key] !== null) {
        totalScore += dimensions[key].score * weight;
        totalWeight += weight;
      }
    }

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    return {
      score: finalScore,
      grade: this.getGrade(finalScore),
      dimensions,
      insights: this.generateInsights(dimensions, finalScore),
      suggestions: this.generateSuggestions(dimensions)
    };
  }

  /**
   * 计算代码贡献得分
   */
  calculateCodingScore(github, localProjects) {
    const totalCommits = (github?.totalCommits || 0) + 
      (localProjects?.repositories?.reduce((sum, r) => sum + r.commits.length, 0) || 0);
    const totalAdditions = (github?.stats?.additions || 0) + (localProjects?.stats?.additions || 0);
    const totalDeletions = (github?.stats?.deletions || 0) + (localProjects?.stats?.deletions || 0);
    const totalChanges = totalAdditions + totalDeletions;

    // Commits 评分 (期望每天 5-10 commits)
    let commitScore = 0;
    if (totalCommits >= 10) commitScore = 100;
    else if (totalCommits >= 7) commitScore = 85;
    else if (totalCommits >= 5) commitScore = 70;
    else if (totalCommits >= 3) commitScore = 50;
    else if (totalCommits >= 1) commitScore = 30;
    else commitScore = 0;

    // 代码量评分 (期望每天 200-500 行变更)
    let linesScore = 0;
    if (totalChanges >= 500) linesScore = 100;
    else if (totalChanges >= 300) linesScore = 80;
    else if (totalChanges >= 150) linesScore = 60;
    else if (totalChanges >= 50) linesScore = 40;
    else if (totalChanges > 0) linesScore = 20;
    else linesScore = 0;

    // 综合评分 (commits 60%, lines 40%)
    const score = Math.round(commitScore * 0.6 + linesScore * 0.4);

    return {
      score,
      commits: totalCommits,
      linesChanged: totalChanges,
      details: `${totalCommits} commits, ${totalChanges} 行变更`
    };
  }

  /**
   * 计算专注度得分
   */
  calculateFocusScore(calendar) {
    if (!calendar?.analysis) {
      return { score: null, details: '无日程数据' };
    }

    const analysis = calendar.analysis;
    const totalMinutes = analysis.totalMinutes || 0;
    
    // 开发时间
    const codingMinutes = analysis.byCategory?.coding?.minutes || 0;
    // 会议时间
    const meetingMinutes = analysis.byCategory?.meeting?.minutes || 0;
    // 专注时间 (开发 + 深度工作)
    const focusMinutes = codingMinutes + (analysis.byCategory?.deepwork?.minutes || 0);

    // 专注比例评分 (专注时间 / 总日程时间)
    let focusRatio = totalMinutes > 0 ? focusMinutes / totalMinutes : 0;
    let focusScore = Math.round(focusRatio * 100);

    // 会议时间惩罚 (超过 4 小时扣分)
    if (meetingMinutes > 240) {
      const penalty = Math.min(30, Math.round((meetingMinutes - 240) / 30));
      focusScore = Math.max(0, focusScore - penalty);
    }

    // 活跃时间奖励
    if (totalMinutes >= 360) { // 6小时以上日程
      focusScore = Math.min(100, focusScore + 10);
    }

    return {
      score: focusScore,
      focusMinutes,
      meetingMinutes,
      totalMinutes,
      focusRatio: Math.round(focusRatio * 100),
      details: `专注 ${this.formatDuration(focusMinutes)}, 会议 ${this.formatDuration(meetingMinutes)}`
    };
  }

  /**
   * 计算稳定性得分 (基于周对比)
   */
  calculateConsistencyScore(weekComparison) {
    if (!weekComparison?.changes) {
      return { score: null, details: '无对比数据' };
    }

    const changes = weekComparison.changes;
    
    // Commits 变化
    const commitChange = changes.commits || 0;
    // Additions 变化
    const additionChange = changes.additions || 0;

    // 稳定性评分逻辑
    let score = 50; // 基础分

    // 提交稳定性 (小幅增长最好)
    if (commitChange >= 10 && commitChange <= 30) {
      score += 20; // 适度增长
    } else if (commitChange > 30 && commitChange <= 50) {
      score += 15; // 较大增长
    } else if (commitChange > 50) {
      score += 10; // 爆发增长 (可能不可持续)
    } else if (commitChange >= 0) {
      score += 15; // 保持稳定
    } else if (commitChange >= -20) {
      score += 10; // 小幅下降
    } else {
      score -= 5; // 大幅下降
    }

    // 代码量稳定性
    if (additionChange >= 0 && additionChange <= 50) {
      score += 20;
    } else if (additionChange > 50 && additionChange <= 100) {
      score += 15;
    } else if (additionChange > 100) {
      score += 10;
    } else if (additionChange >= -30) {
      score += 15;
    } else {
      score += 5;
    }

    // 代码质量指标 (additions/deletions 比例)
    const ratio = weekComparison.currentWeek?.totalAdditions / 
      (weekComparison.currentWeek?.totalDeletions || 1);
    if (ratio >= 1 && ratio <= 3) {
      score += 10; // 健康的增长比例
    }

    score = Math.min(100, Math.max(0, score));

    return {
      score,
      commitChange,
      additionChange,
      details: `提交 ${commitChange >= 0 ? '+' : ''}${commitChange}%, 代码 ${additionChange >= 0 ? '+' : ''}${additionChange}%`
    };
  }

  /**
   * 计算生产力得分 (基于浏览器历史)
   */
  calculateProductivityScore(browser) {
    if (!browser?.productivity) {
      return { score: null, details: '无浏览数据' };
    }

    const productivity = browser.productivity;
    const score = productivity.score || 0;
    const focusTime = productivity.focusTime || 0;

    return {
      score,
      focusTime,
      details: `专注时间 ${focusTime}h, 效率分 ${score}/100`
    };
  }

  /**
   * 计算工作平衡得分
   */
  calculateBalanceScore(calendar) {
    if (!calendar?.analysis) {
      return { score: null, details: '无日程数据' };
    }

    const categories = calendar.analysis.byCategory || {};
    const totalMinutes = calendar.analysis.totalMinutes || 0;

    if (totalMinutes === 0) {
      return { score: null, details: '无日程数据' };
    }

    // 计算各类别占比
    const categoryRatios = {};
    for (const [key, cat] of Object.entries(categories)) {
      categoryRatios[key] = totalMinutes > 0 ? cat.minutes / totalMinutes : 0;
    }

    // 平衡度计算 (熵值法)
    const activeCategories = Object.values(categoryRatios).filter(r => r > 0.05);
    let entropy = 0;
    
    if (activeCategories.length > 1) {
      for (const ratio of activeCategories) {
        if (ratio > 0) {
          entropy -= ratio * Math.log2(ratio);
        }
      }
      // 归一化到 0-100
      const maxEntropy = Math.log2(activeCategories.length);
      entropy = Math.round((entropy / maxEntropy) * 100);
    } else {
      entropy = activeCategories.length === 1 ? 30 : 0;
    }

    // 理想比例检查
    const meetingRatio = categoryRatios.meeting || 0;
    const codingRatio = categoryRatios.coding || 0;
    
    // 会议比例惩罚 (理想 < 30%)
    if (meetingRatio > 0.5) {
      entropy = Math.max(0, entropy - 20);
    } else if (meetingRatio > 0.3) {
      entropy = Math.max(0, entropy - 10);
    }

    // 开发比例奖励 (理想 > 40%)
    if (codingRatio > 0.4 && codingRatio < 0.7) {
      entropy = Math.min(100, entropy + 10);
    }

    return {
      score: entropy,
      categoryRatios,
      details: `${activeCategories.length} 类活动, 会议 ${Math.round(meetingRatio * 100)}%`
    };
  }

  /**
   * 获取等级
   */
  getGrade(score) {
    if (score >= 90) return { level: 'S', emoji: '🏆', desc: '卓越' };
    if (score >= 80) return { level: 'A', emoji: '🌟', desc: '优秀' };
    if (score >= 70) return { level: 'B', emoji: '👍', desc: '良好' };
    if (score >= 60) return { level: 'C', emoji: '💪', desc: '合格' };
    if (score >= 40) return { level: 'D', emoji: '📈', desc: '待提升' };
    return { level: 'E', emoji: '🎯', desc: '需改进' };
  }

  /**
   * 生成洞察
   */
  generateInsights(dimensions, totalScore) {
    const insights = [];

    // 代码贡献洞察
    if (dimensions.coding?.score >= 80) {
      insights.push('🎯 今日代码贡献突出，保持了高产出');
    } else if (dimensions.coding?.score < 30) {
      insights.push('💡 代码提交较少，可以考虑增加编码时间');
    }

    // 专注度洞察
    if (dimensions.focus?.meetingMinutes > 240) {
      insights.push('📅 会议时间较长，建议预留专注开发时段');
    }
    if (dimensions.focus?.focusRatio > 60) {
      insights.push('🔥 专注比例高，深度工作时间充足');
    }

    // 稳定性洞察
    if (dimensions.consistency?.commitChange > 30) {
      insights.push('📈 本周提交显著增长，保持势头！');
    } else if (dimensions.consistency?.commitChange < -20) {
      insights.push('⚠️ 本周提交下降，检查是否有阻塞');
    }

    // 平衡度洞察
    if (dimensions.balance?.score > 70) {
      insights.push('⚖️ 工作分配均衡，多维度发展');
    }

    if (insights.length === 0) {
      insights.push('📊 持续积累数据将获得更多洞察');
    }

    return insights;
  }

  /**
   * 生成建议
   */
  generateSuggestions(dimensions) {
    const suggestions = [];

    // 基于各维度给出具体建议
    if (dimensions.coding?.commits < 3) {
      suggestions.push({
        type: 'coding',
        priority: 'high',
        text: '建议增加代码提交频率，小步快跑更高效'
      });
    }

    if (dimensions.focus?.meetingMinutes > 240) {
      suggestions.push({
        type: 'focus',
        priority: 'medium',
        text: '会议时间超过4小时，建议减少不必要的会议'
      });
    }

    if (dimensions.balance?.score < 50) {
      suggestions.push({
        type: 'balance',
        priority: 'low',
        text: '工作类型单一，可以尝试更多维度的工作'
      });
    }

    if (dimensions.consistency?.commitChange < -10) {
      suggestions.push({
        type: 'consistency',
        priority: 'medium',
        text: '本周产出下降，检查是否有技术债或阻塞'
      });
    }

    // 通用建议
    suggestions.push({
      type: 'general',
      priority: 'low',
      text: '保持每日代码提交习惯，持续积累'
    });

    return suggestions.slice(0, 5);
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

// Test comment for file change verification
