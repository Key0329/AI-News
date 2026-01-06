#!/usr/bin/env node

/**
 * AI & AI Coding 自動化情報助手 - 主程式
 *
 * 功能:
 * - 定時從三層級資訊來源蒐集 AI 與 AI Coding 相關資訊
 * - 使用 Google Gemini API 進行內容過濾、去重與摘要生成
 * - 產生結構化的繁體中文摘要報告
 */

import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { performDailyCleanup } from './utils/data-cleaner.js';
import {
  detectUnfinishedExecution,
  formatUnfinishedMessage,
  clearExecutionState,
  startTracking,
  finishTracking
} from './utils/execution-state.js';
import {
  loadAndValidateConfig,
  getRequiredEnvVars
} from './utils/config-loader.js';
import {
  validateCoreEnvVars,
  validateSourceEnvVars
} from './utils/env-validator.js';
import logger from './utils/logger.js';

// ES6 模組中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定路徑
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'digests');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const CONFIG_FILE = path.join(CONFIG_DIR, 'sources.json');

/**
 * 建立 readline 介面用於使用者輸入
 */
const createReadlineInterface = () => readline.createInterface({
  input: process.stdin,
  output: process.stdout
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

    rl.question('是否要清理此狀態並重新開始? [Y/n]: ', (answer) => {
      rl.close();

      const normalized = answer.trim().toLowerCase();
      // 預設為 Yes (空白或 'y' 或 'yes')
      const shouldCleanup = normalized === '' || normalized === 'y' || normalized === 'yes';
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

    logger.warn('偵測到未完成的執行任務');

    // 詢問使用者是否清理
    const shouldCleanup = await promptUserForCleanup(unfinishedInfo);

    if (shouldCleanup) {
      logger.info('清理未完成的執行狀態...');
      await clearExecutionState(DATA_DIR);
      logger.info('清理完成,準備開始新的執行');
      return true;
    } else {
      logger.info('使用者選擇不清理,系統退出');
      return false;
    }
  } catch (error) {
    logger.error('檢測未完成執行任務時發生錯誤:', error);
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
    logger.info('載入配置檔案...');

    // 載入並驗證配置檔案
    const config = loadAndValidateConfig(CONFIG_FILE, {
      filterEnabled: true,  // 過濾停用的來源
      useCache: false       // 首次載入不使用快取
    });

    logger.info(`配置載入成功: 發現 ${config.sources.length} 個啟用的來源`);

    // 驗證配置中需要的環境變數
    const requiredEnvVars = getRequiredEnvVars(config);
    if (requiredEnvVars.length > 0) {
      logger.info(`驗證配置所需的環境變數: ${requiredEnvVars.join(', ')}`);
      validateSourceEnvVars(config);
    }

    return config;
  } catch (error) {
    logger.error('配置載入失敗:', error.message);
    throw error;
  }
};

/**
 * 主要執行流程
 */
const main = async () => {
  const startTime = Date.now();

  try {
    logger.info('=== AI & AI Coding 自動化情報助手啟動 ===');

    // ===== 階段 0: 恢復檢測 (T013b, T013c) =====
    const shouldContinue = await checkAndHandleUnfinishedExecution();

    if (!shouldContinue) {
      logger.info('系統退出');
      process.exit(0);
    }

    // ===== 階段 1: 每日清理 =====
    logger.info('檢查每日資料清理...');
    const cleanupResult = await performDailyCleanup(DATA_DIR, logger);

    if (cleanupResult.executed) {
      logger.info(`清理完成: 移除 ${cleanupResult.removedItemsCount} 則過期項目`);
    }

    // ===== 階段 2: 驗證環境變數 =====
    logger.info('驗證核心環境變數...');
    validateCoreEnvVars({
      requireGemini: true,
      requireGithub: true
    });
    logger.info('環境變數驗證通過');

    // ===== 階段 3: 載入配置 (T019) =====
    const config = await loadConfiguration();

    // ===== 階段 4: 開始執行狀態追蹤 =====
    logger.info('開始執行狀態追蹤...');
    let executionState = await startTracking(DATA_DIR);
    logger.info(`執行 ID: ${executionState.execution_id}`);

    // TODO: 後續階段實作
    // ===== 階段 5: 蒐集資訊 =====
    // ===== 階段 6: 去重處理 =====
    // ===== 階段 7: 過濾內容 =====
    // ===== 階段 8: 摘要生成 =====
    // ===== 階段 9: 報告產生 =====
    // ===== 階段 10: 推送報告（選填）=====

    // ===== 完成: 清除執行狀態 =====
    await finishTracking(DATA_DIR);

    const totalDuration = Date.now() - startTime;
    logger.info(`=== 執行完成,總耗時 ${totalDuration}ms ===`);
  } catch (error) {
    logger.error('執行過程發生錯誤:', error);
    process.exit(1);
  }
};

/**
 * 處理未捕獲的錯誤
 */
process.on('uncaughtException', (error) => {
  logger.error('未捕獲的例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

// 執行主程式
main();
