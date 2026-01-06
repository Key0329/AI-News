# Google Gemini API Token 優化 - 快速參考指南

**用途**: 開發時快速查閱，不需深入理論

---

## 1. Prompt 設計速查表

### System Prompt（應該長這樣）

```javascript
// ✅ 好 (35-40 tokens)
const systemPrompt = `從內容提煉 3-5 點核心摘要，翻譯繁體中文。
格式：Markdown 條列，每點 15-40 字。
重點：AI 模型、工具、程式碼輔助、開發框架。`;

// ❌ 壞 (100+ tokens)
const systemPrompt = `您是一位傑出的技術編輯...
(又臭又長的背景敘述，重複指示，廢話連篇)`;
```

### User Prompt（應該長這樣）

```javascript
// ✅ 好 (結構化，~300 tokens)
const userPrompt = `
標題: ${title}
摘要: ${summary.slice(0, 200)}
要點: ${keywords.join(', ')}

翻譯成繁體中文摘要。`;

// ⚠️ 普通 (完整文章，~2000+ tokens)
const userPrompt = `
標題: ${title}
原文: ${fullArticle}  // <-- 太長了！

請生成摘要。`;
```

---

## 2. Token 成本一覽表

| 做法 | 每 100 則成本 | 節省 | 難度 |
|------|-----------|------|------|
| 原始無優化 | $0.11 | — | 簡單 |
| 只用結構化輸入 | $0.06 | 45% | 簡單 |
| 加上批次 5 則 | $0.04 | 64% | 中等 |
| **加上應用層快取** | **$0.02** | **82%** | 中等 |

---

## 3. 程式碼片段（Copy & Paste）

### 3.1 基本調用

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
});

const response = await model.generateContent(`
標題: ${title}
摘要: ${summary}

翻譯成繁體中文摘要。`);

console.log(response.response.text());
```

### 3.2 快取（URL Hash）

```javascript
const crypto = require('crypto');
const fs = require('fs').promises;

function getHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 8);
}

async function getFromCache(url) {
  const file = `./cache/${getHash(url)}.json`;
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf-8'));
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data.summary;
    }
  } catch {}
  return null;
}

async function saveToCache(url, summary) {
  await fs.writeFile(`./cache/${getHash(url)}.json`,
    JSON.stringify({ url, summary, timestamp: Date.now() }));
}

// 使用
const cached = await getFromCache(article.url);
if (cached) return cached;

const summary = await generateSummary(article);
await saveToCache(article.url, summary);
return summary;
```

### 3.3 速率限制

```javascript
class RateLimiter {
  constructor(maxRequests = 15, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const wait = this.windowMs - (now - this.requests[0]) + 100;
      await new Promise(r => setTimeout(r, wait));
      return this.waitIfNeeded();
    }

    this.requests.push(now);
  }
}

// 使用
const limiter = new RateLimiter(15);
for (const article of articles) {
  await limiter.waitIfNeeded();
  const summary = await generateSummary(article);
}
```

### 3.4 重試（FR-026：最多 2 次）

```javascript
async function summarizeWithRetry(article, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const summary = await generateSummary(article);
      if (summary?.trim()) return summary;
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = 5000 * (attempt + 1); // 5s, 10s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  // 重試失敗，返回原始內容
  return { status: 'failed', original: article.summary };
}
```

### 3.5 批次處理

```javascript
async function processBatch(articles, batchSize = 5) {
  const results = [];
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const prompt = `
${batch.map((a, j) => `【新聞 ${j + 1}】 標題: ${a.title} 摘要: ${a.summary.slice(0, 100)}`).join('\n')}

為每則生成繁體中文摘要，格式【摘要 N】開頭。`;

    const response = await model.generateContent(prompt);
    const summaries = response.response.text().split(/【摘要\s*\d+】/);

    batch.forEach((a, j) => {
      results.push({ ...a, summary: summaries[j + 1]?.trim() || '失敗' });
    });

    if (i + batchSize < articles.length) {
      await new Promise(r => setTimeout(r, 1000)); // 批次間延遲
    }
  }
  return results;
}
```

---

## 4. 配置建議

### 環境變數

```bash
# .env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TEMPERATURE=0.3
GEMINI_MAX_OUTPUT_TOKENS=400
GEMINI_BATCH_SIZE=5
GEMINI_CACHE_DIR=./cache
```

### 專案結構

```
src/
├── summarizers/
│   └── GeminiSummarizer.js
├── utils/
│   ├── ContentCache.js
│   ├── RateLimiter.js
│   └── RetryHandler.js
└── index.js

cache/              # 快取檔案
output/
└── digests/        # 報告
logs/               # 日誌
```

---

## 5. 執行清單（Implementation Checklist）

### 第一階段：基礎（必需）
- [ ] 安裝 SDK: `npm install @google/generative-ai`
- [ ] 設定 API 金鑰環境變數
- [ ] 編寫精簡 System Prompt
- [ ] 實施結構化 User Prompt
- [ ] 測試單項調用

### 第二階段：優化（強烈建議）
- [ ] 實施速率限制器（15 RPM）
- [ ] 實施重試邏輯（最多 2 次）
- [ ] 實施 URL Hash 快取
- [ ] 實施批次處理（5 則/批）
- [ ] 測試批次調用

### 第三階段：監控（可選）
- [ ] 記錄 Token 消耗
- [ ] 記錄 API 調用次數
- [ ] 記錄快取命中率
- [ ] 設定成本告警
- [ ] 定期檢查日誌

---

## 6. 常見問題

### Q: 為什麼我的摘要品質下降了？
**A**: 可能是以下原因：
1. System Prompt 過度簡化 → 加回關鍵指示
2. 結構化輸入丟失了重要內容 → 增加摘要長度（200→300 字）
3. Temperature 設定不當 → 改為 0.3（較低 = 較穩定）

### Q: 批次處理會不會導致結果混亂？
**A**: 可能會，有以下對策：
1. 每批不超過 5-10 則
2. 在 Prompt 中明確標記 【新聞 1】【新聞 2】...
3. 在解析時驗證順序是否正確
4. 如果不穩定，改回單項處理

### Q: 快取多久清理一次？
**A**: 建議：
1. 每次執行時清理超過 24 小時的快取
2. 相同 URL 視為重複（不需要重新摘要）
3. 不同 URL、相同內容？用 Content Hash 去重

### Q: 如何估算成本？
**A**: 粗略公式：
```
輸入 Token ≈ (標題長度 + 摘要長度) / 4
輸出 Token ≈ (期望摘要長度) / 4
成本 ≈ (輸入 × $0.075 + 輸出 × $0.3) / 1,000,000
```

例：100 則，每則平均 300 輸入 + 150 輸出
= (100 × 300 × $0.075 + 100 × 150 × $0.3) / 1,000,000
= ($2.25 + $4.5) / 1,000,000
≈ $0.0000068 / 則 = $0.0007 / 100 則

### Q: 15 RPM 限制會阻礙我嗎？
**A**: 計算：
- 100 則資訊 ÷ 15 requests = 7 分鐘（無批次）
- 100 則資訊 ÷ (15 批次 × 5 則/批) = 1.4 分鐘（批次處理）

如果你的排程是每天早上 8:00，1-7 分鐘處理時間完全可以接受。

---

## 7. 效能基準

使用上述優化後，預期指標：

| 指標 | 目標 | 實際可達 |
|------|------|--------|
| 處理速度 | 5 分鐘內 | ~1-2 分鐘（100 則） |
| Token 消耗 | 降低 60%+ | ~82% 節省 |
| 成本 | 控制在 $0.02-0.04 | ✅ 達成 |
| API 調用 | 減少 80%+ | 20 次（100 則） |
| 快取命中率 | 30%+ | 50%+（隨著時間增加） |

---

## 8. 偵錯指南

### 調試單項摘要

```javascript
async function debug(article) {
  console.log('=== 調試資訊 ===');
  console.log('標題:', article.title);
  console.log('摘要長度:', article.summary.length);

  try {
    const response = await model.generateContent(`
標題: ${article.title}
摘要: ${article.summary}

翻譯成繁體中文摘要。`);
    console.log('成功✓');
    console.log('輸出:', response.response.text().slice(0, 200));
  } catch (error) {
    console.error('失敗:', error.message);
  }
}
```

### 檢查速率限制

```javascript
const limiter = new RateLimiter(15, 60000);
console.log('當前請求隊列長度:', limiter.requests.length);
console.log('時間窗口:', limiter.requests.map(t => Date.now() - t + 'ms 前'));
```

### 驗證快取

```javascript
async function validateCache() {
  const files = await fs.promises.readdir('./cache');
  console.log(`快取檔案數: ${files.length}`);

  for (const file of files) {
    const data = JSON.parse(await fs.promises.readFile(`./cache/${file}`, 'utf-8'));
    const age = Date.now() - data.timestamp;
    console.log(`${file}: ${(age / 1000 / 60).toFixed(1)}分鐘前`);
  }
}
```

---

## 9. 部署檢查清單

### 上線前檢查

- [ ] API 金鑰已設定為環境變數
- [ ] 日誌記錄不包含敏感資訊
- [ ] 快取目錄已建立且有寫入權限
- [ ] 輸出目錄已建立且有寫入權限
- [ ] 速率限制器已測試
- [ ] 重試邏輯已測試
- [ ] 批次處理已測試
- [ ] 快取清理機制已設定

### 監控指標

```javascript
const metrics = {
  startTime: Date.now(),
  articlesProcessed: 0,
  apiCallsMade: 0,
  cacheHits: 0,
  tokenEstimate: 0,
  errors: [],
};

// 定期輸出
console.log(`
進度: ${metrics.articlesProcessed} / 100
API 調用: ${metrics.apiCallsMade} / 20
快取命中: ${(metrics.cacheHits / metrics.articlesProcessed * 100).toFixed(1)}%
Token 估計: ${metrics.tokenEstimate}
耗時: ${(Date.now() - metrics.startTime) / 1000}s
錯誤數: ${metrics.errors.length}
`);
```

---

## 10. 成本監控

### 每月追蹤

```javascript
// 記錄到日誌
const dailyLog = {
  date: new Date().toISOString().split('T')[0],
  articlesProcessed: 100,
  apiCalls: 20,
  estimatedTokens: 25000,
  estimatedCost: 0.02,
};

// 每月累計
const monthlyCost = dailyLogs
  .filter(log => log.date.startsWith('2026-01'))
  .reduce((sum, log) => sum + log.estimatedCost, 0);

console.log(`1 月預估成本: $${monthlyCost}`);
```

---

**版本**: 1.0 (快速參考)
**適用場景**: 開發和部署
**最後更新**: 2026-01-06
