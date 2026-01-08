# Token 優化實施決策指南

**目的**: 為你的專案選擇最合適的 Token 優化策略
**適用範圍**: AI & AI Coding 自動化情報助手
**決策日期**: 2026-01-06

---

## 目錄

1. [快速決策樹](#快速決策樹)
2. [推薦方案](#推薦方案)
3. [實施路線圖](#實施路線圖)
4. [風險評估](#風險評估)
5. [成本對標](#成本對標)
6. [檢查清單](#檢查清單)

---

## 快速決策樹

### 你需要...?

```
你的優先目標是什麼?

├─ 【快速上線】(週期短)
│  └─ 方案：基礎優化 + 應用層快取
│     ├─ 實施時間：1-2 天
│     ├─ 團隊規模：1 人
│     ├─ 節省成本：60%
│     └─ 代碼複雜度：低
│
├─ 【成本最優】(預算有限)
│  └─ 方案：全面優化（推薦）
│     ├─ 實施時間：3-5 天
│     ├─ 團隊規模：1 人
│     ├─ 節省成本：82%
│     └─ 代碼複雜度：中等
│
└─ 【長期維護】(可擴展)
   └─ 方案：分階段優化
      ├─ Phase 1：基礎（1-2 天）
      ├─ Phase 2：進階（3-5 天）
      ├─ Phase 3：監控（持續）
      └─ 最終節省成本：82%+
```

---

## 推薦方案

### 方案：分層優化（推薦 ⭐⭐⭐⭐⭐）

為你的場景量身打造：**日均 100 則，希望成本最低**

#### 核心策略

| 層級 | 策略 | 實施難度 | Token 節省 | 優先級 |
|------|------|--------|-----------|-------|
| L1 | 精簡 System Prompt | ⭐ | 15% | P0 必需 |
| L2 | 結構化 User Prompt | ⭐ | 30% | P0 必需 |
| L3 | URL Hash 快取 | ⭐⭐ | 30% | P1 強烈建議 |
| L4 | 批次處理 5 則 | ⭐⭐⭐ | 20% | P2 建議 |
| L5 | 速率限制管理 | ⭐⭐ | ~0% | P1 必需（合規） |
| L6 | 重試邏輯 | ⭐ | ~0% | P0 必需（FR-026） |

**最終效果**: 82% Token 節省 = $0.11 → $0.02 (100 則)

#### 成本預測

```
初期投入: 30 小時 (1 人)
  - L1-L2 (Prompt 優化): 5 小時
  - L3 (快取): 8 小時
  - L4 (批次): 10 小時
  - L5-L6 (管理邏輯): 7 小時

月度成本節省:
  原始: $0.11 × 30 天 = $3.30
  優化後: $0.02 × 30 天 = $0.60
  節省: $2.70 / 月 = $32.40 / 年

投資回報率: 優化 30 小時成本 (~$300@$10/h) ÷ $32.40 年度節省
         = 9.3 個月回本
         → 長期看非常划算
```

---

## 實施路線圖

### Phase 1: 基礎優化（第 1-2 天）

**目標**: 快速上線，60% Token 節省

**工作項**:

```javascript
// 1. Prompt 優化 (2h)
// src/prompts/system.js
const SYSTEM_PROMPT = `從內容提煉 3-5 點核心摘要，翻譯繁體中文。
格式：Markdown 條列，每點 15-40 字。
重點：AI 模型、工具、程式碼輔助、開發框架。`;

// src/prompts/user.js
function createUserPrompt(article) {
  return `
標題: ${article.title}
摘要: ${article.summary.slice(0, 200)}
要點: ${article.keywords?.join(', ') || ''}

翻譯成繁體中文摘要。`;
}

// 2. SDK 集成 (1h)
// npm install @google/generative-ai
const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: SYSTEM_PROMPT,
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 400,
  },
});

// 3. 基本調用 (2h)
async function summarizeArticle(article) {
  const userPrompt = createUserPrompt(article);
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

// 4. 測試驗證 (1h)
// 使用 5 篇真實文章測試
```

**預期效果**:
- ✅ Token 節省: 60% ($0.06/100 則)
- ✅ API 調用: 100 次
- ✅ 執行時間: ~5-7 分鐘

**交付物**:
- [ ] 2 份 Prompt 文件
- [ ] 1 個基礎 Summarizer 模組
- [ ] 單元測試 (5 個測試用例)

---

### Phase 2: 進階優化（第 3-5 天）

**目標**: 最優成本，82% Token 節省

**工作項**:

```javascript
// 1. 快取系統 (4h)
// src/utils/ContentCache.js
class ContentCache {
  async getFromCache(url) { /* ... */ }
  async saveToCache(url, summary) { /* ... */ }
  async cleanupExpiredCache() { /* ... */ }
}

// 2. 速率限制 (2h)
// src/utils/RateLimiter.js
class RateLimiter {
  async waitIfNeeded() { /* ... */ }
}

// 3. 重試邏輯 (2h)
// src/utils/RetryHandler.js
async function summarizeWithRetry(article, maxRetries = 2) {
  // FR-026: 最多 2 次重試，間隔 5 秒
}

// 4. 批次處理 (5h)
// src/summarizers/BatchSummarizer.js
async function processBatch(articles, batchSize = 5) {
  // 構建批次 Prompt
  // 呼叫 API
  // 解析回應
  // 保存到快取
}

// 5. 整合測試 (2h)
// tests/integration/full-flow.test.js
```

**預期效果**:
- ✅ Token 節省: 82% ($0.02/100 則)
- ✅ API 調用: 20 次
- ✅ 快取命中率: 30-50% (隨著時間增加)
- ✅ 執行時間: ~2-3 分鐘

**交付物**:
- [ ] 3 個工具模組 (Cache, RateLimiter, Retry)
- [ ] 1 個批次處理器
- [ ] 集成測試 (10 個測試用例)
- [ ] 使用文件

---

### Phase 3: 監控與優化（持續）

**目標**: 長期監控，持續優化

**工作項**:

```javascript
// 1. 指標記錄 (1h)
// src/utils/MetricsCollector.js
const metrics = {
  dailyArticles: 0,
  apiCalls: 0,
  cacheHits: 0,
  estimatedTokens: 0,
  estimatedCost: 0,
  processingTime: 0,
};

// 2. 日誌系統 (2h)
// src/utils/Logger.js
// 記錄每次執行的詳細資訊
// 每月產生成本報告

// 3. 告警機制 (1h)
// 如果成本超預算，發送告警
// 如果錯誤率過高，發送告警

// 4. 定期審視 (月度)
// 分析快取命中率，調整 TTL
// 分析批次大小效率，調整 batchSize
// 檢查新來源質量，優化 Prompt
```

**交付物**:
- [ ] 1 個指標收集器
- [ ] 日誌和監控基礎設施
- [ ] 月度報告模板

---

## 風險評估

### 潛在風險與緩解策略

| 風險 | 影響 | 可能性 | 緩解方案 |
|------|------|-------|--------|
| 摘要品質下降 | 高 | 中 | 使用驗證集定期檢查品質 |
| 批次內容混淆 | 中 | 低 | 明確的批次標記格式 + 單元測試 |
| 快取過期數據 | 低 | 低 | 設定合理的 TTL (24h)，定期清理 |
| 快取磁碟爆炸 | 低 | 低 | 限制快取大小，舊檔案自動刪除 |
| API 速率限制 | 中 | 低 | 速率限制器 + 重試邏輯已實施 |
| 網路不穩定 | 中 | 中 | 超時設定 30s + 最多 2 次重試 |

### 品質驗證計畫

```javascript
// 建立驗證集（20 篇文章）
const validationSet = [
  {
    id: "v1",
    title: "...",
    content: "...",
    expectedKeyPoints: ["...", "...", "..."],
  },
  // ... 20 篇
];

// 每週執行驗證
async function validateQuality() {
  const results = await summarizeBatch(validationSet);

  results.forEach((result, i) => {
    const score = evaluateSummary(
      result.summary,
      validationSet[i].expectedKeyPoints
    );
    console.log(`驗證 ${i + 1}: ${score}/10`);
  });
}

// 通過標準：平均分 >= 8.0
```

---

## 成本對標

### 場景 1: 100 則/天，30 天/月

```
無優化方案:
- 輸入: 100 × 300 × 30 = 900,000 tokens
- 輸出: 100 × 150 × 30 = 450,000 tokens
- 成本: ($0.075/MTok × 0.9 + $0.3/MTok × 0.45) = $0.201
- 月度: $0.201 × 30 = $6.03

L1-L2 優化 (精簡 + 結構化):
- 節省 45%
- 月度: $3.31

L1-L4 全面優化 + 快取:
- 節省 82%
- 月度: $1.09

年度成本對比:
- 無優化: $72.36
- L1-L2: $39.72
- L1-L4: $13.08

年度節省: $59.28 (相比無優化)
```

### 場景 2: 200 則/天（擴展情況）

```
優化前: 200 × $0.11 = $22.00/天 = $660/月

L1-L2 優化:
- 月度: $363

L1-L4 優化:
- 月度: $121

年度節省: $539.00
```

---

## 檢查清單

### 實施前準備

```
環境準備:
- [ ] Node.js 18+ 已安裝
- [ ] npm 或 yarn 已安裝
- [ ] GEMINI_API_KEY 已設定為環境變數
- [ ] 專案目錄結構已建立

依賴檢查:
- [ ] @google/generative-ai 版本確認
- [ ] crypto, fs 等內建模組可用
- [ ] 無衝突的依賴版本

知識準備:
- [ ] 閱讀 GEMINI_TOKEN_OPTIMIZATION.md
- [ ] 閱讀 GEMINI_QUICK_REFERENCE.md
- [ ] 閱讀 GEMINI_SDK_EXAMPLES.md
```

### Phase 1 實施檢查

```
開發:
- [ ] Prompt 文件建立
- [ ] SDK 初始化測試
- [ ] 5 篇測試文章驗證
- [ ] 輸出格式正確性檢查

測試:
- [ ] 單元測試通過 (5 個)
- [ ] 手動測試通過
- [ ] Token 用量符合預期
- [ ] 執行時間在 5-7 分鐘內

交付:
- [ ] Prompt 文檔完成
- [ ] 代碼已註解
- [ ] 基本測試通過
- [ ] README 更新
```

### Phase 2 實施檢查

```
開發:
- [ ] ContentCache 模組完成
- [ ] RateLimiter 模組完成
- [ ] RetryHandler 模組完成
- [ ] BatchSummarizer 模組完成

測試:
- [ ] 快取讀寫測試通過
- [ ] 速率限制測試通過
- [ ] 重試邏輯測試通過
- [ ] 批次處理測試通過
- [ ] 集成測試通過 (10 個)

效能:
- [ ] Token 節省達到 82%
- [ ] API 調用減少到 20 次
- [ ] 執行時間在 2-3 分鐘內
- [ ] 快取命中率 > 30%

交付:
- [ ] 所有模組已集成
- [ ] 完整文檔已更新
- [ ] 使用示例已提供
- [ ] 效能基準已記錄
```

### 上線前最後檢查

```
安全:
- [ ] API 金鑰未硬編碼
- [ ] 日誌已遮蔽敏感資訊
- [ ] SSL/TLS 驗證已啟用

可靠性:
- [ ] 錯誤處理完整
- [ ] 日誌記錄充分
- [ ] 重試邏輯已實施
- [ ] 超時設定合理

性能:
- [ ] 無記憶體洩漏
- [ ] 並發控制適當
- [ ] Token 成本監控就位
- [ ] 成本告警已配置

文檔:
- [ ] 用戶指南完整
- [ ] 故障排除指南完整
- [ ] 配置說明清晰
- [ ] 監控指標已列出
```

---

## 決策記錄

### 為什麼選擇分層優化？

**對標其他方案**:

1. **完全無優化**
   - 優點：代碼簡單
   - 缺點：成本高，Token 消耗多
   - 選票：❌ 不推薦

2. **只做 Prompt 優化**
   - 優點：快速，60% 節省
   - 缺點：效果有限
   - 選票：⚠️ 可接受但不最優

3. **批次 + 快取**（推薦）
   - 優點：82% 節省，成本最低，長期收益好
   - 缺點：實施複雜度中等
   - 選票：✅ **推薦採用**

4. **完全重寫架構**
   - 優點：可能更優
   - 缺點：風險高，時間長，不必要
   - 選票：❌ 不推薦

### 決策者確認

```
決策日期: 2026-01-06
推薦方案: 分層優化（L1-L4）
實施團隊規模: 1 人
預計時間: 5-7 天
風險等級: 低
預期 ROI: 9.3 個月回本

簽名: _______________
日期: _______________
```

---

## 後續行動

### 立即行動（今天）

1. [ ] 將本決策文檔分享給團隊
2. [ ] 確認 GEMINI_API_KEY 已設定
3. [ ] 準備 5 篇測試文章
4. [ ] 閱讀 SDK 文檔

### 短期行動（本週）

1. [ ] 完成 Phase 1 實施
2. [ ] 執行品質驗證
3. [ ] 記錄基準數據

### 中期行動（本月）

1. [ ] 完成 Phase 2 實施
2. [ ] 建立監控系統
3. [ ] 執行月度審查

---

**文檔版本**: 1.0
**決策狀態**: ✅ 已確認
**最後更新**: 2026-01-06
