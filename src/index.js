import { GitHubDataSource } from './datasource/github.js';
import { FeishuDataSource } from './datasource/feishu.js';
import { GitLabDataSource } from './datasource/gitlab.js';
import { LocalProjectsDataSource } from './datasource/local-projects.js';
import { BrowserHistoryDataSource } from './datasource/browser-history.js';
import { ReportGenerator } from './generator/report.js';
import { FeishuPusher } from './pusher/feishu.js';
import { ConfigManager } from './utils/config.js';
import { StatsUtil } from './utils/stats.js';
import { Logger } from './utils/logger.js';

async function main() {
  const logger = new Logger();
  logger.info('🚀 启动每日工作智能摘要工具...');

  try {
    // 加载配置
    const config = await ConfigManager.load();
    logger.info('✅ 配置加载成功');

    // 初始化数据源
    const githubDS = config.github ? new GitHubDataSource(config.github) : null;
    const gitlabDS = config.gitlab ? new GitLabDataSource(config.gitlab) : null;
    const feishuDS = config.feishu ? new FeishuDataSource(config.feishu) : null;
    const localProjectsDS = config.localProjects?.enabled !== false 
      ? new LocalProjectsDataSource({
          username: config.github?.username,
          scanPaths: config.localProjects?.scanPaths || [process.cwd(), '/root/.openclaw/workspace'],
          maxDepth: config.localProjects?.maxDepth || 2,
          excludePatterns: config.localProjects?.excludePatterns
        })
      : null;
    const browserDS = config.browserHistory?.enabled 
      ? new BrowserHistoryDataSource(config.browserHistory)
      : null;

    // 初始化统计工具
    const statsUtil = new StatsUtil(config);

    // 收集数据
    logger.info('📊 正在收集数据...');
    const today = new Date();
    
    const dataPromises = [];
    
    if (githubDS) {
      dataPromises.push(
        githubDS.getTodayCommits(today)
          .then(data => { logger.info(`✅ GitHub: ${data.totalCommits} commits`); return data; })
          .catch(err => { logger.warn('⚠️ GitHub 获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    if (feishuDS) {
      dataPromises.push(
        feishuDS.getTodayEvents(today)
          .then(data => { logger.info(`✅ 飞书日程: ${data.totalEvents} 个事件`); return data; })
          .catch(err => { logger.warn('⚠️ 飞书日程获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    if (gitlabDS) {
      dataPromises.push(
        gitlabDS.getTodayActivity(today)
          .then(data => { logger.info(`✅ GitLab: ${data.totalCommits} commits, ${data.totalMRs} MRs`); return data; })
          .catch(err => { logger.warn('⚠️ GitLab 获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    if (localProjectsDS) {
      dataPromises.push(
        localProjectsDS.scanProjects(today)
          .then(data => { logger.info(`✅ 本地项目: ${data.activeProjects}/${data.totalProjects} 个活跃`); return data; })
          .catch(err => { logger.warn('⚠️ 本地项目扫描失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    if (browserDS) {
      dataPromises.push(
        browserDS.getTodayActivity(today)
          .then(data => { logger.info(`✅ 浏览器: ${data.totalVisits} 次访问`); return data; })
          .catch(err => { logger.warn('⚠️ 浏览器历史获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }

    // 获取周/月对比数据
    if (config.report?.includeWeeklyComparison !== false) {
      dataPromises.push(
        statsUtil.getWeekComparison()
          .then(data => { logger.info('✅ 周对比数据获取成功'); return data; })
          .catch(err => { logger.warn('⚠️ 周对比获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }

    if (config.report?.includeMonthlyComparison !== false) {
      dataPromises.push(
        statsUtil.getMonthComparison()
          .then(data => { logger.info('✅ 月对比数据获取成功'); return data; })
          .catch(err => { logger.warn('⚠️ 月对比获取失败:', err.message); return null; })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }

    // 等待所有数据
    const [
      githubData, 
      calendarData, 
      gitlabData, 
      localProjectsData, 
      browserData,
      weekComparison,
      monthComparison
    ] = await Promise.all(dataPromises);

    // 生成报告
    logger.info('📝 正在生成日报...');
    const generator = new ReportGenerator(config.report || {});
    const { report, efficiency } = generator.generate({
      date: today,
      github: githubData,
      gitlab: gitlabData,
      calendar: calendarData,
      localProjects: localProjectsData,
      browser: browserData,
      weekComparison,
      monthComparison,
      projects: config.projects
    });

    // 输出到控制台
    console.log('\n' + '═'.repeat(60));
    console.log(report);
    console.log('═'.repeat(60) + '\n');

    // 推送到飞书
    if (config.feishu?.webhookUrl) {
      logger.info('📤 正在推送到飞书...');
      const pusher = new FeishuPusher(config.feishu);
      await pusher.push(report, {
        github: githubData,
        calendar: calendarData,
        localProjects: localProjectsData,
        weekComparison,
        monthComparison,
        efficiency
      });
      logger.info('✅ 推送成功！');
    }

    // 保存到本地文件
    await generator.saveToFile(report, today);
    logger.info('✅ 日报已保存到本地');

  } catch (error) {
    logger.error('❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
