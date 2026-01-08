/**
 * GitHub Releases 蒐集器
 *
 * 功能：
 * - 使用 @octokit/rest 呼叫 GitHub API
 * - 蒐集指定 repository 的 releases
 * - 處理 API 限制與錯誤
 * - 轉換為標準 NewsItem 格式
 *
 * Task: T021 [P] [US1] 建立 src/collectors/github-collector.js，實作 GitHub Releases API 蒐集（使用 @octokit/rest）
 */

import { Octokit } from "@octokit/rest";
import logger from "../utils/logger.js";

/**
 * GitHub 蒐集器類別
 */
class GitHubCollector {
  constructor() {
    this.octokit = null;
    this.initialized = false;
  }

  /**
   * 初始化 Octokit 客戶端
   *
   * @param {string} token - GitHub Personal Access Token
   */
  initialize(token) {
    if (!token) {
      logger.warn(
        "[GitHub Collector] 未提供 GITHUB_TOKEN，將使用未認證模式（有 API 限制）"
      );
      this.octokit = new Octokit();
    } else {
      this.octokit = new Octokit({ auth: token });
    }
    this.initialized = true;
  }

  /**
   * 從 GitHub Releases 蒐集資訊
   *
   * @param {Object} source - 來源配置
   * @param {string} source.name - 來源名稱
   * @param {number} source.tier - 來源層級 (1-3)
   * @param {string} source.url - GitHub API URL
   * @param {Object} source.api_params - API 參數
   * @param {string} source.api_params.endpoint - API endpoint (如 /repos/owner/repo/releases)
   * @param {number} source.max_items - 最大抓取數量
   * @param {string} githubToken - GitHub token (optional)
   * @returns {Promise<Array>} - 蒐集到的資訊項目陣列
   */
  async collect(source, githubToken = null) {
    const startTime = Date.now();
    logger.debug(`[GitHub Collector] 開始蒐集: ${source.name} (${source.url})`);

    try {
      // 確保已初始化
      if (!this.initialized) {
        this.initialize(githubToken);
      }

      // 解析 repository 資訊
      const repoInfo = this._parseRepoInfo(source);
      if (!repoInfo) {
        logger.error(
          `[GitHub Collector] ${source.name}: 無法解析 repository 資訊`,
          {
            url: source.url,
            endpoint: source.api_params?.endpoint,
          }
        );
        return [];
      }

      // 呼叫 GitHub API
      const response = await this.octokit.repos.listReleases({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        per_page: source.max_items || 20,
      });

      if (!response.data || response.data.length === 0) {
        logger.warn(`[GitHub Collector] ${source.name}: 無 releases`);
        return [];
      }

      // 過濾並轉換資料
      const newsItems = response.data
        .filter((release) => !release.draft) // 排除草稿
        .slice(0, source.max_items || 20)
        .map((release, index) =>
          this._transformToNewsItem(release, source, index)
        )
        .filter((item) => item !== null);

      const duration = Date.now() - startTime;
      logger.info(
        `[GitHub Collector] ${source.name}: 成功蒐集 ${newsItems.length} 則資訊 (耗時 ${duration}ms)`
      );

      return newsItems;
    } catch (error) {
      const duration = Date.now() - startTime;

      // 處理不同類型的錯誤
      if (error.status === 404) {
        logger.error(`[GitHub Collector] ${source.name}: Repository 不存在`, {
          error: error.message,
        });
      } else if (error.status === 403) {
        logger.error(
          `[GitHub Collector] ${source.name}: API 限制達到或無權限`,
          {
            error: error.message,
            rateLimit: error.response?.headers?.["x-ratelimit-remaining"],
          }
        );
      } else if (error.status === 401) {
        logger.error(`[GitHub Collector] ${source.name}: Token 無效或過期`, {
          error: error.message,
        });
      } else {
        logger.error(`[GitHub Collector] ${source.name}: API 呼叫失敗`, {
          error: error.message,
          status: error.status,
          stack: error.stack,
        });
      }

      // 來源失敗不影響其他來源，回傳空陣列
      return [];
    }
  }

  /**
   * 解析 repository 資訊
   *
   * @param {Object} source - 來源配置
   * @returns {Object|null} - { owner, repo } 或 null
   * @private
   */
  _parseRepoInfo(source) {
    try {
      // 從 api_params.endpoint 解析
      if (source.api_params?.endpoint) {
        // 格式: /repos/owner/repo/releases
        const match = source.api_params.endpoint.match(
          /\/repos\/([^/]+)\/([^/]+)/
        );
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
          };
        }
      }

      // 從 url 解析（備用方案）
      if (source.url) {
        // 格式: https://api.github.com/repos/owner/repo/releases
        const match = source.url.match(/\/repos\/([^/]+)\/([^/]+)/);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
          };
        }
      }

      return null;
    } catch (error) {
      logger.error(`[GitHub Collector] 解析 repository 資訊失敗`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 轉換 GitHub Release 為標準 NewsItem 格式
   *
   * @param {Object} release - GitHub release 物件
   * @param {Object} source - 來源配置
   * @param {number} index - 項目索引
   * @returns {Object|null} - 標準化的 NewsItem 或 null（無效項目）
   * @private
   */
  _transformToNewsItem(release, source, index) {
    try {
      // 驗證必要欄位
      if (!release.name && !release.tag_name) {
        logger.warn(
          `[GitHub Collector] ${source.name}: Release 缺少 name 和 tag_name`
        );
        return null;
      }

      // 使用 name 或 tag_name 作為標題
      const title = release.name || release.tag_name;

      // 處理發布時間
      let publishedAt;
      try {
        publishedAt = new Date(
          release.published_at || release.created_at
        ).toISOString();
      } catch (e) {
        logger.warn(`[GitHub Collector] ${source.name}: 無效的日期格式`, {
          published_at: release.published_at,
          created_at: release.created_at,
        });
        publishedAt = new Date().toISOString();
      }

      // 提取內容（release body）
      const content = release.body || `Release ${release.tag_name}`;
      const contentLength = content.length;

      // 建立標準化的 NewsItem
      const newsItem = {
        title: title.trim(),
        content: content.trim(),
        content_length: contentLength,
        language: this._detectLanguage(content),
        source: {
          name: source.name,
          tier: source.tier,
          type: "api",
        },
        author: release.author?.login || undefined,
        published_at: publishedAt,
        collected_at: new Date().toISOString(),
        original_url: release.html_url,
        // 以下欄位由後續處理階段填充
        summary: [], // 待 summarizer 生成
        relevance_score: 1.0, // 預設相關（待 filter 判斷）
        votes_or_score: undefined,
      };

      return newsItem;
    } catch (error) {
      logger.error(`[GitHub Collector] ${source.name}: 轉換項目失敗`, {
        error: error.message,
        releaseTag: release?.tag_name,
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
}

// 匯出單例
export default new GitHubCollector();
