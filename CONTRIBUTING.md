# 貢獻指南

感謝您對 AI News Assistant 專案的興趣！本指南將協助您了解如何貢獻程式碼。

## 目錄

- [行為準則](#行為準則)
- [如何貢獻](#如何貢獻)
- [開發環境設定](#開發環境設定)
- [程式碼風格](#程式碼風格)
- [提交訊息規範](#提交訊息規範)
- [測試](#測試)
- [Pull Request 流程](#pull-request-流程)

## 行為準則

請保持尊重、友善的態度與其他貢獻者互動。我們致力於營造開放且包容的社群環境。

## 如何貢獻

### 回報問題

如果您發現 bug 或有功能建議，請透過 [GitHub Issues](https://github.com/your-repo/AI-News/issues) 回報。

**Bug 回報範本**:

```markdown
**問題描述**
簡短描述遇到的問題

**重現步驟**

1. 執行 '...'
2. 檢視 '...'
3. 看到錯誤

**預期行為**
描述預期的正確行為

**實際行為**
描述實際發生的情況

**環境資訊**

- OS: [如 macOS 14.1]
- Node.js: [如 v22.0.0]
- 版本: [如 v0.1.0]

**錯誤日誌**
```

貼上相關錯誤訊息或日誌

```

```

**功能建議範本**:

```markdown
**功能描述**
清楚描述建議的新功能

**使用場景**
說明此功能解決什麼問題或改善什麼體驗

**替代方案**
是否考慮過其他解決方案？

**額外資訊**
任何其他相關資訊或截圖
```

### 貢獻程式碼

1. **Fork 專案** 到您的 GitHub 帳號
2. **建立分支** 從 `main` 開新分支
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **進行變更** 並遵循程式碼風格
4. **測試變更** 確保所有測試通過
5. **提交變更** 使用規範的提交訊息
6. **Push 到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **建立 Pull Request** 並填寫描述

## 開發環境設定

### 前置需求

- Node.js v22.x LTS
- npm v10+
- Git

### 安裝步驟

```bash
# 1. Clone 您 fork 的專案
git clone https://github.com/YOUR_USERNAME/AI-News.git
cd AI-News

# 2. 安裝依賴
npm install

# 3. 複製環境變數範本
cp .env.example .env

# 4. 編輯 .env 並填入測試用 API 金鑰
# GEMINI_API_KEY=your_test_key
# GITHUB_TOKEN=your_test_token

# 5. 複製來源配置範本
cp config/sources.example.json config/sources.json

# 6. 執行測試確保環境正常
npm test

# 7. 手動執行測試
npm start -- --run-now
```

## 程式碼風格

本專案使用 JavaScript ES Modules（ESM），請遵循以下規範：

### JavaScript 風格

- **縮排**: 2 空格（不使用 Tab）
- **引號**: 雙引號 `"` 優先於單引號（模板字串除外）
- **分號**: 必須使用分號結尾
- **命名規則**:
  - 變數/函式: `camelCase`（如 `loadConfig`, `itemsCount`）
  - 類別: `PascalCase`（如 `EmailPusher`, `NewsItem`）
  - 常數: `UPPER_SNAKE_CASE`（如 `MAX_RETRIES`, `API_TIMEOUT`）
  - 私有屬性: 前綴 `_`（如 `_internalCache`）
- **函式長度**: 建議單一函式不超過 50 行（複雜邏輯可拆分）
- **註解**:
  - 使用 JSDoc 風格註解函式
  - 複雜邏輯加上行內註解說明

### 範例

```javascript
/**
 * 載入並驗證配置檔案
 * @param {string} configPath - 配置檔案路徑
 * @param {Object} options - 載入選項
 * @returns {Object} 驗證後的配置物件
 * @throws {Error} 配置格式錯誤時拋出例外
 */
export function loadAndValidateConfig(configPath, options = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // 驗證必要欄位
  if (!config.version) {
    throw new Error("配置檔案缺少 version 欄位");
  }

  // 過濾停用的來源
  if (options.filterEnabled) {
    config.sources = config.sources.filter((s) => s.enabled !== false);
  }

  return config;
}
```

### 檔案結構

- 每個模組一個檔案
- 檔案名稱使用 `kebab-case`（如 `email-pusher.js`）
- 資料夾名稱使用複數形式（如 `collectors/`, `filters/`）
- 測試檔案命名為 `*.test.js`（如 `email-pusher.test.js`）

### Import 順序

```javascript
// 1. Node.js 內建模組
import fs from "fs/promises";
import path from "path";

// 2. 第三方套件
import dotenv from "dotenv";
import { marked } from "marked";

// 3. 專案內部模組
import { logger } from "./utils/logger.js";
import { NewsItem } from "./models/news-item.js";
```

## 提交訊息規範

使用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 類型

- `feat`: 新功能（如 `feat(collector): 新增 NewsAPI 蒐集器`）
- `fix`: Bug 修復（如 `fix(dedup): 修正相似度計算錯誤`）
- `docs`: 文件更新（如 `docs(readme): 更新安裝步驟`）
- `style`: 程式碼格式調整（不影響功能）
- `refactor`: 重構（不改變功能）
- `test`: 測試相關
- `chore`: 建置流程或輔助工具變更

### 範例

```
feat(push): 新增電子郵件推送功能

- 實作 EmailPusher 類別
- 支援 Markdown 轉 HTML
- 實作重試策略（最多重試 1 次）

Closes #42
```

```
fix(summarizer): 修正 Gemini API 重試邏輯

當 API 回傳 429 錯誤時，重試機制未正確觸發。
現已修正為使用指數退避策略。

Fixes #38
```

## 測試

### 執行測試

```bash
# 執行所有測試
npm test

# 執行特定測試檔案
npm test -- email-pusher.test.js

# 執行測試並產生覆蓋率報告
npm run test:coverage
```

### 撰寫測試

- 使用 Vitest 測試框架
- 測試檔案放在 `tests/` 目錄
- 遵循 AAA 模式（Arrange, Act, Assert）

```javascript
import { describe, it, expect } from "vitest";
import { deduplicate } from "../src/filters/deduplicator.js";

describe("Deduplicator", () => {
  it("should remove duplicate items based on title similarity", () => {
    // Arrange
    const items = [
      { title: "OpenAI releases GPT-5", content: "..." },
      { title: "OpenAI Releases GPT-5", content: "..." }, // duplicate
    ];

    // Act
    const result = deduplicate(items);

    // Assert
    expect(result.uniqueItems).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });
});
```

## Pull Request 流程

### 提交前檢查清單

- [ ] 程式碼遵循專案風格規範
- [ ] 所有測試通過（`npm test`）
- [ ] 新增功能有對應的測試
- [ ] 提交訊息符合規範
- [ ] 更新相關文件（如 README.md）
- [ ] 無 `console.log` 除錯訊息殘留

### PR 描述範本

```markdown
## 變更摘要

簡短描述此 PR 的目的

## 變更類型

- [ ] Bug 修復
- [ ] 新功能
- [ ] 重構
- [ ] 文件更新
- [ ] 效能優化

## 變更詳情

- 詳細列出主要變更項目
- 說明技術實作細節

## 測試

描述如何測試此變更

## 相關 Issue

Closes #123

## 截圖（如適用）
```

### Review 流程

1. 提交 PR 後，maintainer 會在 48 小時內進行審查
2. 若有需要修改的地方，reviewer 會留下評論
3. 解決所有評論後，PR 會被合併到 `main` 分支
4. 合併後您的分支會被刪除

### 常見問題

**Q: PR 被退回該怎麼辦？**  
A: 請依照 reviewer 的建議修改程式碼，然後在同一個 PR 中提交新的 commit。

**Q: 如何更新我的 fork？**  
A: 執行以下命令同步上游變更：

```bash
git remote add upstream https://github.com/original/AI-News.git
git fetch upstream
git checkout main
git merge upstream/main
```

**Q: 測試失敗怎麼辦？**  
A: 請檢查錯誤訊息，修正問題後重新執行 `npm test`。若問題持續，可在 PR 中詢問 maintainer。

## 授權

提交程式碼至本專案即表示您同意以 MIT License 授權您的貢獻。

## 問題與協助

若有任何問題，歡迎透過以下方式聯繫：

- GitHub Issues: [專案 Issues 頁面](https://github.com/your-repo/AI-News/issues)
- Email: [您的聯絡信箱]

---

感謝您的貢獻！💙
