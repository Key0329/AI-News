/**
 * Environment Validator 工具
 *
 * 負責環境變數的驗證與檢查
 * - 驗證必要環境變數是否存在
 * - 驗證來源配置中標記的環境變數
 * - 提供環境變數狀態檢查功能
 */

/**
 * 遮蔽環境變數值（用於顯示）
 * @param {string} value - 原始值
 * @returns {string} 遮蔽後的值
 */
const maskValue = (value) => {
  if (!value || value.length < 8) {
    return '***';
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

/**
 * 驗證必要環境變數是否存在
 * @param {string[]} requiredVars - 必要環境變數名稱陣列
 * @throws {Error} 缺少環境變數時拋出錯誤
 */
export const validateRequiredEnvVars = (requiredVars = []) => {
  const missingVars = [];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    const errorMessage = `
❌ 缺少必要環境變數：

${missingVars.map(v => `  - ${v}`).join('\n')}

請設定這些環境變數後再執行系統。

建議步驟：
1. 複製 .env.example 為 .env
2. 編輯 .env 檔案，填入對應的 API 金鑰
3. 重新執行系統
    `.trim();

    throw new Error(errorMessage);
  }
};

/**
 * 驗證來源配置中標記的環境變數
 * @param {Object} config - 來源配置物件
 * @throws {Error} 缺少環境變數時拋出錯誤
 */
export const validateSourceEnvVars = (config) => {
  const missingVars = [];

  if (!config.sources || !Array.isArray(config.sources)) {
    return;
  }

  config.sources.forEach(source => {
    if (source.auth_required && source.auth_env_var) {
      if (!process.env[source.auth_env_var]) {
        missingVars.push({
          source: source.name,
          envVar: source.auth_env_var
        });
      }
    }
  });

  if (missingVars.length > 0) {
    const errorMessage = `
❌ 來源配置要求的環境變數缺失：

${missingVars.map(m => `  - ${m.envVar} (來源: ${m.source})`).join('\n')}

請設定這些環境變數後再執行系統。
    `.trim();

    throw new Error(errorMessage);
  }
};

/**
 * 驗證核心環境變數
 * @param {Object} options - 選項
 * @param {boolean} options.requireGemini - 是否必須提供 Gemini API Key（預設 true）
 * @param {boolean} options.requireGithub - 是否必須提供 GitHub Token（預設 true）
 * @throws {Error} 缺少環境變數時拋出錯誤
 */
export const validateCoreEnvVars = (options = {}) => {
  const { requireGemini = true, requireGithub = true } = options;

  const requiredVars = [];

  if (requireGemini) {
    requiredVars.push('GEMINI_API_KEY');
  }

  if (requireGithub) {
    requiredVars.push('GITHUB_TOKEN');
  }

  validateRequiredEnvVars(requiredVars);
};

/**
 * 取得環境變數值（帶預設值）
 * @param {string} varName - 環境變數名稱
 * @param {string} defaultValue - 預設值
 * @returns {string} 環境變數值或預設值
 */
export const getEnv = (varName, defaultValue = null) => process.env[varName] || defaultValue;

/**
 * 檢查核心環境變數並回傳狀態
 * @returns {Object[]} 環境變數狀態陣列
 */
export const checkCoreEnvVars = () => {
  const coreVars = [
    { name: 'GEMINI_API_KEY', required: true, description: 'Google Gemini API 金鑰' },
    { name: 'GITHUB_TOKEN', required: true, description: 'GitHub Personal Access Token' },
    { name: 'NEWSAPI_KEY', required: false, description: 'NewsAPI 金鑰（選填）' },
    { name: 'AI_NEWS_CONFIG_PATH', required: false, description: '配置檔案路徑（選填）' },
    { name: 'AI_NEWS_OUTPUT_PATH', required: false, description: '輸出目錄路徑（選填）' },
    { name: 'AI_NEWS_LOGS_PATH', required: false, description: '日誌目錄路徑（選填）' }
  ];

  return coreVars.map(v => ({
    ...v,
    exists: !!process.env[v.name],
    value: process.env[v.name] ? maskValue(process.env[v.name]) : null
  }));
};

/**
 * 檢查環境變數是否存在
 * @param {string} varName - 環境變數名稱
 * @returns {boolean} 是否存在
 */
export const hasEnvVar = (varName) => !!process.env[varName];

// 導出遮蔽函式供其他模組使用
export { maskValue };
