/**
 * Data Cleaner 工具
 *
 * 負責每日資料清理邏輯
 * - 刪除過期的資訊項目（retention_until 已過期）
 * - 刪除前一日的去重索引
 * - 備份資料檔案
 */

import path from 'path';
import { isExpired } from '../models/news-item.js';
import {
  readItems,
  writeItems,
  deleteFile,
  backupFile,
  readLastRunTime,
  writeLastRunTime
} from './file-manager.js';

/**
 * 檢查是否需要執行清理（日期變更）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<boolean>} 是否需要清理
 */
export const shouldCleanup = async (dataDir) => {
  const lastRunTime = await readLastRunTime(dataDir);

  if (!lastRunTime) {
    // 第一次執行,需要清理
    return true;
  }

  const lastRunDate = new Date(lastRunTime).toISOString().split('T')[0];
  const todayDate = new Date().toISOString().split('T')[0];

  // 日期變更則需要清理
  return lastRunDate !== todayDate;
};

/**
 * 清理過期的資訊項目
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<{ removedCount: number, remainingCount: number }>} 清理結果
 */
export const cleanupExpiredItems = async (dataDir) => {
  const itemsData = await readItems(dataDir);
  const items = itemsData.items;

  const initialCount = items.length;

  // 過濾掉過期項目
  const validItems = items.filter(item => !isExpired(item));

  const removedCount = initialCount - validItems.length;

  // 寫回檔案
  if (removedCount > 0) {
    await writeItems(dataDir, validItems);
  }

  return {
    removedCount,
    remainingCount: validItems.length
  };
};

/**
 * 清理去重索引
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<void>}
 */
export const cleanupDedupIndex = async (dataDir) => {
  const dedupIndexPath = path.join(dataDir, 'dedup-index.json');
  await deleteFile(dedupIndexPath);
};

/**
 * 備份資料檔案
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<void>}
 */
export const backupDataFiles = async (dataDir) => {
  const itemsPath = path.join(dataDir, 'items.json');
  const dedupIndexPath = path.join(dataDir, 'dedup-index.json');

  await backupFile(itemsPath, '.backup');
  await backupFile(dedupIndexPath, '.backup');
};

/**
 * 執行完整的每日清理流程
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} logger - 日誌記錄器（選填）
 * @returns {Promise<Object>} 清理結果統計
 */
export const performDailyCleanup = async (dataDir, logger = console) => {
  const startTime = Date.now();

  try {
    // 檢查是否需要清理
    const needsCleanup = await shouldCleanup(dataDir);

    if (!needsCleanup) {
      logger.info('今日已執行過清理,跳過');
      return {
        executed: false,
        reason: '今日已執行過清理'
      };
    }

    logger.info('開始每日資料清理...');

    // 步驟 1: 備份資料檔案
    logger.info('備份資料檔案中...');
    await backupDataFiles(dataDir);

    // 步驟 2: 清理過期項目
    logger.info('清理過期資訊項目中...');
    const cleanupResult = await cleanupExpiredItems(dataDir);
    logger.info(`已移除 ${cleanupResult.removedCount} 則過期項目,保留 ${cleanupResult.remainingCount} 則有效項目`);

    // 步驟 3: 清理去重索引
    logger.info('清理去重索引中...');
    await cleanupDedupIndex(dataDir);

    // 步驟 4: 更新最後執行時間
    await writeLastRunTime(dataDir, new Date().toISOString());

    const durationMs = Date.now() - startTime;

    logger.info(`每日清理完成,耗時 ${durationMs}ms`);

    return {
      executed: true,
      removedItemsCount: cleanupResult.removedCount,
      remainingItemsCount: cleanupResult.remainingCount,
      durationMs
    };
  } catch (error) {
    logger.error('每日清理失敗:', error);
    throw error;
  }
};

/**
 * 強制執行清理（忽略日期檢查）
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} logger - 日誌記錄器（選填）
 * @returns {Promise<Object>} 清理結果統計
 */
export const forceCleanup = async (dataDir, logger = console) => {
  const startTime = Date.now();

  try {
    logger.info('開始強制清理...');

    // 備份資料檔案
    await backupDataFiles(dataDir);

    // 清理過期項目
    const cleanupResult = await cleanupExpiredItems(dataDir);
    logger.info(`已移除 ${cleanupResult.removedCount} 則過期項目`);

    // 清理去重索引
    await cleanupDedupIndex(dataDir);

    // 更新最後執行時間
    await writeLastRunTime(dataDir, new Date().toISOString());

    const durationMs = Date.now() - startTime;

    return {
      executed: true,
      removedItemsCount: cleanupResult.removedCount,
      remainingItemsCount: cleanupResult.remainingCount,
      durationMs
    };
  } catch (error) {
    logger.error('強制清理失敗:', error);
    throw error;
  }
};
