# AI-News Project Context for Gemini

這是一個 **AI & AI Coding 自動化情報助手** 專案，旨在自動蒐集、過濾並摘要 AI 相關新聞。

## 專案概觀 (Project Overview)

*   **目標**: 自動從 RSS 與 GitHub 蒐集 AI 資訊，使用 Google Gemini API 產生繁體中文摘要，並生成 Markdown 報告。
*   **核心技術**:
    *   **Runtime**: Node.js (v22+, ES Modules)
    *   **AI**: Google Gemini API (`@google/genai`)
    *   **Data**: RSS Parser, GitHub API (`@octokit/rest`)
    *   **Testing**: Vitest
*   **架構**:
    1.  **Collectors**: `src/collectors/` (RSS, GitHub)
    2.  **Filters**: `src/filters/` (去重, 相關性過濾)
    3.  **Summarizers**: `src/summarizers/` (Gemini 摘要生成)
    4.  **Generators**: `src/generators/` (Markdown 報告)
    5.  **Output**: `output/digests/`

## 開發指南 (Development Guide)

### 常用指令 (Commands)

*   **安裝依賴**: `npm install`
*   **啟動 (手動)**: `npm start -- --run-now` (或是 `node src/index.js`)
*   **測試**: `npm test` (執行 Vitest)
*   **測試覆蓋率**: `npm test:coverage`

### 環境設定 (Configuration)

1.  複製 `.env.example` 到 `.env` 並填寫 `GEMINI_API_KEY`, `GITHUB_TOKEN` 等。
2.  複製 `config/sources.example.json` 到 `config/sources.json` 設定新聞來源。

### 專案慣例 (Conventions)

**⚠️ 重要：語言規範 (Language Rules)**

根據專案要求，請嚴格遵守以下語言規範：

*   **文檔 (Documentation)**: 全部使用 **繁體中文 (Traditional Chinese)**。
*   **程式碼註解 (Comments)**: 全部使用 **繁體中文** 解釋邏輯。
*   **提交訊息 (Commit Messages)**: 全部使用 **繁體中文**。
*   **錯誤訊息 (Error Messages)**: 使用者可見的錯誤訊息使用 **繁體中文**。
*   **變數命名 (Naming)**: 使用英文 (CamelCase / PascalCase)。

### 資料夾結構 (Directory Structure)

*   `src/`: 原始碼
    *   `index.js`: 程式進入點
    *   `collectors/`: 資料收集邏輯
    *   `filters/`: 資料清洗與過濾
    *   `summarizers/`: AI 摘要核心
    *   `generators/`: 報告生成
*   `specs/`: 規格文件 (Spec-driven development)
*   `config/`: 設定檔
*   `output/`: 產出的報告存放處
*   `tests/`: 測試代碼

## 核心邏輯參考 (Core Logic)

*   **去重 (Deduplication)**: 使用標題相似度與內容指紋 (MD5/SimHash)。
*   **相關性 (Relevance)**: 使用 AI 判斷是否與 "AI" 或 "AI Coding" 相關。
*   **摘要 (Summarization)**: 透過 Gemini API 將內容翻譯並總結為 3-5 點繁體中文摘要。
