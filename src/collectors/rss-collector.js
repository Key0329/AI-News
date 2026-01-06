/**
 * RSS Feed 蒐集器
 *
 * 功能：
 * - 使用 rss-parser 解析 RSS feeds
 * - 處理 RSS 格式錯誤與缺失欄位
 * - 轉換為標準 NewsItem 格式
 * - 支援超時控制
 *
 * Task: T020 [P] [US1] 建立 src/collectors/rss-collector.js，實作 RSS feed 解析（使用 rss-parser）
 */

import Parser from "rss-parser";
import logger from "../utils/logger.js";

/**
 * RSS 蒐集器類別
 */
class RSSCollector {
  constructor() {
    this.parser = new Parser({
      timeout: 30000, // 預設 30 秒超時
      headers: {
        "User-Agent": "AI-News-Assistant/1.0.0",
      },
    });
  }

  /**
   * 從 RSS feed 蒐集資訊
   *
   * @param {Object} source - 來源配置
   * @param {string} source.name - 來源名稱
   * @param {number} source.tier - 來源層級 (1-3)
   * @param {string} source.url - RSS feed URL
   * @param {number} source.max_items - 最大抓取數量
   * @param {number} source.timeout_ms - 超時時間（毫秒）
   * @returns {Promise<Array>} - 蒐集到的資訊項目陣列
   */
  async collect(source) {
    const startTime = Date.now();
    logger.debug(`[RSS Collector] 開始蒐集: ${source.name} (${source.url})`);

    try {
      // 設定超時
      const timeout = source.timeout_ms || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let feed;
      try {
        // 解析 RSS feed
        feed = await this.parser.parseURL(source.url);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!feed || !feed.items || feed.items.length === 0) {
        logger.warn(`[RSS Collector] ${source.name}: 無資訊項目`);
        return [];
      }

      // 限制數量
      const maxItems = source.max_items || 20;
      const items = feed.items.slice(0, maxItems);

      // 轉換為標準格式
      const newsItems = items
        .map((item, index) => this._transformToNewsItem(item, source, index))
        .filter((item) => item !== null); // 過濾無效項目

      const duration = Date.now() - startTime;
      logger.info(
        `[RSS Collector] ${source.name}: 成功蒐集 ${newsItems.length} 則資訊 (耗時 ${duration}ms)`
      );

      return newsItems;
    } catch (error) {
      const duration = Date.now() - startTime;

      // 處理不同類型的錯誤
      if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
        logger.error(
          `[RSS Collector] ${source.name}: 連線超時 (${duration}ms)`,
          { error: error.message }
        );
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        logger.error(`[RSS Collector] ${source.name}: 連線失敗`, {
          error: error.message,
          code: error.code,
        });
      } else {
        logger.error(`[RSS Collector] ${source.name}: 解析失敗`, {
          error: error.message,
          stack: error.stack,
        });
      }

      // 來源失敗不影響其他來源，回傳空陣列
      return [];
    }
  }

  /**
   * 轉換 RSS 項目為標準 NewsItem 格式
   *
   * @param {Object} item - RSS feed 項目
   * @param {Object} source - 來源配置
   * @param {number} index - 項目索引
   * @returns {Object|null} - 標準化的 NewsItem 或 null（無效項目）
   * @private
   */
  _transformToNewsItem(item, source, index) {
    try {
      // 驗證必要欄位
      if (!item.title || !item.link) {
        logger.warn(
          `[RSS Collector] ${source.name}: 項目缺少必要欄位 (title 或 link)`,
          {
            hasTitle: !!item.title,
            hasLink: !!item.link,
          }
        );
        return null;
      }

      // 處理發布時間
      let publishedAt;
      if (item.pubDate || item.isoDate) {
        try {
          publishedAt = new Date(item.pubDate || item.isoDate).toISOString();
        } catch (e) {
          logger.warn(`[RSS Collector] ${source.name}: 無效的日期格式`, {
            pubDate: item.pubDate,
            isoDate: item.isoDate,
          });
          publishedAt = new Date().toISOString(); // 使用當前時間作為後備
        }
      } else {
        logger.debug(
          `[RSS Collector] ${source.name}: 缺少 pubDate，使用當前時間`
        );
        publishedAt = new Date().toISOString();
      }

      // 提取內容
      const content =
        item.contentSnippet || item.content || item.description || "";
      const contentLength = content.length;

      // 建立標準化的 NewsItem（先不含 summary，後續由 summarizer 處理）
      const newsItem = {
        title: item.title.trim(),
        content: content.trim(),
        content_length: contentLength,
        language: this._detectLanguage(content),
        source: {
          name: source.name,
          tier: source.tier,
          type: "rss",
        },
        author: this._extractAuthor(item),
        published_at: publishedAt,
        collected_at: new Date().toISOString(),
        original_url: item.link.trim(),
        // 以下欄位由後續處理階段填充
        summary: [], // 待 summarizer 生成
        relevance_score: 1.0, // 預設相關（待 filter 判斷）
        votes_or_score: undefined,
      };

      return newsItem;
    } catch (error) {
      logger.error(`[RSS Collector] ${source.name}: 轉換項目失敗`, {
        error: error.message,
        itemTitle: item?.title,
      });
      return null;
    }
  }

  /**
   * 簡單的語言偵測（基於字元範圍）
   *
   * @param {string} text - 要偵測的文字
   * @returns {string} - 語言代碼 ("en", "zh-TW", "ja", "unknown")
   * @private
   */
  _detectLanguage(text) {
    if (!text || text.length === 0) return "unknown";

    // 統計字元類型
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || [])
      .length;
    const totalChars = text.length;

    // 判斷語言
    if (chineseChars / totalChars > 0.3) return "zh-TW";
    if (japaneseChars / totalChars > 0.3) return "ja";
    return "en"; // 預設英文
  }

  /**
   * 從 RSS item 中提取作者資訊
   * 處理各種 RSS feed 格式的作者欄位
   *
   * @param {Object} item - RSS feed 項目
   * @returns {string|undefined} - 作者名稱或 undefined
   * @private
   */
  _extractAuthor(item) {
    // 優先使用 creator 欄位
    if (item.creator) {
      if (typeof item.creator === "string") {
        return item.creator.trim();
      }
    }

    // 處理 author 欄位
    if (item.author) {
      // 如果是字串，直接返回
      if (typeof item.author === "string") {
        return item.author.trim();
      }

      // 如果是物件，嘗試提取 name 欄位（處理 Google AI Blog 等複雜格式）
      if (typeof item.author === "object") {
        // 處理 { name: ["Name"] } 格式
        if (
          item.author.name &&
          Array.isArray(item.author.name) &&
          item.author.name.length > 0
        ) {
          return item.author.name[0].trim();
        }
        // 處理 { name: "Name" } 格式
        if (item.author.name && typeof item.author.name === "string") {
          return item.author.name.trim();
        }
        // 處理 { email: "email@example.com" } 格式
        if (item.author.email && typeof item.author.email === "string") {
          return item.author.email.trim();
        }
      }
    }

    // 嘗試從 dc:creator 欄位提取
    if (item["dc:creator"]) {
      if (typeof item["dc:creator"] === "string") {
        return item["dc:creator"].trim();
      }
    }

    return undefined;
  }
}

// 匯出單例
export default new RSSCollector();
