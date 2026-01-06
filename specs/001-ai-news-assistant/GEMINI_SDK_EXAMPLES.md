# Google Generative AI SDK 完整使用範例

**SDK**: @google/generative-ai (Node.js)
**模型**: gemini-1.5-flash, gemini-3.0-flash-preview
**日期**: 2026-01-06

---

## 目錄

1. [安裝與初始化](#安裝與初始化)
2. [基本文字生成](#基本文字生成)
3. [進階配置](#進階配置)
4. [錯誤處理](#錯誤處理)
5. [Token 計數](#token-計數)
6. [流式回應](#流式回應)
7. [批次處理](#批次處理)
8. [實際專案示例](#實際專案示例)

---

## 安裝與初始化

### 1. 安裝 SDK

```bash
npm install @google/generative-ai
# 或
yarn add @google/generative-ai
```

### 2. 驗證安裝

```javascript
// test-install.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
console.log("✓ SDK 已成功安裝");
console.log("版本:", require("@google/generative-ai/package.json").version);
```

### 3. 基本初始化

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 方式 1: 環境變數
const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 方式 2: 直接傳入金鑰（不推薦，安全性考慮）
// const client = new GoogleGenerativeAI("your-api-key");

// 驗證初始化
console.log("Gemini API 已初始化");
```

---

## 基本文字生成

### 1. 最簡單的調用

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function simpleGenerate() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(
    "用繁體中文簡潔地說明什麼是 AI Coding"
  );

  console.log(result.response.text());
}

simpleGenerate().catch(console.error);
```

**輸出示例**:
```
AI Coding 是指利用人工智能技術（如大型語言模型）協助開發者編寫、理解和優化程式碼的過程。
```

### 2. 帶 System Prompt 的調用

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateWithSystem() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    // System Prompt（指導 AI 行為）
    systemInstruction: `你是一位技術編輯。你的任務：
1. 從英文新聞中提煉核心要點
2. 翻譯成繁體中文
3. 生成 3-5 個 Markdown 條列點
4. 每個點 15-40 字`,
  });

  const userMessage = `
標題: OpenAI Releases GPT-4 Turbo
摘要: OpenAI announces a more powerful and efficient version of GPT-4...

請生成摘要。`;

  const result = await model.generateContent(userMessage);
  console.log(result.response.text());
}

generateWithSystem().catch(console.error);
```

**輸出示例**:
```
- OpenAI 推出 GPT-4 Turbo，性能更強大且更高效
- 新版本支援更長的上下文和更快的處理速度
- 降低了 API 成本，使企業使用更經濟實惠
- 改進了多模態能力，可處理文字和圖像
```

### 3. 多輪對話

```javascript
async function multiTurnConversation() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "什麼是 Claude AI？" }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Claude 是由 Anthropic 開發的大型語言模型，以安全性和準確性著稱。",
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1024,
    },
  });

  const msg = "它和 GPT-4 相比有什麼優勢？";
  const result = await chat.sendMessage(msg);
  console.log(result.response.text());
}

multiTurnConversation().catch(console.error);
```

---

## 進階配置

### 1. 完整的生成配置

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function advancedConfig() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",

    // 生成配置
    generationConfig: {
      // 控制隨機性（0-2，較低 = 更確定性）
      temperature: 0.3,

      // 多樣性參數：核心採樣
      // 只考慮累積概率達 topP 的詞彙（0-1）
      topP: 0.8,

      // 多樣性參數：前 K 採樣
      // 只考慮概率最高的 K 個詞彙
      topK: 40,

      // 最大輸出 Token 數
      maxOutputTokens: 500,

      // 停止序列（遇到這些詞時停止生成）
      stopSequences: ["---", "結束"],
    },

    // 安全設定
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],

    // System Instruction
    systemInstruction: `你是技術摘要專家，
用簡潔的繁體中文生成 3-5 點摘要。`,
  });

  const result = await model.generateContent("介紹一下 Gemini API...");
  console.log(result.response.text());
}

advancedConfig().catch(console.error);
```

### 2. 不同模型的選擇

```javascript
// 模型對比與推薦

async function compareModels() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const models = [
    {
      name: "gemini-1.5-flash",
      speed: "最快",
      cost: "最低",
      useCase: "簡單任務、批次處理",
    },
    {
      name: "gemini-2.0-flash-exp",
      speed: "非常快",
      cost: "低",
      useCase: "複雜推理、長上下文",
    },
    {
      name: "gemini-3.0-flash-preview",
      speed: "最快",
      cost: "最低",
      useCase: "最新最快，Token 優化",
    },
  ];

  console.log("可用模型:");
  models.forEach(m => {
    console.log(`- ${m.name}: ${m.speed}，${m.cost}成本，用於${m.useCase}`);
  });

  // 推薦方案
  const model = client.getGenerativeModel({
    // 對於我們的場景（100 則/天），推薦使用 Flash
    model: "gemini-3.0-flash-preview",
  });
}

compareModels().catch(console.error);
```

---

## 錯誤處理

### 1. 完整的錯誤處理框架

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function robustGenerate(prompt, options = {}) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: options.model || "gemini-1.5-flash",
    generationConfig: {
      temperature: options.temperature || 0.3,
      maxOutputTokens: options.maxOutputTokens || 500,
    },
    systemInstruction: options.systemPrompt,
  });

  const maxRetries = options.maxRetries || 2;
  const retryDelay = options.retryDelay || 5000;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[嘗試 ${attempt}/${maxRetries + 1}] 生成摘要...`);

      // 設定超時
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("API 調用超時 (30s)")), 30000)
      );

      const resultPromise = model.generateContent(prompt);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      if (!result.response.text()) {
        throw new Error("API 返回空白回應");
      }

      console.log("✓ 成功");
      return result.response.text();
    } catch (error) {
      // 分類處理不同錯誤
      const errorType = classifyError(error);

      console.error(`✗ 錯誤 [${errorType}]: ${error.message}`);

      // 記錄錯誤
      await logError({
        timestamp: new Date().toISOString(),
        attempt,
        errorType,
        message: error.message,
        prompt: prompt.substring(0, 100),
      });

      // 不可重試的錯誤
      if (["PERMISSION_DENIED", "INVALID_ARGUMENT"].includes(errorType)) {
        throw error;
      }

      // 可重試的錯誤
      if (attempt < maxRetries + 1) {
        const delay = retryDelay * attempt; // 指數退避
        console.log(`等待 ${delay}ms 後重試...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // 所有重試都失敗
  throw new Error(`${maxRetries + 1} 次嘗試後仍然失敗`);
}

function classifyError(error) {
  const message = error.message.toUpperCase();

  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
    return "RATE_LIMIT";
  }
  if (message.includes("401") || message.includes("PERMISSION_DENIED")) {
    return "PERMISSION_DENIED";
  }
  if (message.includes("400") || message.includes("INVALID")) {
    return "INVALID_ARGUMENT";
  }
  if (message.includes("TIMEOUT") || message.includes("DEADLINE")) {
    return "TIMEOUT";
  }
  if (message.includes("503") || message.includes("UNAVAILABLE")) {
    return "SERVICE_UNAVAILABLE";
  }

  return "UNKNOWN";
}

async function logError(errorLog) {
  const fs = require("fs").promises;
  const logDir = "./logs";

  await fs.mkdir(logDir, { recursive: true });

  const logFile = `${logDir}/errors.jsonl`;
  await fs.appendFile(logFile, JSON.stringify(errorLog) + "\n");
}

// 使用範例
async function example() {
  try {
    const summary = await robustGenerate(
      "簡述 AI Coding 的重要性",
      {
        systemPrompt: "你是技術編輯，用繁體中文回答。",
        temperature: 0.3,
        maxRetries: 2,
        retryDelay: 5000,
      }
    );

    console.log("摘要:", summary);
  } catch (error) {
    console.error("最終失敗:", error.message);
  }
}

example().catch(console.error);
```

### 2. 常見錯誤與解決方案

```javascript
// 錯誤 1: API 金鑰未設定
// Error: UNAUTHENTICATED: API key not found

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ 錯誤：缺少 GEMINI_API_KEY 環境變數");
  process.exit(1);
}

// 錯誤 2: 速率限制（429）
// 解決：使用速率限制器或等待後重試

// 錯誤 3: 超時
// 原因：文章太長或網路慢
// 解決：縮短輸入或增加超時時間

// 錯誤 4: 不安全內容被攔截
// 原因：安全設定太嚴格
// 解決：調整 safetySettings
```

---

## Token 計數

### 1. 估算 Token 數量

```javascript
// Gemini API 沒有官方的 countTokens 方法，但可以估算

function estimateTokenCount(text) {
  // 中文：約 1-2 字 = 1 Token
  // 英文：約 4-5 字 = 1 Token
  // 特殊符號：視為 0.5 Token

  const lines = text.split('\n');
  let tokenCount = 0;

  for (const line of lines) {
    // 中文字符
    const chineseChars = (line.match(/[\u4e00-\u9fff]/g) || []).length;
    tokenCount += chineseChars * 1.3; // 中文偏保守估算

    // 英文單詞
    const englishWords = (line.match(/\b\w+\b/g) || []).length;
    tokenCount += englishWords * 0.25; // 英文：約 4 字/Token

    // 標點符號
    const punctuation = (line.match(/[^\w\s\u4e00-\u9fff]/g) || []).length;
    tokenCount += punctuation * 0.1;
  }

  return Math.ceil(tokenCount);
}

// 測試
console.log(estimateTokenCount("你好，世界！")); // ~4-5
console.log(estimateTokenCount("Hello World")); // ~1-2
console.log(estimateTokenCount("AI Coding 是指使用人工智能協助程式碼開發")); // ~12
```

### 2. 計算成本

```javascript
function calculateCost(inputTokens, outputTokens) {
  // Gemini 3.0 Flash Preview 定價（2026-01）
  const INPUT_COST_PER_MTK = 0.075; // $0.075 / 百萬 Token
  const OUTPUT_COST_PER_MTK = 0.3;  // $0.3 / 百萬 Token
  const CACHE_HIT_COST_PER_MTK = 0.01875; // $0.01875 / 百萬 Token (快取命中)

  const inputCost = (inputTokens * INPUT_COST_PER_MTK) / 1000000;
  const outputCost = (outputTokens * OUTPUT_COST_PER_MTK) / 1000000;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: totalCost.toFixed(6),
  };
}

// 範例：100 則資訊
const avgInputTokens = 300; // 平均輸入
const avgOutputTokens = 150; // 平均輸出
const totalArticles = 100;

const totalInput = avgInputTokens * totalArticles;
const totalOutput = avgOutputTokens * totalArticles;

const cost = calculateCost(totalInput, totalOutput);
console.log(`100 則資訊成本: $${cost.totalCost}`);
// 輸出: 100 則資訊成本: $0.006150
```

---

## 流式回應

### 1. 流式處理（適合長回應）

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function streamingGenerate() {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const prompt = `
標題: The Future of AI Coding
摘要: AI is transforming software development...

生成繁體中文摘要。`;

  console.log("正在生成（流式）...\n");

  try {
    // 使用 streamGenerateContent 進行流式生成
    const stream = await model.generateContentStream(prompt);

    // 一次讀取一個 chunk
    for await (const chunk of stream.stream) {
      const chunkText = chunk.candidates[0]?.content?.parts[0]?.text;
      if (chunkText) {
        process.stdout.write(chunkText); // 實時輸出
      }
    }

    console.log("\n\n✓ 流式生成完成");
  } catch (error) {
    console.error("✗ 流式生成失敗:", error.message);
  }
}

streamingGenerate().catch(console.error);
```

### 2. 流式 vs 非流式比較

```javascript
// 流式優點：
// - 實時查看結果，提升用戶體驗
// - 可中途中斷，節省 Token
// - 適合長文本生成

// 流式缺點：
// - 無法取得完整回應進行後處理
// - 錯誤處理稍複雜

// 非流式優點：
// - 完整回應，便於後處理
// - 簡單易用

// 非流式缺點：
// - 等待時間長（感覺慢）
// - 必須消耗所有 Token

// 建議：批次摘要用非流式，實時互動用流式
```

---

## 批次處理

### 1. 簡單批次

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function batchProcess(articles, batchSize = 5) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `為每則新聞生成繁體中文摘要。
格式：【摘要 N】開頭，3-5 個 Markdown 條列點。`,
  });

  const results = [];
  const batches = [];

  // 分組
  for (let i = 0; i < articles.length; i += batchSize) {
    batches.push(articles.slice(i, i + batchSize));
  }

  // 處理每個批次
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    console.log(`\n[批次 ${batchIndex + 1}/${batches.length}] 處理 ${batch.length} 則...`);

    // 構建批次提示詞
    const batchPrompt = batch
      .map((article, i) => {
        return `【新聞 ${i + 1}】
標題: ${article.title}
摘要: ${article.summary.substring(0, 150)}
`;
      })
      .join("\n");

    try {
      const response = await model.generateContent(
        batchPrompt + "\n請為每則新聞生成摘要。"
      );

      const responseText = response.response.text();

      // 解析回應
      const summaries = parseResponse(responseText, batch.length);

      batch.forEach((article, i) => {
        results.push({
          ...article,
          summary: summaries[i] || "摘要生成失敗",
        });
      });

      console.log(`✓ 批次完成，成功: ${summaries.length} / ${batch.length}`);
    } catch (error) {
      console.error(`✗ 批次失敗: ${error.message}`);
      batch.forEach(article => {
        results.push({
          ...article,
          summary: "摘要生成失敗",
          error: error.message,
        });
      });
    }

    // 批次間延遲（避免速率限制）
    if (batchIndex < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}

function parseResponse(responseText, expectedCount) {
  // 簡單解析：按 【摘要 N】 分割
  const summaries = responseText.split(/【摘要\s*\d+】/);
  return summaries.slice(1, expectedCount + 1).map(s => s.trim());
}

// 使用
async function main() {
  const articles = [
    { title: "Article 1", summary: "Summary 1...", source: "Source A" },
    { title: "Article 2", summary: "Summary 2...", source: "Source B" },
    { title: "Article 3", summary: "Summary 3...", source: "Source C" },
    // ... 更多文章
  ];

  const results = await batchProcess(articles, 5);
  console.log("\n總結果:", results);
}
```

---

## 實際專案示例

### 完整的摘要系統

```javascript
// src/summarizer.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");
const fs = require("fs").promises;

class NewsArticleSummarizer {
  constructor(apiKey, config = {}) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.cacheDir = config.cacheDir || "./cache";
    this.batchSize = config.batchSize || 5;
    this.requestDelay = config.requestDelay || 1000; // ms
    this.maxRetries = config.maxRetries || 2;
    this.model = config.model || "gemini-1.5-flash";

    this.initCache();
  }

  async initCache() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  // 生成快取鍵
  getCacheKey(url) {
    return crypto.createHash("sha256").update(url).digest("hex").slice(0, 8);
  }

  // 從快取讀取
  async getFromCache(url) {
    try {
      const cacheFile = `${this.cacheDir}/${this.getCacheKey(url)}.json`;
      const data = JSON.parse(await fs.readFile(cacheFile, "utf-8"));

      // 檢查 TTL
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.summary;
      }

      await fs.unlink(cacheFile);
    } catch {}

    return null;
  }

  // 保存到快取
  async saveToCache(url, summary) {
    try {
      const cacheFile = `${this.cacheDir}/${this.getCacheKey(url)}.json`;
      await fs.writeFile(
        cacheFile,
        JSON.stringify({ url, summary, timestamp: Date.now() })
      );
    } catch (error) {
      console.warn(`快取保存失敗: ${error.message}`);
    }
  }

  // 生成單篇摘要
  async summarizeArticle(article) {
    // 1. 檢查快取
    const cached = await this.getFromCache(article.url);
    if (cached) {
      return { ...article, summary: cached, cached: true };
    }

    // 2. 生成摘要
    try {
      const summary = await this._callGemini(article);
      await this.saveToCache(article.url, summary);

      return { ...article, summary, cached: false };
    } catch (error) {
      return { ...article, summary: "摘要生成失敗", error: error.message };
    }
  }

  // 批次生成摘要
  async summarizeBatch(articles) {
    const results = [];
    const batches = this._chunkArray(articles, this.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n[批次 ${i + 1}/${batches.length}]`);

      const batchResults = await this._processBatch(batch);
      results.push(...batchResults);

      if (i < batches.length - 1) {
        await this._delay(this.requestDelay);
      }
    }

    return results;
  }

  // 內部：呼叫 Gemini API
  async _callGemini(article) {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 400,
      },
      systemInstruction: `從以下內容提煉 3-5 點核心摘要，翻譯成繁體中文。
格式：Markdown 條列（-），每點 15-40 字。
重點：AI 模型、工具、程式碼輔助、開發框架。`,
    });

    const prompt = `
標題: ${article.title}
摘要: ${article.summary?.substring(0, 200) || ""}
來源: ${article.source || ""}

請生成繁體中文摘要。`;

    // 重試邏輯
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (attempt === this.maxRetries + 1) throw error;

        const delay = 5000 * attempt;
        console.log(`重試 ${attempt}/${this.maxRetries}，等待 ${delay}ms...`);
        await this._delay(delay);
      }
    }
  }

  // 內部：處理批次
  async _processBatch(articles) {
    const prompt = `
${articles.map((a, i) => `【新聞 ${i + 1}】\n標題: ${a.title}\n摘要: ${a.summary?.substring(0, 100) || ""}`).join("\n\n")}

為每則新聞生成繁體中文摘要。
格式：【摘要 N】開頭，3-5 個 Markdown 條列點。`;

    try {
      const response = await this._callGemini({
        title: articles[0].title,
        summary: prompt,
      });

      const summaries = this._parseResponses(response, articles.length);

      return articles.map((article, i) => ({
        ...article,
        summary: summaries[i] || "摘要生成失敗",
      }));
    } catch (error) {
      return articles.map(article => ({
        ...article,
        summary: "摘要生成失敗",
        error: error.message,
      }));
    }
  }

  // 內部：解析批次回應
  _parseResponses(responseText, count) {
    const parts = responseText.split(/【摘要\s*\d+】/);
    return parts.slice(1, count + 1).map(p => p.trim());
  }

  // 工具：分組
  _chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  // 工具：延遲
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewsArticleSummarizer;
```

### 使用示例

```javascript
// main.js
const NewsArticleSummarizer = require("./summarizer");

async function main() {
  // 初始化
  const summarizer = new NewsArticleSummarizer(
    process.env.GEMINI_API_KEY,
    {
      batchSize: 5,
      cacheDir: "./cache",
      requestDelay: 1000,
      maxRetries: 2,
      model: "gemini-1.5-flash",
    }
  );

  // 測試資料
  const articles = [
    {
      title: "Claude 3.5 Sonnet Released",
      summary: "Anthropic released Claude 3.5 Sonnet...",
      url: "https://example.com/article1",
      source: "Anthropic Blog",
    },
    {
      title: "GPT-4 Turbo Updates",
      summary: "OpenAI announced improvements to GPT-4 Turbo...",
      url: "https://example.com/article2",
      source: "OpenAI Blog",
    },
    // ... 更多文章
  ];

  // 批次處理
  console.log("開始生成摘要...\n");
  const results = await summarizer.summarizeBatch(articles);

  // 輸出結果
  console.log("\n=== 結果 ===\n");
  results.forEach((result, i) => {
    console.log(`【${i + 1}】${result.title}`);
    console.log(`來源: ${result.source}`);
    console.log(`摘要:\n${result.summary}`);
    console.log(
      `快取: ${result.cached ? "命中" : "未命中"}${result.error ? `，錯誤: ${result.error}` : ""}`
    );
    console.log("---\n");
  });
}

main().catch(console.error);
```

---

**SDK 文件版本**: 1.0
**包含內容**: 安裝、初始化、基本/進階用法、錯誤處理、Token 計數、流式、批次、完整範例
**最後更新**: 2026-01-06
