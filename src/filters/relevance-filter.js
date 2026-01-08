/**
 * 相關性過濾模組 - 過濾出 AI 與 AI Coding 相關的內容
 *
 * 過濾策略：
 * 1. 使用關鍵詞匹配判斷相關性
 * 2. 計算 AI 相關段落占比（> 50% 視為相關）
 * 3. 處理邊界案例（同時提到 AI 和其他主題的文章）
 * 4. 可選：使用 Gemini API 進行語義判斷（進階功能）
 */

import logger from "../utils/logger.js";

/**
 * AI 與 AI Coding 相關主題清單
 */
const RELEVANT_TOPICS = {
  // AI 模型與技術
  aiModels: [
    "GPT",
    "ChatGPT",
    "Claude",
    "Gemini",
    "LLaMA",
    "Mistral",
    "DeepSeek",
    "Large Language Model",
    "LLM",
    "Transformer",
    "Neural Network",
    "Machine Learning",
    "Deep Learning",
    "AI Model",
    "Foundation Model",
    "Multimodal",
    "Vision Language Model",
    "VLM",
    "Diffusion Model",
    "大型語言模型",
    "神經網路",
    "機器學習",
    "深度學習",
    "生成式 AI",
  ],

  // AI Coding 工具
  codingTools: [
    "GitHub Copilot",
    "Cursor",
    "Codeium",
    "TabNine",
    "Sourcegraph Cody",
    "Amazon CodeWhisperer",
    "Replit Ghostwriter",
    "Code Assistant",
    "AI Pair Programming",
    "Code Generation",
    "Code Completion",
    "AI IDE",
    "Smart Code Editor",
    "Windsurf",
    "Zed",
    "AI 程式助手",
    "程式碼生成",
    "智慧補全",
  ],

  // AI 開發框架與工具
  frameworks: [
    "LangChain",
    "LlamaIndex",
    "Semantic Kernel",
    "AutoGPT",
    "Model Context Protocol",
    "MCP",
    "RAG",
    "Vector Database",
    "Embedding",
    "Prompt Engineering",
    "Fine-tuning",
    "LoRA",
    "AI Agent",
    "Autonomous Agent",
    "Tool Calling",
    "Function Calling",
    "AI 框架",
    "向量資料庫",
    "提示工程",
    "微調",
  ],

  // AI API 與服務
  apiServices: [
    "OpenAI API",
    "Anthropic API",
    "Google AI",
    "Gemini API",
    "Hugging Face",
    "Replicate",
    "Together AI",
    "Groq",
    "AI Gateway",
    "Model API",
    "Inference API",
    "AI Service",
    "AI 服務",
    "AI 介面",
  ],

  // 開發相關技術
  devTech: [
    "Code Review",
    "Test Generation",
    "Documentation",
    "Refactoring",
    "Bug Detection",
    "Security Analysis",
    "Performance Optimization",
    "API Design",
    "Code Quality",
    "Static Analysis",
    "程式碼審查",
    "測試生成",
    "文件生成",
    "重構",
  ],

  // AI 應用場景
  applications: [
    "Code Search",
    "Code Explanation",
    "Code Translation",
    "Natural Language to Code",
    "SQL Generation",
    "Regex Generation",
    "Code Documentation",
    "Code Migration",
    "Legacy Code Modernization",
    "程式碼搜尋",
    "程式碼解釋",
    "自然語言轉程式碼",
  ],
};

/**
 * 無關主題清單（用於識別非 AI 相關內容）
 */
const IRRELEVANT_TOPICS = [
  // 純硬體話題（無 AI 相關）
  "CPU",
  "GPU benchmark",
  "RAM",
  "Storage",
  "Gaming PC",
  "Console",

  // 純業務/商業話題（無技術內容）
  "Stock Price",
  "Market Cap",
  "Investment",
  "IPO",
  "Merger",
  "Acquisition",

  // 娛樂與生活
  "Movie",
  "Music",
  "Sports",
  "Travel",
  "Food",
  "Fashion",

  // 非 AI 軟體
  "Photoshop",
  "Excel",
  "Word",
  "PowerPoint",
  "Browser",
];

/**
 * 建立關鍵詞正則表達式
 * @param {Array<string>} keywords - 關鍵詞陣列
 * @returns {RegExp} - 關鍵詞正則表達式
 */
function createKeywordRegex(keywords) {
  // 轉義特殊字符並建立不區分大小寫的正則
  const escaped = keywords.map((kw) =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

/**
 * 計算關鍵詞在文字中的出現次數
 * @param {string} text - 文字內容
 * @param {Array<string>} keywords - 關鍵詞陣列
 * @returns {number} - 出現次數
 */
function countKeywordMatches(text, keywords) {
  if (!text) return 0;

  const regex = createKeywordRegex(keywords);
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * 將文字分割為段落
 * @param {string} text - 文字內容
 * @returns {Array<string>} - 段落陣列
 */
function splitIntoParagraphs(text) {
  if (!text) return [];

  // 按雙換行、句號+換行、或其他段落分隔符分割
  return text
    .split(/\n\n+|。\n|\.[\s\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20); // 過濾過短的段落
}

/**
 * 計算段落的相關性評分
 * @param {string} paragraph - 段落文字
 * @returns {Object} - { score, relevant, matches }
 */
function scoreParagraphRelevance(paragraph) {
  let score = 0;
  const matches = {};

  // 計算各類別關鍵詞匹配數
  for (const [category, keywords] of Object.entries(RELEVANT_TOPICS)) {
    const count = countKeywordMatches(paragraph, keywords);
    if (count > 0) {
      matches[category] = count;
      score += count;
    }
  }

  // 扣除無關主題的分數
  const irrelevantCount = countKeywordMatches(paragraph, IRRELEVANT_TOPICS);
  score -= irrelevantCount * 2; // 無關主題權重更高

  const relevant = score > 0;

  return { score, relevant, matches };
}

/**
 * 計算內容的整體相關性
 * @param {string} content - 完整內容
 * @returns {Object} - { isRelevant, confidence, details }
 */
function calculateRelevance(content) {
  if (!content) {
    return {
      isRelevant: false,
      confidence: 0,
      details: { reason: "empty_content" },
    };
  }

  const paragraphs = splitIntoParagraphs(content);

  if (paragraphs.length === 0) {
    // 內容太短，嘗試直接評分
    const result = scoreParagraphRelevance(content);
    return {
      isRelevant: result.relevant,
      confidence: Math.min(result.score * 10, 100),
      details: {
        totalParagraphs: 1,
        relevantParagraphs: result.relevant ? 1 : 0,
        matchCategories: result.matches,
      },
    };
  }

  // 評分每個段落
  let relevantCount = 0;
  let totalScore = 0;
  const categoryMatches = {};

  for (const para of paragraphs) {
    const result = scoreParagraphRelevance(para);
    if (result.relevant) {
      relevantCount++;
      totalScore += result.score;

      // 合併匹配類別
      for (const [cat, count] of Object.entries(result.matches)) {
        categoryMatches[cat] = (categoryMatches[cat] || 0) + count;
      }
    }
  }

  // 計算相關段落占比
  const relevanceRatio = relevantCount / paragraphs.length;

  // 相關性判斷：相關段落 > 50% 且至少有一個段落相關
  const isRelevant = relevanceRatio > 0.5 && relevantCount > 0;

  // 信心度：基於相關比例和總分
  const confidence = Math.min(
    relevanceRatio * 70 + (totalScore / paragraphs.length) * 30,
    100
  );

  return {
    isRelevant,
    confidence: Math.round(confidence),
    details: {
      totalParagraphs: paragraphs.length,
      relevantParagraphs: relevantCount,
      relevanceRatio: (relevanceRatio * 100).toFixed(2) + "%",
      totalScore,
      averageScore: (totalScore / paragraphs.length).toFixed(2),
      matchCategories: categoryMatches,
    },
  };
}

/**
 * 檢查項目是否相關
 * @param {Object} item - 資訊項目
 * @param {Object} options - 過濾選項
 * @returns {Object} - { isRelevant, confidence, details }
 */
function isRelevant(item, options = {}) {
  const {
    minConfidence = 50, // 最低信心度門檻
    checkTitle = true, // 是否檢查標題
    checkContent = true, // 是否檢查內容
  } = options;

  // 組合需要檢查的文字
  let textToCheck = "";

  if (checkTitle && item.title) {
    textToCheck += item.title + "\n\n";
  }

  if (checkContent) {
    textToCheck += item.content || item.description || "";
  }

  const result = calculateRelevance(textToCheck);

  // 應用信心度門檻
  if (result.confidence < minConfidence) {
    result.isRelevant = false;
  }

  return result;
}

/**
 * 過濾資訊項目陣列，僅保留相關項目
 * @param {Array<Object>} items - 資訊項目陣列
 * @param {Object} options - 過濾選項
 * @returns {Promise<Object>} - { relevantItems, filteredOut, stats }
 */
async function filterRelevant(items, options = {}) {
  const startTime = Date.now();
  const relevantItems = [];
  const filteredOut = [];

  logger.info(`開始相關性過濾，共 ${items.length} 個項目`);

  for (const item of items) {
    const result = isRelevant(item, options);

    if (result.isRelevant) {
      relevantItems.push({
        ...item,
        relevance: {
          confidence: result.confidence,
          categories: result.details.matchCategories,
        },
      });
    } else {
      filteredOut.push({
        url: item.url,
        title: item.title,
        reason: result.details.reason || "low_relevance",
        confidence: result.confidence,
      });
    }
  }

  const duration = Date.now() - startTime;
  const stats = {
    totalItems: items.length,
    relevantItems: relevantItems.length,
    filteredOut: filteredOut.length,
    filterRate: ((filteredOut.length / items.length) * 100).toFixed(2) + "%",
    durationMs: duration,
  };

  logger.info(
    `相關性過濾完成：保留 ${relevantItems.length} 個相關項目，過濾 ${filteredOut.length} 個不相關項目`,
    stats
  );

  return {
    relevantItems,
    filteredOut,
    stats,
  };
}

/**
 * 處理邊界案例：同時提到 AI 和其他主題的文章
 * @param {Object} item - 資訊項目
 * @returns {Object} - { shouldInclude, reason }
 */
function handleBorderlineCase(item) {
  const result = isRelevant(item, { minConfidence: 40 }); // 降低門檻

  // 如果信心度在 40-60 之間，視為邊界案例
  if (result.confidence >= 40 && result.confidence < 60) {
    // 檢查是否有強 AI 信號
    const hasStrongAISignal =
      Object.keys(result.details.matchCategories || {}).length >= 2;

    return {
      shouldInclude: hasStrongAISignal,
      reason: hasStrongAISignal
        ? "borderline_with_strong_ai_signal"
        : "borderline_insufficient_ai_content",
      confidence: result.confidence,
      details: result.details,
    };
  }

  return {
    shouldInclude: result.isRelevant,
    reason: result.isRelevant ? "clearly_relevant" : "clearly_irrelevant",
    confidence: result.confidence,
    details: result.details,
  };
}

/**
 * 取得相關主題清單（供外部查詢）
 * @returns {Object} - 主題分類物件
 */
function getRelevantTopics() {
  return { ...RELEVANT_TOPICS };
}

/**
 * 取得無關主題清單（供外部查詢）
 * @returns {Array<string>} - 無關主題陣列
 */
function getIrrelevantTopics() {
  return [...IRRELEVANT_TOPICS];
}

export {
  // 核心過濾函式
  isRelevant,
  filterRelevant,
  // 相關性計算
  calculateRelevance,
  scoreParagraphRelevance,
  // 邊界案例處理
  handleBorderlineCase,
  // 工具函式
  countKeywordMatches,
  splitIntoParagraphs,
  // 主題查詢
  getRelevantTopics,
  getIrrelevantTopics,
};
