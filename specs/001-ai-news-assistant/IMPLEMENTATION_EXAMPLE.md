# 去重與相似度計算 - 完整實作範例

**檔案版本**: 1.0
**最後更新**: 2026-01-06

---

## 1. 字串相似度計算實作

### 1.1 Levenshtein 距離（編輯距離）

```javascript
/**
 * utils/levenshtein.js
 * Levenshtein 距離計算 - 編輯距離
 */

/**
 * 計算兩個字串之間的 Levenshtein 距離
 * @param {string} s1 - 字串 1
 * @param {string} s2 - 字串 2
 * @returns {number} 編輯距離
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;

  // 初始化 DP 表
  const dp = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // 邊界情況
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // 填充 DP 表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        // 字符相同，不需要編輯
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // 取三種操作的最小值：插入、刪除、替換
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],       // 刪除
          dp[i][j - 1],       // 插入
          dp[i - 1][j - 1]    // 替換
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * 計算 Levenshtein 相似度（0-1 之間）
 * @param {string} s1
 * @param {string} s2
 * @returns {number} 相似度分數
 */
function levenshteinSimilarity(s1, s2) {
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  if (maxLength === 0) return 1; // 兩者都為空

  return 1 - distance / maxLength;
}

/**
 * 優化版本 - 空間複雜度降低到 O(min(m,n))
 * @param {string} s1
 * @param {string} s2
 * @returns {number} 編輯距離
 */
function levenshteinDistanceOptimized(s1, s2) {
  let [shorter, longer] = s1.length <= s2.length ? [s1, s2] : [s2, s1];

  let prev = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  let curr = Array(shorter.length + 1);

  for (let i = 1; i <= longer.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // 插入
        prev[j] + 1,           // 刪除
        prev[j - 1] + cost     // 替換
      );
    }

    [prev, curr] = [curr, prev];
  }

  return prev[shorter.length];
}

// 測試
console.log('Levenshtein 距離測試:');
console.log(levenshteinDistance('kitten', 'sitting')); // 3
console.log(levenshteinSimilarity('Claude 發布', 'Claude 新發布')); // ~0.83

module.exports = {
  levenshteinDistance,
  levenshteinSimilarity,
  levenshteinDistanceOptimized
};
```

---

### 1.2 Cosine 相似度

```javascript
/**
 * utils/cosine-similarity.js
 * Cosine 相似度計算
 */

/**
 * 簡單分詞器 - 支持中英混合
 * @param {string} text - 文本
 * @returns {string[]} 詞令列表
 */
function tokenize(text) {
  const tokens = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isChineseChar = /[\u4e00-\u9fff]/.test(char);
    const isWhitespace = /\s/.test(char);

    if (isWhitespace) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else if (isChineseChar) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * 計算 Cosine 相似度
 * @param {string} text1
 * @param {string} text2
 * @returns {number} 0-1 之間的相似度
 */
function cosineSimilarity(text1, text2) {
  // 分詞
  const tokens1 = tokenize(text1.toLowerCase());
  const tokens2 = tokenize(text2.toLowerCase());

  // 構建詞彙表
  const vocabulary = new Set([...tokens1, ...tokens2]);
  if (vocabulary.size === 0) return 1; // 都為空

  // 構建向量
  const getVector = (tokens) => {
    const vector = {};
    for (const token of tokens) {
      vector[token] = (vector[token] || 0) + 1;
    }
    return vector;
  };

  const vector1 = getVector(tokens1);
  const vector2 = getVector(tokens2);

  // 計算點積
  let dotProduct = 0;
  for (const word of vocabulary) {
    dotProduct += (vector1[word] || 0) * (vector2[word] || 0);
  }

  // 計算模
  const magnitude1 = Math.sqrt(
    Object.values(vector1).reduce((sum, count) => sum + count * count, 0)
  );
  const magnitude2 = Math.sqrt(
    Object.values(vector2).reduce((sum, count) => sum + count * count, 0)
  );

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * 加權 Cosine 相似度 - 支持自訂詞權
 * @param {string} text1
 * @param {string} text2
 * @param {object} weights - 詞權重映射 (可選)
 * @returns {number} 相似度
 */
function weightedCosineSimilarity(text1, text2, weights = {}) {
  const tokens1 = tokenize(text1.toLowerCase());
  const tokens2 = tokenize(text2.toLowerCase());

  const vocabulary = new Set([...tokens1, ...tokens2]);
  if (vocabulary.size === 0) return 1;

  // 根據詞權重構建向量
  const getWeightedVector = (tokens) => {
    const vector = {};
    for (const token of tokens) {
      const weight = weights[token] || 1; // 預設權重為 1
      vector[token] = (vector[token] || 0) + weight;
    }
    return vector;
  };

  const vector1 = getWeightedVector(tokens1);
  const vector2 = getWeightedVector(tokens2);

  // 計算點積和模
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (const word of vocabulary) {
    const val1 = vector1[word] || 0;
    const val2 = vector2[word] || 0;
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

// 測試
console.log('Cosine 相似度測試:');
console.log(cosineSimilarity('Claude 發布', 'Claude 新發布')); // ~0.95
console.log(cosineSimilarity(
  'Claude 3.5 Sonnet 發布',
  '3.5 Claude Sonnet 發布'  // 詞序不同
)); // ~0.95 (不受詞序影響)

module.exports = {
  tokenize,
  cosineSimilarity,
  weightedCosineSimilarity
};
```

---

### 1.3 組合相似度計算

```javascript
/**
 * utils/title-similarity.js
 * 標題相似度計算 - 結合 Levenshtein + Cosine
 */

const { levenshteinSimilarity } = require('./levenshtein');
const { cosineSimilarity } = require('./cosine-similarity');

/**
 * 規範化標題 - 用於比較前的預處理
 * @param {string} title
 * @returns {string}
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 移除特殊字符
    .replace(/\s+/g, ' '); // 規範化空格
}

/**
 * 計算標題相似度 - 雙層策略
 * @param {string} title1
 * @param {string} title2
 * @param {object} options - 配置選項
 *   - weights: { levenshtein: 0.4, cosine: 0.6 }
 *   - earlyStopThreshold: 0.9
 * @returns {number} 0-1 之間的相似度
 */
function calculateTitleSimilarity(title1, title2, options = {}) {
  const {
    weights = { levenshtein: 0.4, cosine: 0.6 },
    earlyStopThreshold = 0.9
  } = options;

  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // 完全相同
  if (norm1 === norm2) return 1;

  // 完全不同（太長或太短）
  const lengthRatio = Math.max(norm1.length, norm2.length) /
                      Math.min(norm1.length, norm2.length);
  if (lengthRatio > 2) {
    return 0; // 長度相差超過 2 倍，不可能相似
  }

  // 計算 Levenshtein 相似度
  const levenshteinSim = levenshteinSimilarity(norm1, norm2);

  // 早期終止：如果 Levenshtein 相似度已經很高，直接返回
  if (levenshteinSim >= earlyStopThreshold) {
    return levenshteinSim;
  }

  // 計算 Cosine 相似度
  const cosineSim = cosineSimilarity(norm1, norm2);

  // 加權組合
  const combined = levenshteinSim * weights.levenshtein +
                   cosineSim * weights.cosine;

  return combined;
}

/**
 * 判斷標題是否重複
 * @param {string} title1
 * @param {string} title2
 * @param {number} threshold - 相似度門檻 (預設 0.8)
 * @returns {boolean}
 */
function areTitlesDuplicate(title1, title2, threshold = 0.8) {
  const similarity = calculateTitleSimilarity(title1, title2);
  return similarity >= threshold;
}

/**
 * 快速相似度計算 - 用於優化，可接受略低的精確度
 * @param {string} title1
 * @param {string} title2
 * @param {number} threshold
 * @returns {boolean}
 */
function areTitlesDuplicateFast(title1, title2, threshold = 0.8) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // 完全相同
  if (norm1 === norm2) return true;

  // 長度檢查
  const maxLen = Math.max(norm1.length, norm2.length);
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen === 0 || maxLen / minLen > 1.5) return false;

  // 只使用 Levenshtein (快速)
  const levenshteinSim = levenshteinSimilarity(norm1, norm2);
  return levenshteinSim >= threshold;
}

/**
 * 詳細相似度分析 - 用於除錯
 * @param {string} title1
 * @param {string} title2
 * @returns {object}
 */
function analyzeTitle1Similarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  const levenshteinSim = levenshteinSimilarity(norm1, norm2);
  const cosineSim = cosineSimilarity(norm1, norm2);
  const combined = levenshteinSim * 0.4 + cosineSim * 0.6;

  return {
    title1: { original: title1, normalized: norm1 },
    title2: { original: title2, normalized: norm2 },
    scores: {
      levenshtein: (levenshteinSim * 100).toFixed(2) + '%',
      cosine: (cosineSim * 100).toFixed(2) + '%',
      combined: (combined * 100).toFixed(2) + '%'
    },
    isDuplicate: combined >= 0.8
  };
}

// 測試
console.log('標題相似度測試:');
console.log(analyzeTitle1Similarity(
  'Claude 3.5 Sonnet 發布新功能',
  'Claude 3.5 Sonnet 發布了新功能'
));
// 預期: isDuplicate: true, combined >= 80%

module.exports = {
  normalizeTitle,
  calculateTitleSimilarity,
  areTitlesDuplicate,
  areTitlesDuplicateFast,
  analyzeTitle1Similarity
};
```

---

## 2. 內容指紋演算法實作

### 2.1 MD5 + SHA256 精確指紋

```javascript
/**
 * utils/content-fingerprint.js
 * 內容指紋計算 - MD5 和 SHA256
 */

const crypto = require('crypto');

/**
 * 規範化內容 - 用於指紋計算前的預處理
 * @param {string} content - 文章內容
 * @param {object} options
 * @returns {string}
 */
function normalizeContent(content, options = {}) {
  const {
    removeHtml = true,
    removeSpecialChars = true,
    normalizeChinese = true,
    minLength = 10
  } = options;

  let normalized = content;

  // 移除 HTML 標籤
  if (removeHtml) {
    normalized = normalized.replace(/<[^>]*>/g, ' ');
  }

  // 規範化空格和換行
  normalized = normalized
    .replace(/\s+/g, ' ')
    .trim();

  // 移除特殊字符
  if (removeSpecialChars) {
    normalized = normalized.replace(/[^\w\s\u4e00-\u9fff.-]/g, '');
  }

  // 轉為小寫
  normalized = normalized.toLowerCase();

  // 檢查最小長度
  if (normalized.length < minLength) {
    return ''; // 內容太短
  }

  return normalized;
}

/**
 * 計算 MD5 指紋
 * @param {string} content
 * @returns {string} 32 字符的十六進制 MD5 哈希
 */
function generateMD5Fingerprint(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return null;

  return crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex');
}

/**
 * 計算 SHA256 指紋 (更安全)
 * @param {string} content
 * @returns {string} 64 字符的十六進制 SHA256 哈希
 */
function generateSHA256Fingerprint(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return null;

  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * 計算內容的快速哈希 (用於快速查表)
 * @param {string} content
 * @returns {string} 較短的哈希值
 */
function generateQuickHash(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return null;

  // 只取 MD5 的前 16 個字符
  return crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex')
    .substring(0, 16);
}

/**
 * 檢查內容是否精確重複
 * @param {string} content1
 * @param {string} content2
 * @param {string} algorithm - 'md5' 或 'sha256'
 * @returns {boolean}
 */
function isContentExactDuplicate(content1, content2, algorithm = 'md5') {
  const generateFn = algorithm === 'sha256'
    ? generateSHA256Fingerprint
    : generateMD5Fingerprint;

  const fp1 = generateFn(content1);
  const fp2 = generateFn(content2);

  return fp1 !== null && fp2 !== null && fp1 === fp2;
}

// 測試
console.log('MD5 指紋測試:');
const content1 = 'Claude 3.5 Sonnet 現已推出，包含原生工具調用能力';
const content2 = 'Claude 3.5 Sonnet 現已推出，包含原生工具調用能力';
const content3 = 'Claude 3.5 Sonnet 現已推出。包含原生工具調用能力';

console.log('相同內容:', isContentExactDuplicate(content1, content2)); // true
console.log('不同內容:', isContentExactDuplicate(content1, content3)); // false

module.exports = {
  normalizeContent,
  generateMD5Fingerprint,
  generateSHA256Fingerprint,
  generateQuickHash,
  isContentExactDuplicate
};
```

---

### 2.2 SimHash 相似指紋

```javascript
/**
 * utils/simhash.js
 * SimHash 實作 - 相似內容指紋
 */

const crypto = require('crypto');

/**
 * 簡單分詞
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForSimHash(text) {
  // 移除特殊字符但保留詞界
  const cleaned = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ');

  const tokens = [];
  let current = '';

  for (const char of cleaned) {
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else if (/[\u4e00-\u9fff]/.test(char)) {
      if (current) {
        tokens.push(current);
      }
      tokens.push(char);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * 計算 SimHash 指紋
 * @param {string} content - 文本內容
 * @param {number} bits - 指紋位數 (通常 64)
 * @returns {string} 二進制字符串 (64 位)
 */
function generateSimHash(content, bits = 64) {
  const tokens = tokenizeForSimHash(content);

  if (tokens.length === 0) {
    return '0'.repeat(bits);
  }

  // 計算詞頻
  const tokenWeights = {};
  tokens.forEach(token => {
    tokenWeights[token] = (tokenWeights[token] || 0) + 1;
  });

  // 初始化向量
  const vector = new Array(bits).fill(0);

  // 對每個詞進行加權哈希
  for (const [token, weight] of Object.entries(tokenWeights)) {
    // 計算詞的哈希值
    const hash = crypto
      .createHash('sha256')
      .update(token)
      .digest();

    // 更新向量
    for (let i = 0; i < bits; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      // 提取第 i 位
      const bit = (hash[byteIndex] >> bitIndex) & 1;

      // 根據詞頻加權
      if (bit === 1) {
        vector[i] += weight;
      } else {
        vector[i] -= weight;
      }
    }
  }

  // 根據向量計算最終指紋
  let fingerprint = '';
  for (let i = 0; i < bits; i++) {
    fingerprint += vector[i] >= 0 ? '1' : '0';
  }

  return fingerprint;
}

/**
 * 計算 Hamming 距離 (兩個指紋之間)
 * @param {string} hash1 - 二進制字符串
 * @param {string} hash2 - 二進制字符串
 * @returns {number} 不同位數
 */
function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash 長度必須相同');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }

  return distance;
}

/**
 * 計算相似度 (基於 Hamming 距離)
 * @param {string} hash1
 * @param {string} hash2
 * @returns {number} 0-1 之間的相似度
 */
function simHashSimilarity(hash1, hash2) {
  const distance = hammingDistance(hash1, hash2);
  return 1 - (distance / hash1.length);
}

/**
 * 檢查兩個內容是否相似
 * @param {string} content1
 * @param {string} content2
 * @param {number} hammingThreshold - Hamming 距離閾值 (預設 3)
 * @returns {object}
 */
function isContentSimilar(content1, content2, hammingThreshold = 3) {
  const hash1 = generateSimHash(content1);
  const hash2 = generateSimHash(content2);

  const distance = hammingDistance(hash1, hash2);
  const similarity = simHashSimilarity(hash1, hash2);

  return {
    hash1,
    hash2,
    hammingDistance: distance,
    similarity: parseFloat((similarity * 100).toFixed(2)),
    isSimilar: distance <= hammingThreshold
  };
}

// 測試
console.log('SimHash 測試:');
const result = isContentSimilar(
  'Claude 3.5 Sonnet 發布',
  'Claude 3.5 Sonnet 發佈'  // 繁簡體差異
);
console.log(result);
// 預期 isSimilar: true, distance: 1-3

module.exports = {
  tokenizeForSimHash,
  generateSimHash,
  hammingDistance,
  simHashSimilarity,
  isContentSimilar
};
```

---

### 2.3 混合指紋系統

```javascript
/**
 * utils/fingerprint-system.js
 * 混合指紋系統 - MD5 + SimHash
 */

const { generateMD5Fingerprint, isContentExactDuplicate } = require('./content-fingerprint');
const { generateSimHash, hammingDistance, simHashSimilarity } = require('./simhash');

/**
 * 生成完整的內容指紋
 * @param {string} content
 * @returns {object}
 */
function generateContentFingerprint(content) {
  if (!content || content.length < 10) {
    return null;
  }

  return {
    md5: generateMD5Fingerprint(content),
    simHash: generateSimHash(content, 64),
    length: content.length,
    timestamp: Date.now()
  };
}

/**
 * 檢查內容是否重複
 * @param {object} fp1 - 指紋 1
 * @param {object} fp2 - 指紋 2
 * @param {object} options
 *   - mdCritical: MD5 相同即判定為重複 (預設 true)
 *   - hammingThreshold: SimHash Hamming 距離閾值 (預設 3)
 * @returns {object}
 */
function checkContentDuplicate(fp1, fp2, options = {}) {
  const {
    mdCritical = true,
    hammingThreshold = 3
  } = options;

  if (!fp1 || !fp2) {
    return {
      isDuplicate: false,
      reason: '指紋缺失',
      similarity: 0
    };
  }

  // 階段 1: MD5 精確匹配
  if (fp1.md5 === fp2.md5) {
    return {
      isDuplicate: true,
      reason: '精確重複 (MD5 相同)',
      similarity: 1.0,
      method: 'MD5'
    };
  }

  // 階段 2: SimHash 相似匹配
  const distance = hammingDistance(fp1.simHash, fp2.simHash);
  const similarity = simHashSimilarity(fp1.simHash, fp2.simHash);

  if (distance <= hammingThreshold) {
    return {
      isDuplicate: true,
      reason: `相似重複 (Hamming 距離: ${distance})`,
      similarity: parseFloat((similarity * 100).toFixed(2)),
      method: 'SimHash',
      distance
    };
  }

  return {
    isDuplicate: false,
    reason: '不同內容',
    similarity: parseFloat((similarity * 100).toFixed(2)),
    method: 'SimHash',
    distance
  };
}

/**
 * 批量檢查重複內容
 * @param {object[]} fingerprints - 指紋數組
 * @param {object} options
 * @returns {array} 重複群組
 */
function findDuplicateGroups(fingerprints, options = {}) {
  const groups = [];
  const grouped = new Set();

  for (let i = 0; i < fingerprints.length; i++) {
    if (grouped.has(i)) continue;

    const group = [i];
    grouped.add(i);

    for (let j = i + 1; j < fingerprints.length; j++) {
      if (grouped.has(j)) continue;

      const result = checkContentDuplicate(fingerprints[i], fingerprints[j], options);
      if (result.isDuplicate) {
        group.push(j);
        grouped.add(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

// 測試
console.log('混合指紋系統測試:');
const fp1 = generateContentFingerprint('Claude 3.5 發布了新功能...');
const fp2 = generateContentFingerprint('Claude 3.5 發佈了新功能...');
const fp3 = generateContentFingerprint('OpenAI GPT-5 完全不同的內容...');

console.log(checkContentDuplicate(fp1, fp2));
// 預期: isDuplicate: true, method: SimHash

console.log(checkContentDuplicate(fp1, fp3));
// 預期: isDuplicate: false

module.exports = {
  generateContentFingerprint,
  checkContentDuplicate,
  findDuplicateGroups
};
```

---

## 3. 完整去重系統實作

```javascript
/**
 * utils/deduplicator.js
 * 完整的新聞去重系統
 */

const { calculateTitleSimilarity } = require('./title-similarity');
const { generateContentFingerprint, checkContentDuplicate } = require('./fingerprint-system');

class NewsDeduplicator {
  constructor(options = {}) {
    this.options = {
      titleThreshold: options.titleThreshold || 0.8,
      hammingThreshold: options.hammingThreshold || 3,
      minContentLength: options.minContentLength || 50,
      debug: options.debug || false
    };

    this.stats = {
      inputCount: 0,
      phase1FilteredCount: 0,
      phase2DuplicateGroups: 0,
      phase3ConfirmedDuplicates: 0,
      outputCount: 0
    };
  }

  log(message) {
    if (this.options.debug) {
      console.log(`[去重系統] ${message}`);
    }
  }

  /**
   * 階段 1: 快速篩選
   */
  phase1_QuickFilter(items) {
    this.log('階段 1: 快速篩選...');

    // 過濾無效項目
    let filtered = items.filter(item => {
      if (!item.title || item.title.length < 10) {
        return false;
      }
      if (!item.content || item.content.length < this.options.minContentLength) {
        return false;
      }
      return true;
    });

    // 移除完全相同的標題
    const titleSet = new Map();
    filtered = filtered.filter(item => {
      const key = item.title.toLowerCase().trim();
      if (titleSet.has(key)) {
        return false; // 重複
      }
      titleSet.set(key, true);
      return true;
    });

    // 按時間排序 (新→舊)
    filtered.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
      const timeB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
      return timeB - timeA;
    });

    this.stats.phase1FilteredCount = filtered.length;
    this.log(`  篩選結果: ${this.stats.inputCount} → ${filtered.length} 項`);

    return filtered;
  }

  /**
   * 階段 2: 標題相似度檢測
   */
  phase2_TitleSimilarity(items) {
    this.log('階段 2: 標題相似度檢測...');

    const groups = [];
    const grouped = new Set();

    for (let i = 0; i < items.length; i++) {
      if (grouped.has(i)) continue;

      const group = [i];
      grouped.add(i);

      for (let j = i + 1; j < items.length; j++) {
        if (grouped.has(j)) continue;

        const similarity = calculateTitleSimilarity(
          items[i].title,
          items[j].title
        );

        if (similarity >= this.options.titleThreshold) {
          group.push(j);
          grouped.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    this.stats.phase2DuplicateGroups = groups.length;
    this.log(`  檢測到 ${groups.length} 個可能的重複群組`);

    return {
      groups,
      ungrouped: Array.from(new Array(items.length).keys())
        .filter(i => !grouped.has(i))
    };
  }

  /**
   * 階段 3: 內容指紋驗證
   */
  phase3_ContentFingerprint(items, titleSimilarityGroups) {
    this.log('階段 3: 內容指紋驗證...');

    const confirmedDuplicates = [];

    for (const group of titleSimilarityGroups.groups) {
      // 生成每個項目的指紋
      const fingerprints = group.map(idx => ({
        idx,
        fingerprint: generateContentFingerprint(items[idx].content)
      })).filter(fp => fp.fingerprint !== null);

      if (fingerprints.length < 2) continue;

      // 檢查群組內的重複
      const subGroups = [];
      const subGrouped = new Set();

      for (let i = 0; i < fingerprints.length; i++) {
        if (subGrouped.has(i)) continue;

        const subGroup = [fingerprints[i].idx];
        subGrouped.add(i);

        for (let j = i + 1; j < fingerprints.length; j++) {
          if (subGrouped.has(j)) continue;

          const result = checkContentDuplicate(
            fingerprints[i].fingerprint,
            fingerprints[j].fingerprint,
            { hammingThreshold: this.options.hammingThreshold }
          );

          if (result.isDuplicate) {
            subGroup.push(fingerprints[j].idx);
            subGrouped.add(j);
          }
        }

        if (subGroup.length > 1) {
          subGroups.push({
            indices: subGroup,
            method: 'verified'
          });
        }
      }

      confirmedDuplicates.push(...subGroups);
    }

    this.stats.phase3ConfirmedDuplicates = confirmedDuplicates.length;
    this.log(`  確認 ${confirmedDuplicates.length} 個重複群組`);

    return confirmedDuplicates;
  }

  /**
   * 階段 4: 版本選擇
   */
  phase4_SelectBestVersion(items, confirmedDuplicates) {
    this.log('階段 4: 版本選擇...');

    const itemsToRemove = new Set();

    for (const duplicate of confirmedDuplicates) {
      const groupItems = duplicate.indices.map(idx => ({
        idx,
        ...items[idx]
      }));

      // 計算質量評分
      const scores = groupItems.map(item => ({
        idx: item.idx,
        score: this._calculateQualityScore(item)
      }));

      scores.sort((a, b) => b.score - a.score);
      const bestIdx = scores[0].idx;

      // 記錄要移除的項目
      duplicate.indices.forEach(idx => {
        if (idx !== bestIdx) {
          itemsToRemove.add(idx);
        }
      });

      if (this.options.debug) {
        this.log(`  群組 [${duplicate.indices.join(',')}] → 選擇項目 ${bestIdx}`);
      }
    }

    // 生成最終列表
    const finalItems = items.filter((_, idx) => !itemsToRemove.has(idx));
    this.stats.outputCount = finalItems.length;

    this.log(`  最終保留: ${finalItems.length} 項，移除: ${itemsToRemove.size} 項`);

    return finalItems;
  }

  /**
   * 執行完整去重流程
   */
  deduplicate(items) {
    this.stats.inputCount = items.length;

    this.log(`\n開始去重流程 (輸入: ${items.length} 項)`);

    // 階段 1
    const filtered = this.phase1_QuickFilter(items);

    // 階段 2
    const titleGroups = this.phase2_TitleSimilarity(filtered);

    // 階段 3
    const confirmed = this.phase3_ContentFingerprint(filtered, titleGroups);

    // 階段 4
    const final = this.phase4_SelectBestVersion(filtered, confirmed);

    this.log(`\n去重完成！最終結果: ${final.length} 項\n`);

    return {
      items: final,
      stats: this.stats
    };
  }

  /**
   * 計算項目的質量評分
   */
  _calculateQualityScore(item) {
    let score = 0;

    // 1. 字數評分 (0-30)
    const contentLength = (item.content || '').length;
    score += Math.min(30, (contentLength / 100) * 30);

    // 2. 技術細節評分 (0-40)
    const technicalTerms = [
      'version', 'api', 'update', 'release', 'feature',
      '版本', '功能', '更新', '發布', '工具'
    ];
    const termsFound = technicalTerms.filter(term =>
      (item.content || '').toLowerCase().includes(term)
    ).length;
    score += Math.min(40, termsFound * 8);

    // 3. 來源層級評分 (0-20)
    if (item.tier) {
      const tierScores = { 1: 20, 2: 15, 3: 10 };
      score += tierScores[item.tier] || 10;
    }

    // 4. 時間新鮮度評分 (0-10)
    if (item.publishedAt) {
      const daysSince = (Date.now() - new Date(item.publishedAt)) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysSince * 0.42);
    }

    return score;
  }

  /**
   * 獲取統計信息
   */
  getStats() {
    return {
      ...this.stats,
      removalRate: parseFloat(
        ((1 - this.stats.outputCount / this.stats.inputCount) * 100).toFixed(2)
      ) + '%'
    };
  }
}

// 測試
console.log('完整去重系統測試:');

const deduplicator = new NewsDeduplicator({ debug: true });
const testItems = [
  {
    id: 1,
    title: 'Claude 3.5 Sonnet 發布新功能',
    content: 'Claude 3.5 Sonnet 現已推出，包含原生工具調用能力，支持...',
    source: 'Anthropic News',
    tier: 1,
    publishedAt: '2026-01-05'
  },
  {
    id: 2,
    title: 'Claude 3.5 Sonnet 發布了新功能',
    content: 'Claude 3.5 Sonnet 現已推出，包含原生工具調用能力，支持...',
    source: 'Hacker News',
    tier: 3,
    publishedAt: '2026-01-05'
  },
  {
    id: 3,
    title: 'OpenAI 發布 GPT-4o',
    content: 'OpenAI 今日發布 GPT-4o 模型，性能提升 40%...',
    source: 'OpenAI Blog',
    tier: 1,
    publishedAt: '2026-01-04'
  }
];

const result = deduplicator.deduplicate(testItems);
console.log('統計信息:', deduplicator.getStats());

module.exports = {
  NewsDeduplicator
};
```

---

## 4. 使用示例

```javascript
/**
 * examples/deduplication-example.js
 * 實際使用示例
 */

const { NewsDeduplicator } = require('../utils/deduplicator');

// 初始化去重系統
const deduplicator = new NewsDeduplicator({
  titleThreshold: 0.8,
  hammingThreshold: 3,
  minContentLength: 50,
  debug: true
});

// 示例新聞數據
const newsItems = [
  {
    id: 1,
    title: 'Claude 3.5 Sonnet 發布',
    content: 'Claude 3.5 Sonnet 現已推出，最新版本包含原生工具調用...',
    source: 'Anthropic News',
    tier: 1,
    publishedAt: '2026-01-05T08:00:00Z'
  },
  {
    id: 2,
    title: 'Claude 3.5 Sonnet 新發布',
    content: 'Claude 3.5 Sonnet 現已推出，最新版本包含原生工具調用...',
    source: 'Hacker News',
    tier: 3,
    publishedAt: '2026-01-05T08:30:00Z'
  },
  {
    id: 3,
    title: 'Cursor 編輯器 v0.40 發布',
    content: 'Cursor 編輯器今日發布 v0.40，提升 AI 功能...',
    source: 'Cursor Blog',
    tier: 2,
    publishedAt: '2026-01-05T09:00:00Z'
  },
  {
    id: 4,
    title: 'Cursor v0.40 發布新功能',
    content: 'Cursor 編輯器今日發布 v0.40，提升 AI 功能...',
    source: 'Reddit',
    tier: 3,
    publishedAt: '2026-01-05T09:15:00Z'
  }
  // ... 更多項目
];

// 執行去重
const result = deduplicator.deduplicate(newsItems);

console.log('去重結果:');
console.log(`輸入: ${deduplicator.getStats().inputCount} 項`);
console.log(`輸出: ${deduplicator.getStats().outputCount} 項`);
console.log(`移除率: ${deduplicator.getStats().removalRate}`);

console.log('\n最終新聞列表:');
result.items.forEach((item, index) => {
  console.log(`${index + 1}. [${item.tier}] ${item.title} (來源: ${item.source})`);
});
```

---

**文檔版本**: 1.0
**最後更新**: 2026-01-06
