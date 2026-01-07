#!/usr/bin/env node

/**
 * AI & AI Coding 自動化情報助手 - 主程式
 *
 * 功能:
 * - 定時從三層級資訊來源蒐集 AI 與 AI Coding 相關資訊
 * - 使用 Google Gemini API 進行內容過濾、去重與摘要生成
 * - 產生結構化的繁體中文摘要報告
 */

// 載入環境變數（必須在最開始）
import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import fs from "fs/promises";
import { performDailyCleanup } from "./utils/data-cleaner.js";
import {
  detectUnfinishedExecution,
  formatUnfinishedMessage,
  clearExecutionState,
  startTracking,
  finishTracking,
} from "./utils/execution-state.js";
import {
  loadAndValidateConfig,
  getRequiredEnvVars,
} from "./utils/config-loader.js";
import {
  validateCoreEnvVars,
  validateSourceEnvVars,
} from "./utils/env-validator.js";
import logger, {
  createExecutionLog,
  finalizeExecutionLog,
  writeExecutionLog,
} from "./utils/logger.js";
import collectorOrchestrator from "./collectors/collector-orchestrator.js";
import geminiSummarizer from "./summarizers/gemini-summarizer.js";
import markdownGenerator from "./generators/markdown-generator.js";
import { deduplicate, updateDedupIndex } from "./filters/deduplicator.js";
import { filterRelevant } from "./filters/relevance-filter.js";
import { createEmailPusher } from "./push/email-pusher.js";

// ES6 模組中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定路徑
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const OUTPUT_DIR = path.join(ROOT_DIR, "output", "digests");
const LOGS_DIR = path.join(ROOT_DIR, "logs");
const CONFIG_FILE = path.join(CONFIG_DIR, "sources.json");

/**
 * 建立 readline 介面用於使用者輸入
 */
const createReadlineInterface = () =>
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

/**
 * 詢問使用者是否清理未完成的執行狀態
 * @param {Object} unfinishedInfo - 未完成任務資訊
 * @returns {Promise<boolean>} 是否清理
 */
const promptUserForCleanup = (unfinishedInfo) => {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    const message = formatUnfinishedMessage(unfinishedInfo);
    console.log(message);

    rl.question("是否要清理此狀態並重新開始? [Y/n]: ", (answer) => {
      rl.close();

      const normalized = answer.trim().toLowerCase();
      // 預設為 Yes (空白或 'y' 或 'yes')
      const shouldCleanup =
        normalized === "" || normalized === "y" || normalized === "yes";
      resolve(shouldCleanup);
    });
  });
};

/**
 * 檢測並處理未完成的執行任務
 * @returns {Promise<boolean>} 是否繼續執行
 */
const checkAndHandleUnfinishedExecution = async () => {
  try {
    const unfinishedInfo = await detectUnfinishedExecution(DATA_DIR);

    if (!unfinishedInfo) {
      // 無未完成任務,正常繼續
      return true;
    }

    logger.warn("偵測到未完成的執行任務");

    // 詢問使用者是否清理
    const shouldCleanup = await promptUserForCleanup(unfinishedInfo);

    if (shouldCleanup) {
      logger.info("清理未完成的執行狀態...");
      await clearExecutionState(DATA_DIR);
      logger.info("清理完成,準備開始新的執行");
      return true;
    } else {
      logger.info("使用者選擇不清理,系統退出");
      return false;
    }
  } catch (error) {
    logger.error("檢測未完成執行任務時發生錯誤:", error);
    // 發生錯誤時預設繼續執行
    return true;
  }
};

/**
 * 載入並驗證配置
 * @returns {Promise<Object>} 配置物件
 */
const loadConfiguration = async () => {
  try {
    logger.info("載入配置檔案...");

    // 載入並驗證配置檔案
    const config = loadAndValidateConfig(CONFIG_FILE, {
      filterEnabled: true, // 過濾停用的來源
      useCache: false, // 首次載入不使用快取
    });

    logger.info(`配置載入成功: 發現 ${config.sources.length} 個啟用的來源`);

    // 驗證配置中需要的環境變數
    const requiredEnvVars = getRequiredEnvVars(config);
    if (requiredEnvVars.length > 0) {
      logger.info(`驗證配置所需的環境變數: ${requiredEnvVars.join(", ")}`);
      validateSourceEnvVars(config);
    }

    return config;
  } catch (error) {
    logger.error("配置載入失敗:", error.message);
    throw error;
  }
};

/**
 * 主要執行流程
 *
 * Task: T037 [US1] 建立 src/index.js 主程式，整合蒐集 → 摘要 → 報告產生流程
 * Task: T038 [US1] 在 src/index.js 中實作命令列參數解析（--run-now 手動觸發）
 * Task: T039 [US1] 在 src/index.js 中實作每日清理觸發（系統啟動時檢查日期變更）
 * Task: T040 [US1] 在 src/index.js 中實作執行摘要輸出（總來源數、成功來源、總執行時間、最終項數）
 */
const main = async () => {
  const startTime = Date.now();
  let executionLog = null;

  try {
    logger.info("=== AI & AI Coding 自動化情報助手啟動 ===");

    // ===== 階段 0: 解析命令列參數 (T038) =====
    const args = process.argv.slice(2);
    const runNow = args.includes("--run-now");

    if (runNow) {
      logger.info("手動觸發執行模式 (--run-now)");
    }

    // ===== 階段 1: 恢復檢測 (T013b, T013c) =====
    const shouldContinue = await checkAndHandleUnfinishedExecution();

    if (!shouldContinue) {
      logger.info("系統退出");
      process.exit(0);
    }

    // ===== 階段 2: 每日清理 (T039) =====
    logger.info("檢查每日資料清理...");
    const cleanupResult = await performDailyCleanup(DATA_DIR, logger);

    if (cleanupResult.executed) {
      logger.info(
        `清理完成: 移除 ${cleanupResult.removedItemsCount} 則過期項目`
      );
    }

    // ===== 階段 3: 驗證環境變數 =====
    logger.info("驗證核心環境變數...");
    validateCoreEnvVars({
      requireGemini: true,
      requireGithub: true,
    });
    logger.info("環境變數驗證通過");

    // ===== 階段 4: 載入配置 (T019) =====
    const config = await loadConfiguration();

    // ===== 階段 5: 開始執行狀態追蹤 & 建立執行日誌 =====
    logger.info("開始執行狀態追蹤...");
    const executionState = await startTracking(DATA_DIR);
    const executionId = executionState.execution_id;
    logger.info(`執行 ID: ${executionId}`);

    // 建立執行日誌 (T034)
    executionLog = createExecutionLog(executionId);
    executionLog.execution.trigger = runNow ? "manual" : "scheduled";

    // ===== 階段 6: 蒐集資訊 (T022, T023) =====
    logger.info("開始蒐集資訊...");
    const collectionResult = await collectorOrchestrator.collectAll(
      config.sources,
      {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      }
    );

    logger.info(
      `蒐集完成: 成功 ${collectionResult.summary.success_count}/${collectionResult.summary.total_sources} 個來源，共 ${collectionResult.items.length} 則資訊`
    );

    // 計算各層級的來源統計（T060）
    const tierStats = [1, 2, 3].map((tier) => {
      const tierSources = collectionResult.sourceStats.filter(
        (s) => s.tier === tier
      );
      const successCount = tierSources.filter(
        (s) => s.status === "success"
      ).length;
      const failureCount = tierSources.filter(
        (s) => s.status === "failure"
      ).length;
      return {
        tier,
        total: tierSources.length,
        success: successCount,
        failure: failureCount,
        success_rate:
          tierSources.length > 0
            ? ((successCount / tierSources.length) * 100).toFixed(2) + "%"
            : "N/A",
      };
    });

    // 記錄層級統計
    executionLog.sources_by_tier = tierStats;
    logger.info("各層級來源統計:", tierStats);

    // 檢查是否有足夠的資訊
    if (collectionResult.items.length === 0) {
      logger.warn("⚠️  未蒐集到任何資訊，結束執行");
      await finishTracking(DATA_DIR);
      return;
    }

    if (collectionResult.items.length < 5) {
      logger.warn(
        `⚠️  蒐集到的資訊數量 (${collectionResult.items.length}) 少於最低要求 (5)，但繼續處理`
      );
    }

    // ===== 階段 7: 去重處理 (T053) =====
    logger.info("開始去重處理...");
    const dedupStartTime = Date.now();

    const dedupResult = await deduplicate(collectionResult.items, {
      titleThreshold: 0.8,
      contentThreshold: 0.8,
      hammingThreshold: 3,
    });

    const dedupDuration = Date.now() - dedupStartTime;
    logger.info(
      `去重完成: 保留 ${dedupResult.uniqueItems.length} 個項目，` +
        `移除 ${dedupResult.duplicates.length} 個重複項 (耗時 ${dedupDuration}ms)`
    );

    // 更新去重索引
    const dedupIndexPath = path.join(DATA_DIR, "dedup-index.json");
    await updateDedupIndex(dedupResult.uniqueItems, dedupIndexPath);

    // 更新執行日誌
    executionLog.deduplication = {
      status: "completed",
      items_before: collectionResult.items.length,
      items_after: dedupResult.uniqueItems.length,
      duplicates_removed: dedupResult.duplicates.length,
      duration_ms: dedupDuration,
      stats: dedupResult.stats,
    };

    // ===== 階段 8: 相關性過濾 (T054) =====
    logger.info("開始相關性過濾...");
    const filterStartTime = Date.now();

    const filterResult = await filterRelevant(dedupResult.uniqueItems, {
      minConfidence: 50,
      checkTitle: true,
      checkContent: true,
    });

    const filterDuration = Date.now() - filterStartTime;
    logger.info(
      `過濾完成: 保留 ${filterResult.relevantItems.length} 個相關項目，` +
        `過濾 ${filterResult.filteredOut.length} 個不相關項目 (耗時 ${filterDuration}ms)`
    );

    // 更新執行日誌
    executionLog.filtering = {
      status: "completed",
      items_before: dedupResult.uniqueItems.length,
      items_after: filterResult.relevantItems.length,
      filtered_out: filterResult.filteredOut.length,
      duration_ms: filterDuration,
      stats: filterResult.stats,
    };

    const filteredItems = filterResult.relevantItems;

    // ===== 階段 9: 摘要生成 (T024-T028) =====
    logger.info("開始生成摘要...");
    const summarizerStartTime = Date.now();

    // 初始化 Gemini Summarizer
    await geminiSummarizer.initialize(process.env.GEMINI_API_KEY);

    // 批次生成摘要
    const itemsWithSummary = await geminiSummarizer.summarizeBatch(
      filteredItems
    );

    const summarizerDuration = Date.now() - summarizerStartTime;
    logger.info(`摘要生成完成: 耗時 ${summarizerDuration}ms`);

    // 更新執行日誌
    executionLog.summarization.status = "completed";
    executionLog.summarization.items_processed = itemsWithSummary.length;
    executionLog.summarization.duration_ms = summarizerDuration;

    // ===== 階段 10: 報告產生 (T029-T033) =====
    logger.info("開始生成報告...");
    const reportStartTime = Date.now();

    const reportData = {
      items: itemsWithSummary,
      collectionStats: collectionResult.summary,
      dedupStats: executionLog.deduplication,
      filterStats: executionLog.filtering,
      summarizationStats: executionLog.summarization,
      executionSummary: {
        total_duration_ms: Date.now() - startTime,
      },
    };

    const reportMarkdown = markdownGenerator.generate(reportData);

    // 儲存報告
    const reportDate = new Date().toISOString().split("T")[0];
    const reportFileName = `${reportDate}-digest.md`;
    const reportPath = path.join(OUTPUT_DIR, reportFileName);

    await fs.writeFile(reportPath, reportMarkdown, "utf-8");

    const reportDuration = Date.now() - reportStartTime;
    logger.info(`報告產生完成: ${reportPath} (耗時 ${reportDuration}ms)`);

    // 更新執行日誌
    executionLog.report.status = "completed";
    executionLog.report.file_path = reportPath;
    executionLog.report.file_size_bytes = Buffer.byteLength(
      reportMarkdown,
      "utf-8"
    );
    executionLog.report.generated_at = new Date().toISOString();

    // ===== 階段 11: 推送報告（選填 - User Story 4）=====
    // T067 [US4] 整合推送流程（報告產生後 → 推送 → 記錄推送狀態到執行日誌）
    let pushResult = null;

    try {
      // 檢查是否設定了電子郵件推送環境變數
      const emailEnabled =
        process.env.EMAIL_SMTP_HOST &&
        process.env.EMAIL_SMTP_USER &&
        process.env.EMAIL_TO;

      if (emailEnabled) {
        logger.info("開始推送報告至電子郵件...");

        const emailPusher = createEmailPusher({
          host: process.env.EMAIL_SMTP_HOST,
          port: process.env.EMAIL_SMTP_PORT,
          user: process.env.EMAIL_SMTP_USER,
          password: process.env.EMAIL_SMTP_PASSWORD,
          from: process.env.EMAIL_FROM,
          to: process.env.EMAIL_TO,
        });

        // 推送報告並處理重試邏輯
        pushResult = await emailPusher.pushWithRetry(reportPath, reportDate);

        // 記錄推送結果到執行日誌
        executionLog.push = {
          status: pushResult.status,
          success: pushResult.success,
          attempts: pushResult.attempts,
          message_id: pushResult.messageId,
          error: pushResult.error || null,
          next_retry_at: pushResult.nextRetryAt || null,
          timestamp: new Date().toISOString(),
        };

        if (pushResult.success) {
          logger.info(`✅ 報告推送成功: ${process.env.EMAIL_TO}`);
        } else if (pushResult.status === "pending_retry") {
          logger.warn(`⚠️  報告推送失敗，已標記為待重試: ${pushResult.error}`);
        } else if (pushResult.status === "abandoned") {
          logger.error(`❌ 報告推送失敗，已放棄: ${pushResult.error}`);
        }
      } else {
        logger.info("報告推送: 未設定電子郵件配置，跳過");
        executionLog.push = {
          status: "skipped",
          reason: "Email configuration not set",
        };
      }
    } catch (pushError) {
      logger.error("推送報告時發生錯誤", { error: pushError.message });
      executionLog.push = {
        status: "error",
        error: pushError.message,
      };
    }

    // ===== 完成: 結束執行日誌並寫入檔案 (T034-T036) =====
    executionLog.summary.total_items_collected = collectionResult.items.length;
    executionLog.summary.final_items_count = itemsWithSummary.length;
    finalizeExecutionLog(executionLog);

    const logPath = writeExecutionLog(executionLog, LOGS_DIR);
    logger.info(`執行日誌已儲存: ${logPath}`);

    // 清除執行狀態
    await finishTracking(DATA_DIR);

    // ===== 執行摘要 (T040) =====
    const totalDuration = Date.now() - startTime;
    console.log("\n" + "=".repeat(60));
    console.log("📊 執行摘要");
    console.log("=".repeat(60));
    console.log(`✅ 總來源數: ${collectionResult.summary.total_sources}`);
    console.log(`✅ 成功來源: ${collectionResult.summary.success_count}`);
    console.log(`✅ 失敗來源: ${collectionResult.summary.failure_count}`);
    console.log(`✅ 蒐集項數: ${collectionResult.items.length}`);
    console.log(`✅ 最終項數: ${itemsWithSummary.length}`);
    console.log(`✅ 總執行時間: ${Math.round(totalDuration / 1000)} 秒`);
    console.log(`✅ 報告位置: ${reportPath}`);
    console.log("=".repeat(60));

    logger.info("=== 執行完成 ===");
  } catch (error) {
    console.error("\n❌ 執行過程發生錯誤:");
    console.error("訊息:", error.message || "未知錯誤");
    if (error.stack) {
      console.error("\n堆疊追蹤:");
      console.error(error.stack);
    }

    // 嘗試儲存錯誤日誌
    if (executionLog) {
      try {
        executionLog.execution.status = "failed";
        executionLog.execution.error = {
          message: error.message,
          stack: error.stack,
        };
        finalizeExecutionLog(executionLog);
        writeExecutionLog(executionLog, LOGS_DIR);
      } catch (logError) {
        console.error("儲存錯誤日誌失敗:", logError.message);
      }
    }

    process.exit(1);
  }
};

/**
 * 處理未捕獲的錯誤
 */
process.on("uncaughtException", (error) => {
  logger.error("未捕獲的例外:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("未處理的 Promise 拒絕:", reason);
  process.exit(1);
});

// 執行主程式
main();
