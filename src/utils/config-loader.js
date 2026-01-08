/**
 * Config Loader 工具
 *
 * 負責配置檔案的載入、驗證與熱重載
 * - 讀取並解析 sources.json
 * - 驗證配置格式與必要欄位
 * - 支援配置檔案熱重載
 * - 過濾停用的來源
 */

import fs from 'fs';
import path from 'path';
import { validateSource } from '../models/source.js';

// 快取配置與最後修改時間
let cachedConfig = null;
let cachedModifiedTime = 0;

/**
 * 載入並解析 sources.json 配置檔案
 * @param {string} configPath - 配置檔案路徑
 * @returns {Object} 解析後的配置物件
 */
export const loadSourcesConfig = (configPath) => {
  try {
    const fullPath = path.resolve(configPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`配置檔案不存在: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const config = JSON.parse(content);

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`配置檔案 JSON 格式錯誤: ${error.message}`);
    }
    throw error;
  }
};

/**
 * 驗證配置檔案格式與必要欄位
 * @param {Object} config - 配置物件
 * @throws {Error} 驗證失敗時拋出錯誤
 */
export const validateSourcesConfig = (config) => {
  const errors = [];

  // 檢查 version 欄位
  if (!config.version) {
    errors.push('缺少必要欄位: version');
  } else if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
    errors.push(`version 格式錯誤: ${config.version}（應為語義化版本，如 "1.0.0"）`);
  }

  // 檢查 sources 陣列
  if (!config.sources) {
    errors.push('缺少必要欄位: sources');
  } else if (!Array.isArray(config.sources)) {
    errors.push('sources 必須為陣列');
  } else if (config.sources.length < 3) {
    errors.push(`sources 陣列至少需要 3 個來源，目前僅有 ${config.sources.length} 個`);
  } else {
    // 檢查每個來源的必要欄位
    const sourceNames = new Set();

    config.sources.forEach((source, index) => {
      const prefix = `sources[${index}]`;

      // 驗證來源本身
      const validation = validateSource(source);
      if (!validation.valid) {
        validation.errors.forEach(error => {
          errors.push(`${prefix}: ${error}`);
        });
      }

      // 檢查名稱唯一性
      if (source.name) {
        if (sourceNames.has(source.name)) {
          errors.push(`${prefix}: 來源名稱重複 "${source.name}"`);
        }
        sourceNames.add(source.name);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`配置驗證失敗:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
};

/**
 * 過濾停用的來源
 * @param {Object} config - 配置物件
 * @returns {Object} 僅包含啟用來源的配置物件
 */
export const filterEnabledSources = (config) => {
  const enabledSources = config.sources.filter(source => source.enabled === true);

  return {
    ...config,
    sources: enabledSources
  };
};

/**
 * 檢查配置檔案是否變更並重新載入
 * @param {string} configPath - 配置檔案路徑
 * @param {number} lastModified - 上次修改時間戳記（ms）
 * @returns {Object|null} 若有變更則返回 { config, lastModified }，否則返回 null
 */
export const reloadConfigIfChanged = (configPath, lastModified = 0) => {
  try {
    const fullPath = path.resolve(configPath);
    const stats = fs.statSync(fullPath);
    const currentModified = stats.mtimeMs;

    if (currentModified > lastModified) {
      const config = loadSourcesConfig(configPath);
      validateSourcesConfig(config);
      return {
        config,
        lastModified: currentModified
      };
    }

    return null;
  } catch (error) {
    throw new Error(`配置重新載入失敗: ${error.message}`);
  }
};

/**
 * 載入並驗證配置（完整流程）
 * @param {string} configPath - 配置檔案路徑
 * @param {Object} options - 選項
 * @param {boolean} options.filterEnabled - 是否過濾停用的來源（預設 true）
 * @param {boolean} options.useCache - 是否使用快取（預設 false）
 * @returns {Object} 配置物件
 */
export const loadAndValidateConfig = (configPath, options = {}) => {
  const { filterEnabled = true, useCache = false } = options;

  // 檢查快取
  if (useCache && cachedConfig) {
    const reloaded = reloadConfigIfChanged(configPath, cachedModifiedTime);
    if (!reloaded) {
      // 配置未變更,使用快取
      return cachedConfig;
    }
    // 配置已變更,更新快取
    cachedConfig = reloaded.config;
    cachedModifiedTime = reloaded.lastModified;
  } else {
    // 首次載入或不使用快取
    const config = loadSourcesConfig(configPath);
    validateSourcesConfig(config);

    if (useCache) {
      cachedConfig = config;
      const stats = fs.statSync(path.resolve(configPath));
      cachedModifiedTime = stats.mtimeMs;
    }
  }

  const config = useCache ? cachedConfig : loadSourcesConfig(configPath);

  // 過濾停用的來源
  if (filterEnabled) {
    return filterEnabledSources(config);
  }

  return config;
};

/**
 * 取得配置檔案中所有需要的環境變數
 * @param {Object} config - 配置物件
 * @returns {string[]} 環境變數名稱陣列
 */
export const getRequiredEnvVars = (config) => {
  const envVars = new Set();

  config.sources.forEach(source => {
    if (source.auth_required && source.auth_env_var) {
      envVars.add(source.auth_env_var);
    }
  });

  return Array.from(envVars);
};

/**
 * 清除快取
 */
export const clearCache = () => {
  cachedConfig = null;
  cachedModifiedTime = 0;
};
