/**
 * File Manager 工具
 *
 * 負責 JSON 檔案的讀寫操作（items.json, dedup-index.json）
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * 讀取 JSON 檔案
 * @param {string} filePath - 檔案路徑
 * @param {Object} defaultValue - 檔案不存在時的預設值
 * @returns {Promise<Object>} 解析後的 JSON 物件
 */
export const readJsonFile = async (filePath, defaultValue = null) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 檔案不存在,返回預設值
      return defaultValue;
    }
    throw new Error(`讀取檔案失敗 (${filePath}): ${error.message}`);
  }
};

/**
 * 寫入 JSON 檔案
 * @param {string} filePath - 檔案路徑
 * @param {Object} data - 要寫入的資料
 * @param {Object} options - 寫入選項
 * @returns {Promise<void>}
 */
export const writeJsonFile = async (filePath, data, options = {}) => {
  const { indent = 2, createDir = true } = options;

  try {
    // 確保目錄存在
    if (createDir) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // 寫入檔案
    const jsonString = JSON.stringify(data, null, indent);
    await fs.writeFile(filePath, jsonString, 'utf-8');
  } catch (error) {
    throw new Error(`寫入檔案失敗 (${filePath}): ${error.message}`);
  }
};

/**
 * 讀取資訊項目列表（items.json）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<Object>} 資訊項目物件 { items: [], metadata: {} }
 */
export const readItems = async (dataDir) => {
  const filePath = path.join(dataDir, 'items.json');
  const defaultValue = {
    items: [],
    metadata: {
      version: '1.0.0',
      date: new Date().toISOString().split('T')[0],
      total_items: 0,
      items_by_tier: { '1': 0, '2': 0, '3': 0 }
    }
  };

  return await readJsonFile(filePath, defaultValue);
};

/**
 * 寫入資訊項目列表（items.json）
 * @param {string} dataDir - 資料目錄路徑
 * @param {Array} items - 資訊項目陣列
 * @returns {Promise<void>}
 */
export const writeItems = async (dataDir, items) => {
  const filePath = path.join(dataDir, 'items.json');

  // 計算各層級項數
  const itemsByTier = { '1': 0, '2': 0, '3': 0 };
  items.forEach(item => {
    const tier = item.source.tier.toString();
    itemsByTier[tier] = (itemsByTier[tier] || 0) + 1;
  });

  const data = {
    items,
    metadata: {
      version: '1.0.0',
      date: new Date().toISOString().split('T')[0],
      total_items: items.length,
      items_by_tier: itemsByTier
    }
  };

  await writeJsonFile(filePath, data);
};

/**
 * 讀取去重索引（dedup-index.json）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<Object>} 去重索引物件
 */
export const readDedupIndex = async (dataDir) => {
  const filePath = path.join(dataDir, 'dedup-index.json');
  const defaultValue = {
    title_signatures: {},
    content_fingerprints: {},
    metadata: {
      dedup_algorithm: 'hybrid',
      similarity_threshold: 0.8,
      fingerprint_algorithm: 'hybrid',
      last_updated: new Date().toISOString()
    }
  };

  return await readJsonFile(filePath, defaultValue);
};

/**
 * 寫入去重索引（dedup-index.json）
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} index - 去重索引物件
 * @returns {Promise<void>}
 */
export const writeDedupIndex = async (dataDir, index) => {
  const filePath = path.join(dataDir, 'dedup-index.json');

  // 更新最後更新時間
  index.metadata = {
    ...index.metadata,
    last_updated: new Date().toISOString()
  };

  await writeJsonFile(filePath, index);
};

/**
 * 讀取執行狀態（execution-state.json）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<Object|null>} 執行狀態物件或 null
 */
export const readExecutionState = async (dataDir) => {
  const filePath = path.join(dataDir, 'execution-state.json');
  return await readJsonFile(filePath, null);
};

/**
 * 寫入執行狀態（execution-state.json）
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} state - 執行狀態物件
 * @returns {Promise<void>}
 */
export const writeExecutionState = async (dataDir, state) => {
  const filePath = path.join(dataDir, 'execution-state.json');

  // 更新最後更新時間
  state.last_updated = new Date().toISOString();

  await writeJsonFile(filePath, state);
};

/**
 * 刪除執行狀態檔案
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<void>}
 */
export const deleteExecutionState = async (dataDir) => {
  const filePath = path.join(dataDir, 'execution-state.json');

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`刪除執行狀態檔案失敗: ${error.message}`);
    }
    // 檔案不存在時忽略錯誤
  }
};

/**
 * 刪除檔案
 * @param {string} filePath - 檔案路徑
 * @returns {Promise<void>}
 */
export const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`刪除檔案失敗 (${filePath}): ${error.message}`);
    }
    // 檔案不存在時忽略錯誤
  }
};

/**
 * 備份檔案
 * @param {string} filePath - 原始檔案路徑
 * @param {string} backupSuffix - 備份後綴（預設 ".backup"）
 * @returns {Promise<void>}
 */
export const backupFile = async (filePath, backupSuffix = '.backup') => {
  try {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    const backupPath = path.join(dir, `${base}${backupSuffix}${ext}`);

    await fs.copyFile(filePath, backupPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`備份檔案失敗 (${filePath}): ${error.message}`);
    }
    // 原始檔案不存在時忽略錯誤
  }
};

/**
 * 檢查檔案是否存在
 * @param {string} filePath - 檔案路徑
 * @returns {Promise<boolean>} 是否存在
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * 讀取最後執行時間記錄（.lastrun）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<string|null>} ISO 8601 格式的時間字串或 null
 */
export const readLastRunTime = async (dataDir) => {
  const filePath = path.join(dataDir, '.lastrun');

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`讀取最後執行時間失敗: ${error.message}`);
  }
};

/**
 * 寫入最後執行時間記錄（.lastrun）
 * @param {string} dataDir - 資料目錄路徑
 * @param {string} timestamp - ISO 8601 格式的時間字串
 * @returns {Promise<void>}
 */
export const writeLastRunTime = async (dataDir, timestamp) => {
  const filePath = path.join(dataDir, '.lastrun');

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, timestamp, 'utf-8');
};
