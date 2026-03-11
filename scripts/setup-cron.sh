#!/bin/bash
# 设置每日工作摘要定时任务（优化版）
# Usage: ./scripts/setup-cron.sh

echo "🕐 设置每日工作摘要定时任务"
echo ""

# 获取项目路径
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH=$(which node)

if [ -z "$NODE_PATH" ]; then
    echo "❌ 错误: 未找到 node，请确保 Node.js 已安装"
    exit 1
fi

echo "项目路径: $PROJECT_DIR"
echo "Node 路径: $NODE_PATH"
echo ""

# 默认配置
DEFAULT_HOUR=8
DEFAULT_MINUTE=0

# 读取当前配置（如果存在）
CONFIG_FILE="$PROJECT_DIR/config/config.json"
if [ -f "$CONFIG_FILE" ]; then
    CRON_ENABLED=$(grep -o '"enabled":[[:space:]]*[a-z]*' "$CONFIG_FILE" | grep -o '[a-z]*$' || echo "true")
    SCHEDULE=$(grep -o '"schedule":[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4 || echo "")
    
    if [ -n "$SCHEDULE" ]; then
        DEFAULT_MINUTE=$(echo "$SCHEDULE" | cut -d' ' -f1)
        DEFAULT_HOUR=$(echo "$SCHEDULE" | cut -d' ' -f2)
    fi
fi

# 选择定时时间
echo "选择日报生成时间:"
echo "1) 每天 08:00 (推荐)"
echo "2) 每天 08:30"
echo "3) 每天 09:00"
echo "4) 每天 18:00 (下班前)"
echo "5) 每天 19:00"
echo "6) 自定义"
echo "7) 取消定时任务"
read -p "请选择 (1-7) [默认: 1]: " choice
choice=${choice:-1}

case $choice in
    1) CRON_TIME="0 8 * * *" ;;
    2) CRON_TIME="30 8 * * *" ;;
    3) CRON_TIME="0 9 * * *" ;;
    4) CRON_TIME="0 18 * * *" ;;
    5) CRON_TIME="0 19 * * *" ;;
    6) 
        read -p "输入分钟 (0-59) [默认: 0]: " minute
        minute=${minute:-0}
        read -p "输入小时 (0-23) [默认: 8]: " hour
        hour=${hour:-8}
        CRON_TIME="$minute $hour * * *"
        ;;
    7)
        echo ""
        echo "🗑️ 正在取消定时任务..."
        (crontab -l 2>/dev/null | grep -v "daily-work-summary") | crontab -
        echo "✅ 定时任务已取消"
        exit 0
        ;;
    *) 
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "定时规则: $CRON_TIME"
echo ""

# 生成 cron 任务 - 使用更健壮的日志路径
LOG_FILE="$PROJECT_DIR/logs/cron.log"
mkdir -p "$(dirname "$LOG_FILE")"

# 创建执行脚本
RUN_SCRIPT="$PROJECT_DIR/scripts/run-daily.sh"
cat > "$RUN_SCRIPT" << 'EOF'
#!/bin/bash
# 每日工作摘要执行脚本

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/cron-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

echo "========================================" >> "$LOG_FILE"
echo "启动时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

cd "$PROJECT_DIR"
/usr/bin/node src/index.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "退出码: $EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 清理旧日志（保留30天）
find "$LOG_DIR" -name "cron-*.log" -mtime +30 -delete 2>/dev/null

exit $EXIT_CODE
EOF

chmod +x "$RUN_SCRIPT"

# 生成 cron 任务
CRON_JOB="$CRON_TIME $RUN_SCRIPT"

echo "将添加以下定时任务:"
echo "$CRON_JOB"
echo ""
echo "日志路径: $LOG_DIR/cron-YYYY-MM-DD.log"
echo ""

read -p "确认添加? (y/n) [默认: y]: " confirm
confirm=${confirm:-y}

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    # 添加到 crontab（先移除旧的）
    (crontab -l 2>/dev/null | grep -v "daily-work-summary"; echo "$CRON_JOB") | crontab -
    echo ""
    echo "✅ 定时任务已添加"
    echo ""
    echo "当前定时任务:"
    crontab -l | grep "daily-work-summary"
    echo ""
    echo "📋 使用说明:"
    echo "  • 查看日志: tail -f $LOG_DIR/cron-\$(date +%Y-%m-%d).log"
    echo "  • 手动运行: $RUN_SCRIPT"
    echo "  • 编辑配置: $CONFIG_FILE"
    echo "  • 取消任务: ./scripts/setup-cron.sh 然后选择 7"
    echo ""
    echo "🚀 首次测试运行..."
    cd "$PROJECT_DIR" && $NODE_PATH src/index.js
else
    echo "❌ 已取消"
fi
