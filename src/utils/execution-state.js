/**
 * Execution State 工具
 *
 * 負責追蹤系統執行狀態,支援崩潰恢復檢測（FR-030）
 * - 記錄當前階段、開始時間、處理項數
 * - 寫入 data/execution-state.json
 * - 提供恢復檢測邏輯
 */

import {
  readExecutionState,
  writeExecutionState,
  deleteExecutionState
} from './file-manager.js';

/**
 * 執行階段枚舉
 */
export const ExecutionStage = {
  COLLECTING: 'collecting',
  DEDUPLICATING: 'deduplicating',
  FILTERING: 'filtering',
  SUMMARIZING: 'summarizing',
  GENERATING: 'generating'
};

/**
 * 產生執行 ID
 * 格式: exec_YYYYMMDD_HHMM
 * @returns {string} 執行 ID
 */
export const generateExecutionId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return `exec_${year}${month}${day}_${hour}${minute}`;
};

/**
 * 建立新的執行狀態
 * @param {string} stage - 執行階段
 * @returns {Object} 執行狀態物件
 */
export const createExecutionState = (stage = ExecutionStage.COLLECTING) => ({
  execution_id: generateExecutionId(),
  started_at: new Date().toISOString(),
  current_stage: stage,
  items_collected: 0,
  items_processed: 0,
  last_updated: new Date().toISOString()
});

/**
 * 更新執行狀態
 * @param {Object} state - 現有執行狀態
 * @param {Object} updates - 要更新的欄位
 * @returns {Object} 更新後的執行狀態
 */
export const updateExecutionState = (state, updates) => ({
  ...state,
  ...updates,
  last_updated: new Date().toISOString()
});

/**
 * 儲存執行狀態到檔案
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} state - 執行狀態物件
 * @returns {Promise<void>}
 */
export const saveExecutionState = async (dataDir, state) => {
  await writeExecutionState(dataDir, state);
};

/**
 * 載入執行狀態
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<Object|null>} 執行狀態物件或 null
 */
export const loadExecutionState = async (dataDir) => {
  return await readExecutionState(dataDir);
};

/**
 * 清除執行狀態（執行完成或使用者確認清理）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<void>}
 */
export const clearExecutionState = async (dataDir) => {
  await deleteExecutionState(dataDir);
};

/**
 * 檢測是否有未完成的執行任務
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<Object|null>} 未完成任務資訊或 null
 */
export const detectUnfinishedExecution = async (dataDir) => {
  const state = await loadExecutionState(dataDir);

  if (!state) {
    return null; // 無執行狀態,正常
  }

  const startedAt = new Date(state.started_at);
  const now = new Date();
  const hoursSinceStart = (now - startedAt) / (1000 * 60 * 60);

  // 若距離開始時間超過 2 小時,視為異常未完成任務
  if (hoursSinceStart > 2) {
    return {
      detected: true,
      execution_id: state.execution_id,
      stage: state.current_stage,
      started_at: state.started_at,
      hours_elapsed: Math.round(hoursSinceStart * 10) / 10,
      items_collected: state.items_collected,
      items_processed: state.items_processed
    };
  }

  return null; // 2 小時內,可能正在執行中
};

/**
 * 格式化未完成任務訊息
 * @param {Object} unfinishedInfo - 未完成任務資訊
 * @returns {string} 格式化的訊息
 */
export const formatUnfinishedMessage = (unfinishedInfo) => {
  const { execution_id, stage, started_at, hours_elapsed, items_collected, items_processed } = unfinishedInfo;

  const stageNames = {
    collecting: '蒐集階段',
    deduplicating: '去重階段',
    filtering: '過濾階段',
    summarizing: '摘要階段',
    generating: '報告產生階段'
  };

  const stageName = stageNames[stage] || stage;
  const startTime = new Date(started_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  return `
⚠️  偵測到未完成的執行任務

執行 ID: ${execution_id}
階段: ${stageName}
開始時間: ${startTime}
已過時間: ${hours_elapsed} 小時
已蒐集項數: ${items_collected}
已處理項數: ${items_processed}

這可能是因為上次執行時系統崩潰或被中斷。
建議清理此狀態並重新開始新的執行。
`;
};

/**
 * 開始追蹤執行狀態
 * @param {string} dataDir - 資料目錄路徑
 * @param {string} initialStage - 初始階段
 * @returns {Promise<Object>} 執行狀態物件
 */
export const startTracking = async (dataDir, initialStage = ExecutionStage.COLLECTING) => {
  const state = createExecutionState(initialStage);
  await saveExecutionState(dataDir, state);
  return state;
};

/**
 * 更新階段
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} currentState - 當前執行狀態
 * @param {string} newStage - 新階段
 * @returns {Promise<Object>} 更新後的執行狀態
 */
export const updateStage = async (dataDir, currentState, newStage) => {
  const updatedState = updateExecutionState(currentState, {
    current_stage: newStage
  });
  await saveExecutionState(dataDir, updatedState);
  return updatedState;
};

/**
 * 更新項目計數
 * @param {string} dataDir - 資料目錄路徑
 * @param {Object} currentState - 當前執行狀態
 * @param {number} itemsCollected - 已蒐集項數
 * @param {number} itemsProcessed - 已處理項數
 * @returns {Promise<Object>} 更新後的執行狀態
 */
export const updateItemCounts = async (dataDir, currentState, itemsCollected, itemsProcessed) => {
  const updatedState = updateExecutionState(currentState, {
    items_collected: itemsCollected,
    items_processed: itemsProcessed
  });
  await saveExecutionState(dataDir, updatedState);
  return updatedState;
};

/**
 * 完成追蹤（清除狀態檔案）
 * @param {string} dataDir - 資料目錄路徑
 * @returns {Promise<void>}
 */
export const finishTracking = async (dataDir) => {
  await clearExecutionState(dataDir);
};
