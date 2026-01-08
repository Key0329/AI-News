/**
 * Source 資料模型與驗證規則
 *
 * 代表系統蒐集資訊的來源配置
 */

/**
 * 驗證 Source 資料結構
 * @param {Object} source - 待驗證的來源物件
 * @returns {{ valid: boolean, errors: string[] }} 驗證結果
 */
export const validateSource = (source) => {
  const errors = [];

  // 必填欄位檢查
  if (!source.name || typeof source.name !== 'string') {
    errors.push('name 欄位必填且必須為字串');
  } else if (source.name.length === 0 || source.name.length > 100) {
    errors.push('name 長度必須在 1-100 字元之間');
  }

  if (![1, 2, 3].includes(source.tier)) {
    errors.push('tier 必須為 1, 2 或 3');
  }

  if (!['rss', 'api', 'web'].includes(source.type)) {
    errors.push('type 必須為 rss, api 或 web');
  }

  if (!source.url || typeof source.url !== 'string') {
    errors.push('url 欄位必填且必須為字串');
  } else {
    try {
      new URL(source.url);
    } catch {
      errors.push('url 必須為有效的 URL 格式');
    }
  }

  if (typeof source.auth_required !== 'boolean') {
    errors.push('auth_required 欄位必填且必須為布林值');
  }

  if (source.auth_required && !source.auth_env_var) {
    errors.push('當 auth_required=true 時，auth_env_var 欄位必填');
  }

  if (typeof source.enabled !== 'boolean') {
    errors.push('enabled 欄位必填且必須為布林值');
  }

  if (typeof source.max_items !== 'number') {
    errors.push('max_items 欄位必填且必須為數字');
  } else if (source.max_items < 1 || source.max_items > 100) {
    errors.push('max_items 必須在 [1, 100] 範圍內');
  }

  if (typeof source.timeout_ms !== 'number') {
    errors.push('timeout_ms 欄位必填且必須為數字');
  } else if (source.timeout_ms < 1000 || source.timeout_ms > 60000) {
    errors.push('timeout_ms 必須在 [1000, 60000] 範圍內');
  }

  // 選填欄位驗證
  if (source.auth_env_var !== undefined && typeof source.auth_env_var !== 'string') {
    errors.push('auth_env_var 必須為字串（若提供）');
  }

  if (source.search_keywords !== undefined && !Array.isArray(source.search_keywords)) {
    errors.push('search_keywords 必須為陣列（若提供）');
  }

  if (source.api_params !== undefined && typeof source.api_params !== 'object') {
    errors.push('api_params 必須為物件（若提供）');
  }

  if (source.last_success_at !== undefined && source.last_success_at !== null) {
    const date = new Date(source.last_success_at);
    if (isNaN(date.getTime())) {
      errors.push('last_success_at 必須為有效的 ISO 8601 格式（若提供）');
    }
  }

  if (source.last_error_type !== undefined && source.last_error_type !== null) {
    const validErrorTypes = ['connection', 'auth', 'parse', 'timeout', 'other'];
    if (!validErrorTypes.includes(source.last_error_type)) {
      errors.push(`last_error_type 必須為以下值之一: ${validErrorTypes.join(', ')}`);
    }
  }

  if (source.capabilities !== undefined && typeof source.capabilities !== 'object') {
    errors.push('capabilities 必須為物件（若提供）');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 建立新的 Source 配置
 * @param {Object} data - 來源資料
 * @returns {Object} 標準化的 Source 物件
 */
export const createSource = (data) => ({
  // 識別欄位
  name: data.name,

  // 分類欄位
  tier: data.tier,
  type: data.type,

  // 連線欄位
  url: data.url,
  auth_required: data.auth_required || false,
  auth_env_var: data.auth_env_var,

  // 查詢欄位（API 專用）
  search_keywords: data.search_keywords,
  api_params: data.api_params,

  // 控制欄位
  enabled: data.enabled !== undefined ? data.enabled : true,
  max_items: data.max_items || 20,
  timeout_ms: data.timeout_ms || 30000,

  // 狀態欄位（系統自動維護）
  last_success_at: data.last_success_at,
  last_error_type: data.last_error_type,
  last_error_message: data.last_error_message,

  // 來源能力標記
  capabilities: data.capabilities || {
    provides_votes: false,
    provides_comments: false,
    provides_pubdate: true
  }
});

/**
 * 更新來源狀態（成功）
 * @param {Object} source - 來源物件
 * @returns {Object} 更新後的來源物件
 */
export const updateSourceSuccess = (source) => ({
  ...source,
  last_success_at: new Date().toISOString(),
  last_error_type: null,
  last_error_message: null
});

/**
 * 更新來源狀態（失敗）
 * @param {Object} source - 來源物件
 * @param {string} errorType - 錯誤類型
 * @param {string} errorMessage - 錯誤訊息
 * @returns {Object} 更新後的來源物件
 */
export const updateSourceError = (source, errorType, errorMessage) => ({
  ...source,
  last_error_type: errorType,
  last_error_message: errorMessage
});

/**
 * 檢查來源是否啟用
 * @param {Object} source - 來源物件
 * @returns {boolean} 是否啟用
 */
export const isSourceEnabled = (source) => source.enabled === true;

/**
 * 檢查來源是否需要認證
 * @param {Object} source - 來源物件
 * @returns {boolean} 是否需要認證
 */
export const requiresAuth = (source) => source.auth_required === true;

/**
 * 取得來源的認證 Token（從環境變數）
 * @param {Object} source - 來源物件
 * @returns {string|null} 認證 Token 或 null
 */
export const getAuthToken = (source) => {
  if (!requiresAuth(source)) return null;
  if (!source.auth_env_var) return null;

  return process.env[source.auth_env_var] || null;
};
