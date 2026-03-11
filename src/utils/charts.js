/**
 * ASCII/Unicode 图表工具
 */

export class ChartUtil {
  /**
   * 生成横向条形图
   */
  static horizontalBar(data, options = {}) {
    const { maxWidth = 30, suffix = '' } = options;
    const maxValue = Math.max(...data.map(d => d.value));
    
    const lines = [];
    const maxLabelWidth = Math.max(...data.map(d => d.label.length));
    
    for (const item of data) {
      const barLength = maxValue > 0 
        ? Math.round((item.value / maxValue) * maxWidth) 
        : 0;
      const bar = '█'.repeat(barLength);
      const spaces = ' '.repeat(maxLabelWidth - item.label.length);
      const valueStr = String(item.value).padStart(4);
      
      lines.push(`${item.label}${spaces} │${bar} ${valueStr}${suffix}`);
    }
    
    return lines.join('\n');
  }

  /**
   * 生成垂直柱状图
   */
  static verticalBar(data, options = {}) {
    const { height = 10, showValues = true } = options;
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    
    const lines = [];
    
    // 顶部边框
    lines.push('┌' + '─'.repeat(data.length * 4 - 1) + '┐');
    
    // 柱子
    for (let row = height; row > 0; row--) {
      let line = '│';
      for (const item of data) {
        const barHeight = maxValue > 0 
          ? Math.round(((item.value - minValue) / range) * height) 
          : 0;
        line += barHeight >= row ? ' ▓▓ ' : '    ';
      }
      line += '│';
      lines.push(line);
    }
    
    // 底部边框
    lines.push('├' + '─┬─'.repeat(data.length - 1) + '─┴─┤');
    
    // 标签行
    let labelLine = '│';
    for (const item of data) {
      const label = item.label.slice(0, 3).padStart(2).padEnd(3);
      labelLine += ` ${label}│`;
    }
    lines.push(labelLine);
    
    // 数值行
    if (showValues) {
      let valueLine = '│';
      for (const item of data) {
        const value = String(item.value).slice(0, 3).padStart(2).padEnd(3);
        valueLine += ` ${value}│`;
      }
      lines.push(valueLine);
    }
    
    lines.push('└' + '───┴'.repeat(data.length - 1) + '───┘');
    
    return lines.join('\n');
  }

  /**
   * 生成饼图（使用 Unicode 扇形字符）
   */
  static pie(data, options = {}) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const lines = [];
    
    // 使用简单表格形式
    lines.push('');
    for (const item of data) {
      const percentage = total > 0 ? Math.round(item.value / total * 100) : 0;
      const barLength = Math.round(percentage / 5);
      const bar = '■'.repeat(barLength);
      lines.push(`${item.label.padEnd(12)} ${bar} ${percentage}%`);
    }
    
    return lines.join('\n');
  }

  /**
   * 生成折线图
   */
  static line(data, options = {}) {
    const { height = 8 } = options;
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    const lines = [];
    const width = data.length * 2 - 1;
    
    // 创建网格
    const grid = Array(height).fill(null).map(() => Array(width).fill(' '));
    
    // 绘制点
    const points = values.map((v, i) => ({
      x: i * 2,
      y: height - 1 - Math.round(((v - minValue) / range) * (height - 1))
    }));
    
    // 标记点
    for (const p of points) {
      if (p.y >= 0 && p.y < height) {
        grid[p.y][p.x] = '●';
      }
    }
    
    // 连接线
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      this.drawLine(grid, p1, p2);
    }
    
    // 输出
    lines.push('  ' + '┌' + '─'.repeat(width) + '┐');
    for (let y = 0; y < height; y++) {
      const valueLabel = y === 0 ? String(maxValue).padStart(2) : 
                        y === height - 1 ? String(minValue).padStart(2) : '  ';
      lines.push(`${valueLabel} │${grid[y].join('')}│`);
    }
    lines.push('  ' + '└' + '─'.repeat(width) + '┘');
    
    // 标签
    let labelLine = '     ';
    for (let i = 0; i < data.length; i++) {
      labelLine += data[i].label.slice(0, 1) + ' ';
    }
    lines.push(labelLine);
    
    return lines.join('\n');
  }

  /**
   * 在网格上绘制线条
   */
  static drawLine(grid, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    for (let i = 1; i < steps; i++) {
      const x = Math.round(p1.x + (dx * i / steps));
      const y = Math.round(p1.y + (dy * i / steps));
      
      if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
        if (grid[y][x] === ' ') {
          grid[y][x] = (Math.abs(dx) > Math.abs(dy)) ? '─' : '│';
        }
      }
    }
  }

  /**
   * 生成热力图
   */
  static heatmap(data, options = {}) {
    const blocks = ['░', '▒', '▓', '█'];
    const maxValue = Math.max(...data.map(d => d.value));
    
    const lines = [];
    for (const item of data) {
      const intensity = maxValue > 0 
        ? Math.min(Math.floor((item.value / maxValue) * blocks.length), blocks.length - 1)
        : 0;
      const block = blocks[intensity];
      lines.push(`${block} ${item.label.padEnd(15)} ${item.value}`);
    }
    
    return lines.join('\n');
  }

  /**
   * 生成对比箭头
   */
  static comparisonArrow(change) {
    if (change > 0) return `↑${change}%`;
    if (change < 0) return `↓${Math.abs(change)}%`;
    return '→0%';
  }

  /**
   * 生成进度条
   */
  static progressBar(current, max, width = 20) {
    const filled = max > 0 ? Math.round((current / max) * width) : 0;
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${max}`;
  }
}
