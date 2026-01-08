/**
 * Markdown 報告生成器
 *
 * 功能：
 * - 生成結構化的繁體中文摘要報告
 * - 按層級分組資訊
 * - 包含元資料、統計資訊、執行日誌
 *
 * Task: T029 [US1] 建立 src/generators/markdown-generator.js，實作 Markdown 報告產生（分層級結構）
 * Task: T030 [US1] 在 markdown-generator.js 中實作報告元資料區塊（日期、總項數、產生時間）
 * Task: T031 [US1] 在 markdown-generator.js 中實作各層級資訊區塊渲染（標題、摘要、來源、作者、時間、連結）
 * Task: T032 [US1] 在 markdown-generator.js 中實作報告統計區塊（總項數、各層級項數、來源數、去重移除數）
 * Task: T033 [US1] 在 markdown-generator.js 中實作執行日誌摘要區塊（來源狀態表格、成功率）
 */

import logger from "../utils/logger.js";

/**
 * Markdown 報告生成器類別
 */
class MarkdownGenerator {
  /**
   * 生成摘要報告
   *
   * @param {Object} data - 報告資料
   * @param {Array} data.items - 資訊項目陣列
   * @param {Object} data.collectionStats - 蒐集統計
   * @param {Object} data.dedupStats - 去重統計
   * @param {Object} data.filterStats - 過濾統計
   * @param {Object} data.summarizationStats - 摘要統計
   * @param {Object} data.executionSummary - 執行摘要
   * @returns {string} - Markdown 格式的報告
   */
  generate(data) {
    const {
      items,
      collectionStats,
      dedupStats,
      filterStats,
      summarizationStats,
      executionSummary,
    } = data;

    logger.info(`[Markdown Generator] 開始生成報告，共 ${items.length} 則資訊`);

    const sections = [];

    // 1. 標題與元資料
    sections.push(this._generateHeader(items, executionSummary));

    // 2. 摘要統計
    sections.push(
      this._generateSummaryStats(
        items,
        collectionStats,
        summarizationStats,
        dedupStats,
        filterStats
      )
    );

    // 3. 資訊內容（按層級分組）
    sections.push(this._generateContentByTier(items));

    // 4. 執行日誌摘要
    sections.push(this._generateExecutionLog(collectionStats));

    // 5. 頁尾
    sections.push(this._generateFooter());

    const report = sections.join("\n\n---\n\n");
    logger.info(`[Markdown Generator] 報告生成完成，共 ${report.length} 字元`);

    return report;
  }

  /**
   * 生成報告標題與元資料
   * @private
   */
  _generateHeader(items, executionSummary) {
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toLocaleTimeString("zh-TW", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    return `# AI & AI Coding 每日情報摘要

**日期**: ${dateStr}  
**產生時間**: ${timeStr}  
**總項數**: ${items.length} 則  
**執行時間**: ${
      executionSummary?.total_duration_ms
        ? Math.round(executionSummary.total_duration_ms / 1000)
        : 0
    } 秒`;
  }

  /**
   * 生成摘要統計區塊
   * @private
   */
  _generateSummaryStats(
    items,
    collectionStats,
    summarizationStats,
    dedupStats,
    filterStats
  ) {
    // 按層級統計
    const tier1Count = items.filter((i) => i.source?.tier === 1).length;
    const tier2Count = items.filter((i) => i.source?.tier === 2).length;
    const tier3Count = items.filter((i) => i.source?.tier === 3).length;

    // 來源統計
    const uniqueSources = new Set(items.map((i) => i.source?.name || "未知"))
      .size;
    const totalSources = collectionStats?.total_sources || 0;
    const successSources = collectionStats?.success_count || 0;
    const failureSources = collectionStats?.failure_count || 0;

    // 摘要統計
    const summarySuccess = items.filter(
      (i) => i.summary && i.summary.length > 0 && !i.summary[0].includes("失敗")
    ).length;
    const summaryFailure = items.length - summarySuccess;

    // 處理流程統計
    const collectedCount = collectionStats?.total_items || items.length;
    const dedupedCount = dedupStats?.items_after || collectedCount;
    const filteredCount = filterStats?.items_after || dedupedCount;
    const duplicatesRemoved = dedupStats?.duplicates_removed || 0;
    const irrelevantFiltered = filterStats?.filtered_out || 0;

    return `## 📊 摘要統計

### 資訊分佈

| 層級 | 說明 | 數量 |
|------|------|------|
| 🌟 層級 1 | AI 實驗室官方部落格 | ${tier1Count} 則 |
| 🛠️ 層級 2 | AI Coding 工具 & Releases | ${tier2Count} 則 |
| 🌐 層級 3 | 開發框架 & 社群討論 | ${tier3Count} 則 |
| **總計** | | **${items.length} 則** |

### 處理流程

| 階段 | 項目數 | 說明 |
|------|--------|------|
| 📥 蒐集 | ${collectedCount} | 從來源蒐集的原始資訊 |
| 🔄 去重 | ${dedupedCount} | 去除 ${duplicatesRemoved} 個重複項 |
| 🎯 過濾 | ${filteredCount} | 過濾 ${irrelevantFiltered} 個不相關項 |
| ✅ 最終 | ${items.length} | 包含摘要的最終資訊 |

### 來源統計

- **啟用來源**: ${totalSources} 個
- **成功蒐集**: ${successSources} 個 (${this._percentage(
      successSources,
      totalSources
    )}%)
- **失敗來源**: ${failureSources} 個
- **實際來源**: ${uniqueSources} 個（有資訊）

### 摘要生成

- **成功生成**: ${summarySuccess} 則 (${this._percentage(
      summarySuccess,
      items.length
    )}%)
- **生成失敗**: ${summaryFailure} 則`;
  }

  /**
   * 生成資訊內容（按層級分組）
   * @private
   */
  _generateContentByTier(items) {
    // 按層級分組
    const tier1Items = items.filter((i) => i.source?.tier === 1);
    const tier2Items = items.filter((i) => i.source?.tier === 2);
    const tier3Items = items.filter((i) => i.source?.tier === 3);

    const sections = ["## 📰 資訊內容"];

    // 層級 1
    if (tier1Items.length > 0) {
      sections.push("### 🌟 層級 1: AI 實驗室官方部落格\n");
      sections.push(this._renderItems(tier1Items));
    }

    // 層級 2
    if (tier2Items.length > 0) {
      sections.push("### 🛠️ 層級 2: AI Coding 工具 & Releases\n");
      sections.push(this._renderItems(tier2Items));
    }

    // 層級 3
    if (tier3Items.length > 0) {
      sections.push("### 🌐 層級 3: 開發框架 & 社群討論\n");
      sections.push(this._renderItems(tier3Items));
    }

    return sections.join("\n\n");
  }

  /**
   * 渲染資訊項目
   * @private
   */
  _renderItems(items) {
    return items
      .map((item, index) => {
        try {
          const sections = [];

          // 標題
          const title =
            typeof item.title === "string"
              ? item.title
              : item.title
              ? JSON.stringify(item.title)
              : "無標題";
          sections.push(`#### ${index + 1}. ${title}`);

          // 元資料
          const metadata = [];
          // 安全訪問 source 物件
          let sourceName = "未知來源";
          if (typeof item.source === "string") {
            sourceName = item.source;
          } else if (item.source && typeof item.source.name === "string") {
            sourceName = item.source.name;
          } else if (item.source && item.source.name) {
            sourceName = JSON.stringify(item.source.name);
          }
          metadata.push(`**來源**: ${sourceName}`);

          // 安全處理 author
          if (item.author) {
            let author = "未知作者";
            if (typeof item.author === "string") {
              author = item.author;
            } else if (typeof item.author === "number") {
              author = item.author.toString();
            } else if (item.author && typeof item.author === "object") {
              // 如果是對象,嘗試獲取 name 屬性
              if (item.author.name && typeof item.author.name === "string") {
                author = item.author.name;
              } else {
                author = JSON.stringify(item.author);
              }
            }
            metadata.push(`**作者**: ${author}`);
          }

          metadata.push(`**時間**: ${this._formatDate(item.published_at)}`);
          sections.push(metadata.join(" | "));

          // 摘要
          if (item.summary && item.summary.length > 0) {
            sections.push("\n**摘要**:\n");
            item.summary.forEach((point) => {
              const pointStr =
                typeof point === "string" ? point : JSON.stringify(point);
              sections.push(`- ${pointStr}`);
            });
          }

          // 連結
          const url =
            typeof item.original_url === "string"
              ? item.original_url
              : item.original_url
              ? JSON.stringify(item.original_url)
              : "#";
          sections.push(`\n🔗 [查看原文](${url})`);

          return sections.join("\n");
        } catch (error) {
          logger.error(`[Markdown Generator] 渲染項目失敗`, {
            error: error.message,
            itemIndex: index,
            itemTitle: item?.title,
          });
          return `#### ${index + 1}. [渲染失敗]\n\n**錯誤**: ${error.message}`;
        }
      })
      .join("\n\n");
  }

  /**
   * 生成執行日誌摘要
   * @private
   */
  _generateExecutionLog(collectionStats) {
    if (!collectionStats || !collectionStats.sourceStats) {
      return "## 📝 執行日誌\n\n無執行日誌資料";
    }

    const { sourceStats } = collectionStats;

    // 按層級排序
    const sortedStats = [...sourceStats].sort((a, b) => {
      if (a.source_tier !== b.source_tier) {
        return a.source_tier - b.source_tier;
      }
      return a.source_name.localeCompare(b.source_name);
    });

    // 建立表格
    const tableRows = ["| 來源 | 層級 | 類型 | 狀態 | 項目數 | 耗時 |"];
    tableRows.push("|------|------|------|------|--------|------|");

    for (const stat of sortedStats) {
      const status = stat.status === "success" ? "✅ 成功" : "❌ 失敗";
      const duration = `${stat.duration_ms}ms`;
      const type = stat.source_type.toUpperCase();

      tableRows.push(
        `| ${stat.source_name} | ${stat.source_tier} | ${type} | ${status} | ${stat.items_count} | ${duration} |`
      );
    }

    // 統計
    const successCount = sortedStats.filter(
      (s) => s.status === "success"
    ).length;
    const totalCount = sortedStats.length;
    const successRate = this._percentage(successCount, totalCount);

    return `## 📝 執行日誌

### 來源狀態

${tableRows.join("\n")}

### 執行摘要

- **總來源數**: ${totalCount}
- **成功率**: ${successRate}% (${successCount}/${totalCount})
- **平均耗時**: ${this._averageDuration(sortedStats)}ms`;
  }

  /**
   * 生成頁尾
   * @private
   */
  _generateFooter() {
    return `## ℹ️ 說明

本報告由 **AI & AI Coding 自動化情報助手** 自動生成。

- **資訊來源**: 三層級多樣化來源（官方部落格、工具 Releases、開發框架與社群）
- **內容處理**: 自動去重、AI 相關性過濾、繁體中文摘要生成
- **更新頻率**: 每日定時更新

---

*生成時間: ${new Date().toISOString()}*`;
  }

  /**
   * 格式化日期
   * @private
   */
  _formatDate(isoString) {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoString;
    }
  }

  /**
   * 計算百分比
   * @private
   */
  _percentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  /**
   * 計算平均耗時
   * @private
   */
  _averageDuration(stats) {
    if (stats.length === 0) return 0;
    const total = stats.reduce((sum, s) => sum + s.duration_ms, 0);
    return Math.round(total / stats.length);
  }
}

// 匯出單例
export default new MarkdownGenerator();
