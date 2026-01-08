/**
 * Logger 工具
 *
 * 負責日誌記錄與執行日誌管理
 * - 遮蔽敏感資訊（API 金鑰、Token）
 * - 建立結構化執行日誌
 * - 寫入 JSON 格式日誌檔案
 */

import fs from "fs";
import path from "path";

/**
 * 遮蔽敏感資訊（API 金鑰、Token、密碼）
 * @param {string} text - 原始文字
 * @returns {string} 遮蔽後的文字
 */
export const maskSensitiveInfo = (text) => {
  if (!text || typeof text !== "string") {
    return text;
  }

  // API Token 格式: ghp_abc123...xyz789 -> ghp_abc1***xyz9
  text = text.replace(
    /ghp_([a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})/g,
    "ghp_$1***$2"
  );

  // Generic API Key 格式: 前 4 碼 + *** + 後 4 碼
  text = text.replace(
    /([a-zA-Z0-9]{4})[a-zA-Z0-9]{20,}([a-zA-Z0-9]{4})/g,
    "$1***$2"
  );

  // Bearer Token
  text = text.replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, "Bearer ***");

  // Email 遮蔽: user@domain.com -> ***@***.***
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "***@***.***"
  );

  // Password in JSON/URL
  text = text.replace(/"password"\s*:\s*"[^"]+"/g, '"password": "***"');
  text = text.replace(/password=[^&\s]+/g, "password=***");

  return text;
};

/**
 * 建立 ExecutionLog 物件
 * @param {string} executionId - 執行 ID
 * @returns {Object} 初始化的 ExecutionLog
 */
export const createExecutionLog = (executionId) => ({
  execution: {
    id: executionId,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_ms: 0,
    trigger: "manual", // 或 'scheduled'
  },
  sources: [],
  summarization: {
    status: "pending",
    items_processed: 0,
    items_failed: 0,
    duration_ms: 0,
    gemini_api_calls: 0,
  },
  deduplication: {
    total_items: 0,
    duplicates_found: 0,
    duplicates_removed: 0,
    algorithms_used: [],
  },
  filtering: {
    total_items: 0,
    items_filtered_out: 0,
    reason_breakdown: {},
  },
  report: {
    status: "pending",
    file_path: null,
    file_size_bytes: 0,
    generated_at: null,
  },
  push: {
    status: "pending",
    channel: null,
    attempts: 0,
    last_attempt_at: null,
    next_retry_at: null,
  },
  summary: {
    total_sources: 0,
    successful_sources: 0,
    failed_sources: 0,
    success_rate: 0,
    total_items_collected: 0,
    final_items_count: 0,
    sensitive_data_masked: true,
  },
});

/**
 * 新增來源執行記錄
 * @param {Object} log - ExecutionLog 物件
 * @param {Object} sourceResult - 來源執行結果
 */
export const addSourceLog = (log, sourceResult) => {
  log.sources.push({
    name: sourceResult.name,
    tier: sourceResult.tier,
    type: sourceResult.type,
    status: sourceResult.status,
    items_collected: sourceResult.items_collected || 0,
    items_after_dedup: sourceResult.items_after_dedup || 0,
    items_after_filter: sourceResult.items_after_filter || 0,
    duration_ms: sourceResult.duration_ms || 0,
    started_at: sourceResult.started_at,
    ended_at: sourceResult.ended_at,
    error_type: sourceResult.error_type || null,
    error_message: sourceResult.error_message
      ? maskSensitiveInfo(sourceResult.error_message)
      : null,
  });
};

/**
 * 完成 ExecutionLog 並計算統計
 * @param {Object} log - ExecutionLog 物件
 */
export const finalizeExecutionLog = (log) => {
  const endTime = new Date();
  log.execution.ended_at = endTime.toISOString();
  log.execution.duration_ms = endTime - new Date(log.execution.started_at);

  // 計算來源統計
  log.summary.total_sources = log.sources.length;
  log.summary.successful_sources = log.sources.filter(
    (s) => s.status === "success"
  ).length;
  log.summary.failed_sources = log.sources.filter(
    (s) => s.status === "failed"
  ).length;
  log.summary.success_rate =
    log.summary.total_sources > 0
      ? log.summary.successful_sources / log.summary.total_sources
      : 0;

  // 確保敏感資訊已遮蔽
  log.summary.sensitive_data_masked = true;
};

/**
 * 寫入執行日誌到檔案
 * @param {Object} log - ExecutionLog 物件
 * @param {string} logsPath - 日誌目錄路徑（預設: ./logs）
 * @returns {string} 日誌檔案路徑
 */
export const writeExecutionLog = (log, logsPath = "./logs") => {
  try {
    const logsDir = path.resolve(logsPath);

    // 確保日誌目錄存在
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 產生日誌檔名: YYYY-MM-DD-HH-MM.log
    const timestamp = new Date(log.execution.started_at);
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, "0");
    const day = String(timestamp.getDate()).padStart(2, "0");
    const hour = String(timestamp.getHours()).padStart(2, "0");
    const minute = String(timestamp.getMinutes()).padStart(2, "0");

    const filename = `${year}-${month}-${day}-${hour}-${minute}.log`;
    const filepath = path.join(logsDir, filename);

    // 遮蔽整個 log 物件中的敏感資訊
    const logContent = JSON.stringify(log, null, 2);
    const maskedContent = maskSensitiveInfo(logContent);

    fs.writeFileSync(filepath, maskedContent, "utf-8");

    return filepath;
  } catch (error) {
    console.error("❌ 寫入執行日誌失敗:", error.message);
    throw error;
  }
};

/**
 * 簡化版 logger 物件（模擬 console 介面）
 */
export const logger = {
  debug: (message, data = null) => {
    if (process.env.DEBUG === "true") {
      const output = data
        ? `🔍 ${message}\n${JSON.stringify(data, null, 2)}`
        : `🔍 ${message}`;
      console.log(maskSensitiveInfo(output));
    }
  },

  info: (message, data = null) => {
    const output = data
      ? `ℹ️  ${message}\n${JSON.stringify(data, null, 2)}`
      : `ℹ️  ${message}`;
    console.log(maskSensitiveInfo(output));
  },

  warn: (message, data = null) => {
    const output = data
      ? `⚠️  ${message}\n${JSON.stringify(data, null, 2)}`
      : `⚠️  ${message}`;
    console.warn(maskSensitiveInfo(output));
  },

  error: (message, data = null) => {
    const output = data
      ? `❌ ${message}\n${JSON.stringify(data, null, 2)}`
      : `❌ ${message}`;
    console.error(maskSensitiveInfo(output));
  },
};

// 為了與 console 兼容,也導出預設 logger
export default logger;
