# Quick Start Guide: AI & AI Coding 自動化情報助手

**Branch**: `001-ai-news-assistant` | **Date**: 2026-01-06 | **Phase**: Phase 1 Design

---

## 概述

本指南協助開發者在 **15 分鐘內** 完成系統設定並執行第一次資訊蒐集。

### 先決條件

- **Node.js**: v22.x LTS（[下載連結](https://nodejs.org/)）
- **作業系統**: macOS / Linux / Windows（建議 WSL）
- **網路**: 穩定連線，能存取公開 API 和 RSS feeds
- **API 金鑰**:
  - Google Gemini API Key（[申請連結](https://ai.google.dev/)）
  - GitHub Personal Access Token（[申請連結](https://github.com/settings/tokens)）

---

## 快速開始（5 步驟）

### 步驟 1：複製專案並安裝依賴

```bash
# 複製專案
cd /Users/key.cheng/AI-News

# 安裝依賴
npm install
```

**預期輸出**:
```
added 15 packages in 8s
```

**依賴清單** (`package.json`):
```json
{
  "dependencies": {
    "rss-parser": "^3.13.0",
    "@google/generative-ai": "latest",
    "@octokit/rest": "^20.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

---

### 步驟 2：設定環境變數

建立 `.env` 檔案:

```bash
cp .env.example .env
```

編輯 `.env` 檔案並填入 API 金鑰:

```bash
# Google Gemini API（必填）
GEMINI_API_KEY=your_gemini_api_key_here

# GitHub Personal Access Token（必填，用於 GitHub Release 追蹤）
GITHUB_TOKEN=ghp_your_github_token_here

# NewsAPI（選填，若來源包含 NewsAPI）
NEWSAPI_KEY=your_newsapi_key_here

# 配置路徑（選填，預設值如下）
AI_NEWS_CONFIG_PATH=./config/sources.json
AI_NEWS_OUTPUT_PATH=./output/digests
AI_NEWS_LOGS_PATH=./logs

# 排程設定（選填）
SCHEDULE_TIME=02:15
SCHEDULE_TIMEZONE=Asia/Taipei
SCHEDULE_ENABLED=true
```

**如何取得 API 金鑰**:

1. **Gemini API Key**:
   - 前往 [Google AI Studio](https://ai.google.dev/)
   - 登入 Google 帳號
   - 點選「Get API Key」→「Create API Key」
   - 複製金鑰並貼到 `.env` 檔案

2. **GitHub Personal Access Token**:
   - 前往 [GitHub Settings → Tokens](https://github.com/settings/tokens)
   - 點選「Generate new token (classic)」
   - **Scopes**: 勾選 `public_repo` 和 `repo:status`
   - 點選「Generate token」
   - 複製 Token（格式: `ghp_xxx...`）並貼到 `.env` 檔案

---

### 步驟 3：配置資訊來源

編輯 `./config/sources.json`:

```bash
# 複製範例配置（首次使用）
cp config/sources.example.json config/sources.json

# 使用編輯器打開（例如 VS Code）
code config/sources.json
```

**最小配置範例**（至少 3 個來源）:

```json
{
  "version": "1.0.0",
  "global_settings": {
    "default_timeout_ms": 30000,
    "default_max_items": 20,
    "default_timezone": "Asia/Taipei"
  },
  "sources": [
    {
      "name": "Anthropic News",
      "tier": 1,
      "type": "rss",
      "url": "https://www.anthropic.com/news/rss.xml",
      "auth_required": false,
      "enabled": true,
      "max_items": 20,
      "timeout_ms": 30000
    },
    {
      "name": "OpenAI Blog",
      "tier": 1,
      "type": "rss",
      "url": "https://openai.com/blog/rss.xml",
      "auth_required": false,
      "enabled": true,
      "max_items": 20,
      "timeout_ms": 30000
    },
    {
      "name": "VS Code Releases",
      "tier": 2,
      "type": "api",
      "url": "https://api.github.com/repos/microsoft/vscode/releases",
      "auth_required": true,
      "auth_env_var": "GITHUB_TOKEN",
      "enabled": true,
      "max_items": 5,
      "timeout_ms": 30000
    }
  ]
}
```

**配置說明**:
- `tier`: 來源層級（1=官方部落格, 2=工具, 3=社群）
- `type`: 來源類型（`rss` 或 `api`）
- `enabled`: 設為 `false` 可暫時停用來源
- `max_items`: 每次蒐集的最大項數（建議 5-20）

---

### 步驟 4：初始化資料結構

```bash
# 建立必要目錄
mkdir -p data output/digests logs

# 初始化空白資料檔案（選填，系統會自動建立）
echo '{"items": [], "metadata": {"version": "1.0.0"}}' > data/items.json
echo '{"title_signatures": {}, "content_fingerprints": {}, "metadata": {}}' > data/dedup-index.json
```

---

### 步驟 5：執行系統

```bash
# 手動執行（測試用）
npm start -- --run-now

# 或直接執行主程式
node src/index.js --run-now
```

**預期輸出**:

```
🚀 AI News Assistant 啟動中...
📋 載入配置: ./config/sources.json
✅ 配置驗證成功: 3 個來源（1 個層級 1，1 個層級 2，1 個層級 3）

🔄 開始蒐集資訊...
  ✓ Anthropic News (RSS): 3 則
  ✓ OpenAI Blog (RSS): 2 則
  ✓ VS Code Releases (API): 1 則
📊 蒐集完成: 6 則資訊

🧹 去重處理中...
  ✓ 移除 0 則重複項目
📊 去重完成: 6 則資訊

🔍 過濾相關性...
  ✓ 保留 5 則相關資訊
  ✗ 移除 1 則不相關資訊
📊 過濾完成: 5 則資訊

🤖 生成摘要中（使用 Gemini API）...
  ✓ 批次 1/1: 5 則 (5.2s)
📊 摘要完成: 5 則成功，0 則失敗

📝 產生報告中...
  ✓ 報告路徑: ./output/digests/2026-01-06-digest.md
  ✓ 檔案大小: 3.2 KB
📊 報告產生完成

📊 執行摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  總來源數:        3
  成功來源:        3 (100%)
  總蒐集項數:      6
  最終項數:        5
  總執行時間:      12.5 秒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 執行完成！
📄 摘要報告: ./output/digests/2026-01-06-digest.md
📋 執行日誌: ./logs/2026-01-06-02-15.log
```

---

## 驗證結果

### 檢查摘要報告

```bash
# 查看報告內容
cat output/digests/$(date +%Y-%m-%d)-digest.md

# 或使用 Markdown 預覽工具
open output/digests/$(date +%Y-%m-%d)-digest.md
```

**預期格式**:

```markdown
# AI & AI Coding 自動化情報助手 - 每日摘要

**日期**: 2026-01-06 | **產生時間**: 14:30 UTC+8 | **總資訊項數**: 5

---

## 層級 1：核心模型與 AI 實驗室

### Anthropic News

**Claude 3.5 Sonnet 發布**

- Claude 3.5 Sonnet 正式發布，性能提升 40%
- 新增視覺理解能力，支援圖片分析
- API 定價保持不變，相同成本下性能提升

**來源**: Anthropic News | **發布時間**: 2026-01-05 14:00 UTC
**連結**: https://www.anthropic.com/news/claude-3-5-sonnet

---
```

### 檢查執行日誌

```bash
# 查看日誌（JSON 格式）
cat logs/$(date +%Y-%m-%d)-*.log | jq '.'
```

### 檢查資料檔案

```bash
# 查看蒐集的資訊項目
cat data/items.json | jq '.items | length'
# 預期輸出: 5

# 查看去重索引
cat data/dedup-index.json | jq '.title_signatures | length'
# 預期輸出: 5
```

---

## 設定定時排程

### 方案 1：GitHub Actions（推薦）

建立 `.github/workflows/daily-digest.yml`:

```yaml
name: Daily AI News Digest

on:
  schedule:
    - cron: '15 18 * * *'  # 每天 18:15 UTC (次日 02:15 台灣時間)
  workflow_dispatch:       # 允許手動觸發

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install

      - name: Run daily digest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npm start -- --run-now

      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: digest-${{ github.run_number }}
          path: output/digests/
          retention-days: 7
```

**設定 Secrets**:
1. 前往 GitHub Repository → Settings → Secrets and variables → Actions
2. 新增 `GEMINI_API_KEY`

### 方案 2：本地 Cron Job（Linux/macOS）

```bash
# 編輯 crontab
crontab -e

# 新增以下行（每天 02:15 執行）
15 02 * * * cd /Users/key.cheng/AI-News && node src/index.js --run-now >> logs/cron.log 2>&1
```

### 方案 3：Windows Task Scheduler

1. 開啟「工作排程器」（Task Scheduler）
2. 建立基本工作
3. 觸發條件：每日 02:15
4. 動作：啟動程式
   - 程式: `node.exe`
   - 引數: `src/index.js --run-now`
   - 起始於: `C:\Users\...\AI-News`

---

## 常見問題（FAQ）

### Q1: 如何新增自訂來源？

編輯 `config/sources.json`，新增來源配置:

```json
{
  "name": "Your Custom Source",
  "tier": 2,
  "type": "rss",
  "url": "https://example.com/rss.xml",
  "auth_required": false,
  "enabled": true,
  "max_items": 20,
  "timeout_ms": 30000
}
```

**支援的來源類型**:
- **RSS**: 標準 RSS 2.0 或 Atom 1.0 feed
- **API**: GitHub Releases API（使用 `@octokit/rest`）

### Q2: 如何調整摘要語言或風格？

修改 `src/summarizers/gemini-summarizer.js` 中的 System Prompt:

```javascript
const systemPrompt = `從內容提煉 3-5 點核心摘要，翻譯成繁體中文。
格式：Markdown 條列，每點 15-40 字。
重點：AI 模型、工具、程式碼輔助、開發框架。`;
```

### Q3: 如何停用某個來源？

編輯 `config/sources.json`，將 `enabled` 設為 `false`:

```json
{
  "name": "Source to Disable",
  "enabled": false,
  ...
}
```

### Q4: 系統執行失敗怎麼辦？

檢查執行日誌:

```bash
# 查看最新日誌
cat logs/$(ls -t logs/ | head -1)
```

**常見錯誤**:

| 錯誤訊息 | 原因 | 解決方案 |
|---------|------|---------|
| `GEMINI_API_KEY is not set` | 環境變數未設定 | 檢查 `.env` 檔案 |
| `Request timeout` | 來源連線超時 | 檢查網路連線或增加 `timeout_ms` |
| `Invalid RSS format` | RSS feed 格式錯誤 | 驗證 RSS URL 是否正確 |
| `Rate limit exceeded` | API 速率限制 | 等待一小時後重試，或減少來源數量 |

### Q5: 如何手動清理舊資料？

```bash
# 刪除前一日資料
rm data/items.json data/dedup-index.json

# 刪除舊報告（保留最近 7 天）
find output/digests/ -name "*.md" -mtime +7 -delete

# 刪除舊日誌（保留最近 14 天）
find logs/ -name "*.log" -mtime +14 -delete
```

### Q6: 如何減少 Gemini API 成本？

1. **減少來源數量**: 停用低優先級來源
2. **減少批次大小**: 修改 `src/summarizers/batch-processor.js` 中的 `BATCH_SIZE`（預設 5）
3. **啟用快取**: 系統預設啟用 URL 快取（24 小時 TTL）
4. **調整摘要長度**: 修改 System Prompt，縮短每點摘要字數

**成本估算**（Gemini 3.0 Flash Preview）:
- 每日 100 則資訊：約 $0.02（使用批次 + 快取策略）
- 每月成本：約 $0.60

### Q7: 如何查看 API 使用統計？

```bash
# 查看今日執行日誌中的 API 調用次數
cat logs/$(date +%Y-%m-%d)-*.log | jq '.summarization.gemini_api_calls'
```

### Q8: 如何備份配置和資料？

```bash
# 備份配置
cp config/sources.json config/sources.backup.json

# 備份資料（自動備份已內建）
# 每日清理前會自動產生 .backup.json 檔案

# 手動恢復
cp data/items.backup.json data/items.json
```

---

## 進階配置

### 自訂過濾規則

編輯 `src/filters/relevance-filter.js`:

```javascript
const RELEVANCE_THRESHOLD = 0.5;  // 調整相關性門檻（0-1）

const RELEVANT_TOPICS = [
  "AI 模型",
  "AI 工具",
  "程式碼輔助",
  "開發框架",
  // 新增自訂主題
  "機器學習",
  "深度學習"
];
```

### 自訂去重門檻

編輯 `src/filters/deduplicator.js`:

```javascript
const SIMILARITY_THRESHOLD = 0.8;  // 調整相似度門檻（0-1）
```

### 自訂摘要批次大小

編輯 `src/summarizers/batch-processor.js`:

```javascript
const BATCH_SIZE = 5;              // 每批次處理項數（建議 3-10）
const BATCH_DELAY_MS = 1000;       // 批次間延遲（毫秒）
```

---

## 測試與驗證

### 執行單元測試

```bash
# 執行所有測試
npm test

# 執行特定測試
npm test -- tests/unit/dedup.test.js

# 查看測試覆蓋率
npm test -- --coverage
```

### 手動測試場景

#### 場景 1：測試 RSS 解析

```bash
node -e "
const Parser = require('rss-parser');
const parser = new Parser();
parser.parseURL('https://www.anthropic.com/news/rss.xml')
  .then(feed => console.log(feed.items.slice(0, 3)))
  .catch(console.error);
"
```

#### 場景 2：測試 GitHub API

```bash
node -e "
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
octokit.repos.listReleases({ owner: 'microsoft', repo: 'vscode', per_page: 3 })
  .then(({ data }) => console.log(data.map(r => r.tag_name)))
  .catch(console.error);
"
```

#### 場景 3：測試 Gemini API

```bash
node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
model.generateContent('Hello, 請用繁體中文回應')
  .then(result => console.log(result.response.text()))
  .catch(console.error);
"
```

---

## 疑難排解

### 問題：Node.js 版本不符

```bash
# 檢查 Node.js 版本
node --version
# 預期: v22.x.x

# 安裝 nvm（Node Version Manager）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安裝 Node.js v22
nvm install 22
nvm use 22
```

### 問題：依賴安裝失敗

```bash
# 清除快取並重新安裝
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 問題：環境變數未載入

```bash
# 確認 .env 檔案存在
ls -la .env

# 手動載入環境變數（測試用）
export $(cat .env | xargs)

# 驗證環境變數
echo $GEMINI_API_KEY
```

### 問題：權限錯誤（macOS/Linux）

```bash
# 確保目錄有寫入權限
chmod -R 755 data/ output/ logs/

# 確保執行檔有執行權限
chmod +x src/index.js
```

---

## 下一步

完成 Quick Start 後，您可以：

1. **閱讀完整文檔**:
   - [資料模型設計](./data-model.md)
   - [實作計劃](./plan.md)
   - [功能規格](./spec.md)

2. **自訂配置**:
   - 新增更多資訊來源
   - 調整過濾規則
   - 客製化摘要格式

3. **設定自動化**:
   - 配置 GitHub Actions
   - 設定本地 Cron Job
   - 整合推送通知（電子郵件、Slack）

4. **參與開發**:
   - 查看 [Tasks](./tasks.md)（實作階段產生）
   - 提交 Pull Request
   - 回報問題或建議

---

## 支援與聯絡

- **Issues**: [GitHub Issues](https://github.com/your-repo/AI-News/issues)
- **文檔**: [Specs 目錄](./specs/001-ai-news-assistant/)
- **測試**: `npm test`

---

**Quick Start Guide 完成日期**: 2026-01-06
**下一步**: 更新 agent context
