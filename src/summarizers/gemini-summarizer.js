/**
 * Gemini 摘要生成器
 *
 * 功能：
 * - 使用 Google Gemini API 生成繁體中文摘要
 * - 批次處理（5 則為一批）
 * - URL Hash 快取（24 小時 TTL）
 * - 錯誤處理與重試機制
 *
 * Task: T024 [US1] 建立 src/summarizers/gemini-summarizer.js，實作 Gemini API 調用（使用 @google/generative-ai）
 * Task: T025 [US1] 在 gemini-summarizer.js 中實作 System Prompt（精簡版，35-40 tokens，要求 3-5 點繁體中文摘要）
 * Task: T026 [US1] 在 gemini-summarizer.js 中實作批次處理（5 則為一批次，批次間延遲 1-4 秒）
 * Task: T027 [US1] 在 gemini-summarizer.js 中實作 URL Hash 快取（24 小時 TTL，使用 SHA256 前 8 碼）
 * Task: T028 [US1] 在 gemini-summarizer.js 中實作 API 失敗處理（重試 2 次，間隔 5 秒，失敗後保留原始內容標註「摘要生成失敗」）
 */

import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const CACHE_FILE = path.join(ROOT_DIR, "data", "summary-cache.json");

/**
 * Gemini 摘要生成器類別
 */
class GeminiSummarizer {
  constructor() {
    this.ai = null;
    this.modelName = "gemini-2.5-flash-lite";
    this.cache = new Map(); // { urlHash: { summary: Array, timestamp: number } }
    this.cacheLoaded = false;
    this.batchSize = 5; // 批次大小
    this.batchDelayMin = 1000; // 批次間最小延遲 1 秒
    this.batchDelayMax = 4000; // 批次間最大延遲 4 秒
    this.retryCount = 2; // 重試次數
    this.retryDelay = 5000; // 重試間隔 5 秒
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 小時
  }

  /**
   * 初始化 Gemini API
   *
   * @param {string} apiKey - Gemini API Key
   * @param {string} modelName - 模型名稱（預設 gemini-2.5-flash-lite）
   */
  async initialize(apiKey, modelName = "gemini-2.5-flash-lite") {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;

    // 載入快取
    await this._loadCache();

    logger.info(
      `[Gemini Summarizer] 已初始化，模型: ${modelName}，快取項目: ${this.cache.size}`
    );
  }

  /**
   * 批次生成摘要
   *
   * @param {Array} newsItems - 資訊項目陣列
   * @returns {Promise<Array>} - 包含摘要的資訊項目陣列
   */
  async summarizeBatch(newsItems) {
    if (!this.ai) {
      throw new Error(
        "Gemini Summarizer not initialized. Call initialize() first."
      );
    }

    const startTime = Date.now();
    logger.info(`[Gemini Summarizer] 開始處理 ${newsItems.length} 則資訊`);

    // 分批處理
    const batches = this._createBatches(newsItems, this.batchSize);
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      logger.debug(`[Gemini Summarizer] 處理批次 ${i + 1}/${batches.length}`);

      // 處理單一批次
      const batchResults = await Promise.all(
        batches[i].map((item) => this._summarizeItem(item))
      );

      results.push(...batchResults);

      // 批次間延遲（避免 API 限制）
      if (i < batches.length - 1) {
        const delay = this._randomDelay(this.batchDelayMin, this.batchDelayMax);
        logger.debug(`[Gemini Summarizer] 批次間延遲 ${delay}ms`);
        await this._sleep(delay);
      }
    }

    // 儲存快取
    await this._saveCache();

    const duration = Date.now() - startTime;
    const successCount = results.filter(
      (r) => r.summary && r.summary.length > 0
    ).length;
    logger.info(
      `[Gemini Summarizer] 完成處理: 成功 ${successCount}/${newsItems.length}，耗時 ${duration}ms`
    );

    return results;
  }

  /**
   * 為單一項目生成摘要
   *
   * @param {Object} newsItem - 資訊項目
   * @returns {Promise<Object>} - 包含摘要的資訊項目
   * @private
   */
  async _summarizeItem(newsItem) {
    try {
      // 檢查快取
      const urlHash = this._hashURL(newsItem.original_url);
      const cached = this.cache.get(urlHash);

      if (cached && this._isCacheValid(cached.timestamp)) {
        logger.debug(
          `[Gemini Summarizer] 使用快取: ${newsItem.title.substring(0, 30)}...`
        );
        return {
          ...newsItem,
          summary: cached.summary,
        };
      }

      // 生成摘要（含重試）
      const summary = await this._generateWithRetry(newsItem);

      // 更新快取
      this.cache.set(urlHash, {
        summary,
        timestamp: Date.now(),
      });

      return {
        ...newsItem,
        summary,
      };
    } catch (error) {
      logger.error(`[Gemini Summarizer] 生成摘要失敗: ${newsItem.title}`, {
        error: error.message,
      });

      // 失敗時保留原始內容
      return {
        ...newsItem,
        summary: [
          "⚠️ 摘要生成失敗，顯示原始內容：",
          newsItem.content.substring(0, 200) + "...",
        ],
      };
    }
  }

  /**
   * 帶重試的摘要生成
   *
   * @param {Object} newsItem - 資訊項目
   * @returns {Promise<Array>} - 摘要陣列（3-5 點）
   * @private
   */
  async _generateWithRetry(newsItem) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(
            `[Gemini Summarizer] 重試第 ${attempt} 次: ${newsItem.title.substring(
              0,
              30
            )}...`
          );
          await this._sleep(this.retryDelay);
        }

        const summary = await this._generate(newsItem);
        return summary;
      } catch (error) {
        lastError = error;
        logger.warn(`[Gemini Summarizer] 嘗試 ${attempt + 1} 失敗`, {
          error: error.message,
          title: newsItem.title.substring(0, 30),
        });
      }
    }

    throw lastError;
  }

  /**
   * 調用 Gemini API 生成摘要
   *
   * @param {Object} newsItem - 資訊項目
   * @returns {Promise<Array>} - 摘要陣列（3-5 點）
   * @private
   */
  async _generate(newsItem) {
    // 建立完整的 Prompt（包含系統指令與使用者請求）
    const prompt = `你是專業的 AI 技術摘要編輯。請用繁體中文生成 3-5 點核心摘要，每點限 1 句話，聚焦技術亮點與實際影響。

標題: ${newsItem.title}

內容:
${newsItem.content.substring(0, 2000)}

請生成繁體中文摘要（3-5 點，每點一句話）：`;

    // 調用 API（使用官方用法）
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: prompt,
    });

    const text = response.text;

    // 解析摘要（按行分割，過濾空行）
    const summary = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("#")) // 移除標題行
      .map((line) => line.replace(/^[-*•]\s*/, "")) // 移除列表符號
      .filter((line) => line.length > 10) // 過濾太短的行
      .slice(0, 5); // 最多 5 點

    if (summary.length === 0) {
      throw new Error("API 回傳空摘要");
    }

    logger.debug(`[Gemini Summarizer] 成功生成 ${summary.length} 點摘要`);
    return summary;
  }

  /**
   * 計算 URL 的 SHA256 雜湊（前 8 碼）
   *
   * @param {string} url - URL
   * @returns {string} - 雜湊值（前 8 碼）
   * @private
   */
  _hashURL(url) {
    return crypto
      .createHash("sha256")
      .update(url)
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * 檢查快取是否有效
   *
   * @param {number} timestamp - 快取時間戳
   * @returns {boolean} - 是否有效
   * @private
   */
  _isCacheValid(timestamp) {
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * 載入快取
   * @private
   */
  async _loadCache() {
    try {
      const data = await fs.readFile(CACHE_FILE, "utf-8");
      const cacheData = JSON.parse(data);

      // 轉換為 Map，並過濾過期項目
      for (const [key, value] of Object.entries(cacheData)) {
        if (this._isCacheValid(value.timestamp)) {
          this.cache.set(key, value);
        }
      }

      logger.info(
        `[Gemini Summarizer] 載入快取: ${this.cache.size} 個有效項目`
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.warn("[Gemini Summarizer] 載入快取失敗", {
          error: error.message,
        });
      }
    }
    this.cacheLoaded = true;
  }

  /**
   * 儲存快取
   * @private
   */
  async _saveCache() {
    try {
      // 轉換 Map 為 Object
      const cacheData = Object.fromEntries(this.cache);
      await fs.writeFile(
        CACHE_FILE,
        JSON.stringify(cacheData, null, 2),
        "utf-8"
      );
      logger.debug(`[Gemini Summarizer] 儲存快取: ${this.cache.size} 個項目`);
    } catch (error) {
      logger.error("[Gemini Summarizer] 儲存快取失敗", {
        error: error.message,
      });
    }
  }

  /**
   * 建立批次
   * @private
   */
  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 隨機延遲
   * @private
   */
  _randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep helper
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 匯出單例
export default new GeminiSummarizer();
