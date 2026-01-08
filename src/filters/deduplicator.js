/**
 * 去重模組 - 實作多層級去重策略
 *
 * 去重策略：
 * 1. 標題完全相同快速篩選（階段 1）
 * 2. 混合相似度計算（Levenshtein 40% + Cosine 60%，門檻 80%）
 * 3. 內容指紋比對（MD5 + SimHash，Hamming 距離 ≤ 3）
 * 4. 版本選擇邏輯（評分: 字數 30 分 + 技術細節 40 分 + 來源層級 20 分 + 時間 10 分）
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import logger from "../utils/logger.js";

/**
 * 計算 Levenshtein 距離（編輯距離）
 * @param {string} str1 - 第一個字串
 * @param {string} str2 - 第二個字串
 * @returns {number} - 編輯距離
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // 建立 DP 陣列
  const dp = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // 初始化邊界條件
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  // 動態規劃計算
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 刪除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + 1 // 替換
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * 計算 Levenshtein 相似度（標準化到 0-1）
 * @param {string} str1 - 第一個字串
 * @param {string} str2 - 第二個字串
 * @returns {number} - 相似度（0-1）
 */
function levenshteinSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * 將文字轉換為詞向量（簡單的詞頻向量）
 * @param {string} text - 輸入文字
 * @returns {Map<string, number>} - 詞頻向量
 */
function textToVector(text) {
  const vector = new Map();
  // 簡單分詞：去除標點符號，按空白和中文字符分割
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // 計算詞頻
  for (const word of words) {
    vector.set(word, (vector.get(word) || 0) + 1);
  }

  return vector;
}

/**
 * 計算向量的長度（模）
 * @param {Map<string, number>} vector - 詞向量
 * @returns {number} - 向量長度
 */
function vectorMagnitude(vector) {
  let sum = 0;
  for (const value of vector.values()) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

/**
 * 計算兩個向量的點積
 * @param {Map<string, number>} vec1 - 第一個向量
 * @param {Map<string, number>} vec2 - 第二個向量
 * @returns {number} - 點積
 */
function dotProduct(vec1, vec2) {
  let sum = 0;
  for (const [word, value1] of vec1) {
    const value2 = vec2.get(word) || 0;
    sum += value1 * value2;
  }
  return sum;
}

/**
 * 計算 Cosine 相似度
 * @param {string} text1 - 第一段文字
 * @param {string} text2 - 第二段文字
 * @returns {number} - Cosine 相似度（0-1）
 */
function cosineSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const vec1 = textToVector(text1);
  const vec2 = textToVector(text2);

  const mag1 = vectorMagnitude(vec1);
  const mag2 = vectorMagnitude(vec2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const dot = dotProduct(vec1, vec2);
  return dot / (mag1 * mag2);
}

/**
 * 計算混合相似度（Levenshtein 40% + Cosine 60%）
 * @param {string} text1 - 第一段文字
 * @param {string} text2 - 第二段文字
 * @returns {number} - 混合相似度（0-1）
 */
function hybridSimilarity(text1, text2) {
  const levSim = levenshteinSimilarity(text1, text2);
  const cosSim = cosineSimilarity(text1, text2);
  return levSim * 0.4 + cosSim * 0.6;
}

/**
 * 計算 MD5 內容指紋
 * @param {string} content - 內容文字
 * @returns {string} - MD5 雜湊值
 */
function md5Fingerprint(content) {
  if (!content) return "";
  return crypto.createHash("md5").update(content.trim()).digest("hex");
}

/**
 * 計算文字的 SimHash 指紋
 * @param {string} text - 輸入文字
 * @param {number} hashBits - SimHash 位元數（預設 64）
 * @returns {string} - SimHash 二進位字串
 */
function simHash(text, hashBits = 64) {
  if (!text) return "0".repeat(hashBits);

  const vector = textToVector(text);
  const v = Array(hashBits).fill(0);

  // 對每個詞計算雜湊值並加權
  for (const [word, weight] of vector) {
    const hash = crypto.createHash("md5").update(word).digest("hex");
    const hashInt = BigInt("0x" + hash);

    // 將雜湊值的每個位元加權到向量
    for (let i = 0; i < hashBits; i++) {
      const bit = (hashInt >> BigInt(i)) & BigInt(1);
      v[i] += bit === BigInt(1) ? weight : -weight;
    }
  }

  // 根據向量值確定最終 SimHash
  return v.map((val) => (val > 0 ? "1" : "0")).join("");
}

/**
 * 計算兩個 SimHash 的 Hamming 距離
 * @param {string} hash1 - 第一個 SimHash
 * @param {string} hash2 - 第二個 SimHash
 * @returns {number} - Hamming 距離
 */
function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) {
    throw new Error("SimHash 長度不一致");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * 計算技術細節數量（作為品質指標）
 * @param {string} content - 內容文字
 * @returns {number} - 技術細節數量
 */
function countTechnicalDetails(content) {
  if (!content) return 0;

  const technicalPatterns = [
    /\b(API|SDK|CLI|UI|UX|ML|AI|LLM|GPT|NLP|RAG|vector|embedding|token|prompt|model|dataset|training|inference)\b/gi,
    /\b(function|class|method|parameter|variable|constant|interface|type|enum)\b/gi,
    /\b(performance|optimization|latency|throughput|scalability|efficiency)\b/gi,
    /\b(version|release|update|changelog|feature|bugfix|patch)\b/gi,
    /[0-9]+(\.[0-9]+){1,2}/g, // 版本號
    /`[^`]+`/g, // 程式碼片段
  ];

  let count = 0;
  for (const pattern of technicalPatterns) {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  }

  return count;
}

/**
 * 計算內容品質評分
 * 評分標準：字數 30 分 + 技術細節 40 分 + 來源層級 20 分 + 時間 10 分
 * @param {Object} item - 資訊項目
 * @returns {number} - 品質評分（0-100）
 */
function calculateQualityScore(item) {
  let score = 0;

  // 字數評分（30 分）：300 字以上給滿分
  const wordCount = (item.content || "").length;
  score += Math.min(30, (wordCount / 300) * 30);

  // 技術細節評分（40 分）：20 個以上給滿分
  const techDetails = countTechnicalDetails(item.content || "");
  score += Math.min(40, (techDetails / 20) * 40);

  // 來源層級評分（20 分）：層級 1 給 20 分，層級 2 給 15 分，層級 3 給 10 分
  const tierScore = { 1: 20, 2: 15, 3: 10 };
  score += tierScore[item.tier] || 0;

  // 時間評分（10 分）：越新越高分（7 天內給滿分）
  if (item.publishedAt) {
    const ageInDays =
      (Date.now() - new Date(item.publishedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - (ageInDays / 7) * 10);
  }

  return Math.round(score);
}

/**
 * 檢查兩個項目是否為重複內容
 * @param {Object} item1 - 第一個項目
 * @param {Object} item2 - 第二個項目
 * @param {Object} options - 檢查選項
 * @returns {boolean} - 是否重複
 */
function isDuplicate(item1, item2, options = {}) {
  const {
    titleThreshold = 0.8, // 標題相似度門檻
    contentThreshold = 0.8, // 內容相似度門檻
    hammingThreshold = 3, // Hamming 距離門檻
  } = options;

  // 階段 1: 標題完全相同
  if (item1.title === item2.title) {
    return true;
  }

  // 階段 2: 標題混合相似度
  const titleSim = hybridSimilarity(item1.title, item2.title);
  if (titleSim >= titleThreshold) {
    return true;
  }

  // 階段 3: 內容 MD5 指紋
  const content1 = item1.content || item1.description || "";
  const content2 = item2.content || item2.description || "";

  if (content1 && content2) {
    const md5_1 = md5Fingerprint(content1);
    const md5_2 = md5Fingerprint(content2);
    if (md5_1 === md5_2) {
      return true;
    }

    // 階段 4: SimHash + Hamming 距離
    const simhash1 = simHash(content1);
    const simhash2 = simHash(content2);
    const hamming = hammingDistance(simhash1, simhash2);

    if (hamming <= hammingThreshold) {
      return true;
    }

    // 階段 5: 內容混合相似度（作為最後檢查）
    const contentSim = hybridSimilarity(content1, content2);
    if (contentSim >= contentThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * 執行去重處理
 * @param {Array<Object>} items - 資訊項目陣列
 * @param {Object} options - 去重選項
 * @returns {Promise<Object>} - 去重結果 { uniqueItems, duplicates, stats }
 */
async function deduplicate(items, options = {}) {
  const startTime = Date.now();
  const uniqueItems = [];
  const duplicates = [];
  const duplicateGroups = new Map(); // 用於追蹤重複群組

  logger.info(`開始去重處理，共 ${items.length} 個項目`);

  // 快速標題查找表
  const titleMap = new Map();

  for (const item of items) {
    let isDup = false;
    let dupWith = null;

    // 快速檢查：完全相同標題
    if (titleMap.has(item.title)) {
      const existingItem = titleMap.get(item.title);
      isDup = true;
      dupWith = existingItem;
    } else {
      // 與所有已存在的唯一項目比對
      for (const uniqueItem of uniqueItems) {
        if (isDuplicate(item, uniqueItem, options)) {
          isDup = true;
          dupWith = uniqueItem;
          break;
        }
      }
    }

    if (isDup && dupWith) {
      // 計算品質評分，保留評分較高的版本
      const itemScore = calculateQualityScore(item);
      const existingScore = calculateQualityScore(dupWith);

      if (itemScore > existingScore) {
        // 用新項目替換舊項目
        const index = uniqueItems.indexOf(dupWith);
        uniqueItems[index] = item;
        titleMap.set(item.title, item);

        duplicates.push({
          kept: item.url,
          removed: dupWith.url,
          reason: "higher_quality",
          scores: { new: itemScore, old: existingScore },
        });
      } else {
        // 保留舊項目，記錄新項目為重複
        duplicates.push({
          kept: dupWith.url,
          removed: item.url,
          reason: "lower_quality",
          scores: { new: itemScore, old: existingScore },
        });
      }
    } else {
      // 新的唯一項目
      uniqueItems.push(item);
      titleMap.set(item.title, item);
    }
  }

  const duration = Date.now() - startTime;
  const stats = {
    totalItems: items.length,
    uniqueItems: uniqueItems.length,
    duplicatesRemoved: duplicates.length,
    deduplicationRate:
      ((duplicates.length / items.length) * 100).toFixed(2) + "%",
    durationMs: duration,
  };

  logger.info(
    `去重完成：保留 ${uniqueItems.length} 個項目，移除 ${duplicates.length} 個重複項`,
    stats
  );

  return {
    uniqueItems,
    duplicates,
    stats,
  };
}

/**
 * 載入去重索引
 * @param {string} indexPath - 索引檔案路徑
 * @returns {Promise<Object>} - 索引資料
 */
async function loadDedupIndex(indexPath) {
  try {
    const data = await fs.readFile(indexPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.info("去重索引不存在，將建立新索引");
      return { items: [], lastUpdated: null };
    }
    throw error;
  }
}

/**
 * 儲存去重索引
 * @param {string} indexPath - 索引檔案路徑
 * @param {Object} indexData - 索引資料
 */
async function saveDedupIndex(indexPath, indexData) {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), "utf8");
  logger.info(`去重索引已更新: ${indexPath}`);
}

/**
 * 更新去重索引
 * @param {Array<Object>} items - 唯一項目陣列
 * @param {string} indexPath - 索引檔案路徑（預設 data/dedup-index.json）
 */
async function updateDedupIndex(items, indexPath = "data/dedup-index.json") {
  const absolutePath = path.isAbsolute(indexPath)
    ? indexPath
    : path.join(process.cwd(), indexPath);

  const indexData = {
    items: items.map((item) => ({
      url: item.url,
      title: item.title,
      md5: md5Fingerprint(item.content || item.description || ""),
      simhash: simHash(item.content || item.description || ""),
      addedAt: new Date().toISOString(),
    })),
    lastUpdated: new Date().toISOString(),
    count: items.length,
  };

  await saveDedupIndex(absolutePath, indexData);
}

export {
  // 相似度計算函式
  levenshteinDistance,
  levenshteinSimilarity,
  cosineSimilarity,
  hybridSimilarity,
  // 指紋計算函式
  md5Fingerprint,
  simHash,
  hammingDistance,
  // 品質評估函式
  countTechnicalDetails,
  calculateQualityScore,
  // 去重核心函式
  isDuplicate,
  deduplicate,
  // 索引管理函式
  loadDedupIndex,
  saveDedupIndex,
  updateDedupIndex,
};
