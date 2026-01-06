/**
 * 蒐集編排器
 *
 * 功能：
 * - 協調多個來源的蒐集工作
 * - 控制並發數量（最多 5 個）
 * - 統一錯誤處理
 * - 收集並回傳所有蒐集結果
 *
 * Task: T022 [US1] 建立 src/collectors/collector-orchestrator.js，實作來源蒐集編排器（並發控制最多 5 個，超時 30 秒）
 * Task: T023 [US1] 在 collector-orchestrator.js 中實作錯誤處理（來源失敗不影響其他來源，記錄錯誤類型與訊息）
 */

import rssCollector from "./rss-collector.js";
import githubCollector from "./github-collector.js";
import logger from "../utils/logger.js";

/**
 * 蒐集編排器類別
 */
class CollectorOrchestrator {
  constructor() {
    this.maxConcurrency = 5; // 最大並發數
    this.defaultTimeout = 30000; // 預設超時 30 秒
  }

  /**
   * 執行所有來源的蒐集工作
   *
   * @param {Array} sources - 來源配置陣列
   * @param {Object} envVars - 環境變數（包含 GITHUB_TOKEN 等）
   * @returns {Promise<Object>} - 蒐集結果
   * @returns {Array} result.items - 所有蒐集到的資訊項目
   * @returns {Array} result.sourceStats - 各來源的統計資訊
   */
  async collectAll(sources, envVars = {}) {
    const startTime = Date.now();
    logger.info(`[Collector] 開始蒐集，共 ${sources.length} 個來源`);

    // 過濾已啟用的來源
    const enabledSources = sources.filter((s) => s.enabled !== false);
    logger.info(`[Collector] 已啟用來源: ${enabledSources.length} 個`);

    if (enabledSources.length === 0) {
      logger.warn("[Collector] 無已啟用的來源");
      return {
        items: [],
        sourceStats: [],
      };
    }

    // 分批執行（控制並發）
    const batches = this._createBatches(enabledSources, this.maxConcurrency);
    const allResults = [];

    for (let i = 0; i < batches.length; i++) {
      logger.info(
        `[Collector] 執行批次 ${i + 1}/${batches.length}，包含 ${
          batches[i].length
        } 個來源`
      );

      const batchResults = await Promise.all(
        batches[i].map((source) => this._collectFromSource(source, envVars))
      );

      allResults.push(...batchResults);
    }

    // 整理結果
    const items = [];
    const sourceStats = [];

    for (const result of allResults) {
      items.push(...result.items);
      sourceStats.push(result.stat);
    }

    const duration = Date.now() - startTime;
    const successCount = sourceStats.filter(
      (s) => s.status === "success"
    ).length;
    const failureCount = sourceStats.filter(
      (s) => s.status === "failure"
    ).length;

    logger.info(
      `[Collector] 蒐集完成: 成功 ${successCount}/${sources.length}，失敗 ${failureCount}，共 ${items.length} 則資訊，耗時 ${duration}ms`
    );

    return {
      items,
      sourceStats,
      summary: {
        total_sources: sources.length,
        enabled_sources: enabledSources.length,
        success_count: successCount,
        failure_count: failureCount,
        total_items: items.length,
        duration_ms: duration,
      },
    };
  }

  /**
   * 從單一來源蒐集資訊
   *
   * @param {Object} source - 來源配置
   * @param {Object} envVars - 環境變數
   * @returns {Promise<Object>} - { items: Array, stat: Object }
   * @private
   */
  async _collectFromSource(source, envVars) {
    const startTime = Date.now();
    const stat = {
      source_name: source.name,
      source_tier: source.tier,
      source_type: source.type,
      status: "failure",
      items_count: 0,
      duration_ms: 0,
      error: null,
    };

    try {
      // 設定超時
      const timeout = source.timeout_ms || this.defaultTimeout;
      const collectPromise = this._dispatchCollector(source, envVars);

      const items = await Promise.race([
        collectPromise,
        this._createTimeout(timeout, source.name),
      ]);

      // 更新統計
      stat.status = "success";
      stat.items_count = items.length;
      stat.duration_ms = Date.now() - startTime;

      return { items, stat };
    } catch (error) {
      // 記錄錯誤
      stat.status = "failure";
      stat.duration_ms = Date.now() - startTime;
      stat.error = {
        message: error.message,
        type: error.name || "UnknownError",
        code: error.code,
      };

      logger.error(`[Collector] ${source.name} 蒐集失敗`, {
        error: error.message,
        type: error.name,
        duration: stat.duration_ms,
      });

      // 來源失敗不影響其他來源，回傳空項目
      return { items: [], stat };
    }
  }

  /**
   * 分派到對應的 collector
   *
   * @param {Object} source - 來源配置
   * @param {Object} envVars - 環境變數
   * @returns {Promise<Array>} - 蒐集到的項目
   * @private
   */
  async _dispatchCollector(source, envVars) {
    switch (source.type) {
      case "rss":
        return await rssCollector.collect(source);

      case "api":
        // 目前只支援 GitHub API
        if (source.url.includes("github.com")) {
          const githubToken = envVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
          return await githubCollector.collect(source, githubToken);
        } else {
          throw new Error(`不支援的 API 類型: ${source.url}`);
        }

      case "web":
        throw new Error("Web scraping 尚未實作");

      default:
        throw new Error(`未知的來源類型: ${source.type}`);
    }
  }

  /**
   * 建立超時 Promise
   *
   * @param {number} timeout - 超時時間（毫秒）
   * @param {string} sourceName - 來源名稱
   * @returns {Promise} - 超時 Promise
   * @private
   */
  _createTimeout(timeout, sourceName) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`來源 ${sourceName} 超時 (${timeout}ms)`));
      }, timeout);
    });
  }

  /**
   * 將來源分批（控制並發）
   *
   * @param {Array} sources - 來源陣列
   * @param {number} batchSize - 批次大小
   * @returns {Array<Array>} - 分批後的來源陣列
   * @private
   */
  _createBatches(sources, batchSize) {
    const batches = [];
    for (let i = 0; i < sources.length; i += batchSize) {
      batches.push(sources.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 設定最大並發數
   *
   * @param {number} maxConcurrency - 最大並發數
   */
  setMaxConcurrency(maxConcurrency) {
    if (maxConcurrency < 1) {
      throw new Error("最大並發數必須 >= 1");
    }
    this.maxConcurrency = maxConcurrency;
    logger.info(`[Collector] 設定最大並發數: ${maxConcurrency}`);
  }
}

// 匯出單例
export default new CollectorOrchestrator();
