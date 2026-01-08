# 資料持久化與 GitHub API 整合 - 研究決策總結

**Date**: 2026-01-06 | **Phase**: 0 Research | **Status**: Complete

---

## 1. 資料持久化選擇

### Decision: **JSON 檔案**

### Rationale
1. **符合 MVP 原則** - 零額外依賴，快速啟動
   - Node.js 內建 JSON 支援，無需安裝套件
   - 無資料庫初始化成本
   - 開發速度最快

2. **適合資料規模** - 每日蒐集量小
   - 單日 5-100 則資訊 (<<1000 筆)
   - 每日自動清理，無長期存儲壓力
   - 摘要報告 <5MB

3. **開發效率優先** - 降低複雜度
   - 直接 `fs.readFileSync()` / `fs.writeFileSync()`
   - 人類可讀，便於除錯
   - 容易驗證資料完整性

4. **可升級路徑** - 保留未來擴展空間
   - 若驗證成功，Phase 2 可遷移至 SQLite
   - 資料結構設計時納入遷移考量
   - 核心邏輯無需改動

### Schema Design

#### News Items (`./data/items.json`)
```json
{
  "items": [
    {
      "id": "item_20260106_001",
      "title": "Claude 3.5 Sonnet 發布",
      "summary": [
        "Claude 3.5 Sonnet 正式發布，性能提升 40%",
        "新增視覺理解能力，支援圖片分析",
        "API 定價保持不變"
      ],
      "source": {
        "name": "Anthropic News",
        "tier": 1,
        "type": "rss"
      },
      "author": "Anthropic Team",
      "published_at": "2026-01-05T14:00:00Z",
      "collected_at": "2026-01-06T02:30:00Z",
      "original_url": "https://www.anthropic.com/news/claude-3-5-sonnet",
      "language": "en",
      "relevance_score": 0.95,
      "content_length": 1234,
      "retention_until": "2026-01-07T00:00:00Z"
    }
  ],
  "metadata": {
    "version": "1.0.0",
    "date": "2026-01-06",
    "total_items": 42,
    "items_by_tier": { "1": 15, "2": 18, "3": 9 }
  }
}
```

#### Deduplication Index (`./data/dedup-index.json`)
```json
{
  "title_signatures": {
    "claude-3-5-sonnet": {
      "hash": "hash_abc123",
      "items": [
        {
          "id": "item_20260106_001",
          "source": "Anthropic News",
          "content_length": 1234,
          "is_selected": true
        }
      ]
    }
  },
  "content_fingerprints": {
    "fp_xyz789": ["item_20260106_001"]
  },
  "metadata": {
    "dedup_algorithm": "levenshtein",
    "similarity_threshold": 0.8,
    "fingerprint_algorithm": "simhash"
  }
}
```

#### Execution Log (`./logs/2026-01-06-02-15.log`)
```json
{
  "execution": {
    "id": "exec_20260106_0215",
    "started_at": "2026-01-06T02:15:00Z",
    "ended_at": "2026-01-06T02:45:00Z",
    "duration_ms": 1800000,
    "trigger": "scheduled"
  },
  "sources": [
    {
      "name": "OpenAI Blog",
      "status": "success",
      "items_collected": 3,
      "items_after_dedup": 3,
      "items_after_filter": 2,
      "duration_ms": 2300
    }
  ],
  "summary": {
    "total_sources": 17,
    "successful_sources": 16,
    "failed_sources": 1,
    "success_rate": 0.94,
    "sensitive_data_masked": true
  }
}
```

### File Structure
```
./data/
├── items.json              # 當日蒐集資訊
├── items.backup.json       # 備份（恢復用）
├── dedup-index.json        # 去重索引
├── dedup-index.backup.json # 備份
└── .lastrun                # 上次清理時間

./output/digests/
├── 2026-01-06-digest.md    # 當日摘要（Markdown）
└── 2026-01-05-digest.md    # 前一日

./logs/
├── 2026-01-06-02-15.log    # 執行日誌（JSON）
└── ...
```

### Alternatives Considered

| 方案 | 為何不選 |
|-----|--------|
| **SQLite** | MVP 初始化成本高，資料規模不需要 |
| **PostgreSQL/MySQL** | 完全超出 MVP 範圍，需外部服務 |
| **Redis** | 不持久化，不符合「暫存隔日清理」需求 |
| **LevelDB** | 學習曲線陡，無人類可讀性 |
| **Firebase/Cloud Storage** | 需外部帳號，不符合本地運行需求 |

---

## 2. GitHub API 客戶端

### Decision: **@octokit/rest**

### Rationale

1. **GitHub Releases 只是 MVP 一部分**
   - 層級 2-3 才涉及 GitHub Release 追蹤
   - 共 6-8 個 GitHub 來源（vs 10+ RSS 來源）
   - 非核心功能，但值得用成熟方案

2. **避免重複造輪子**
   - 需處理分頁、速率限制、認證
   - API 格式變更風險（v3 → v4）
   - @octokit/rest 已解決這些問題，社群活躍

3. **維護成本考量**
   - 1.2MB 依賴 < 自己維護速率限制邏輯的風險
   - 手動實作容易被 GitHub 限流
   - TypeScript 類型支援

4. **不值得手動實作的原因**
   - 速率限制追蹤（需 Header 解析 + 重試邏輯）
   - GitHub API 版本變更兼容性
   - 認證機制複雜度

### API Endpoints Needed

#### Primary: Releases
```
GET /repos/{owner}/{repo}/releases
```

**使用場景**:
- VS Code (microsoft/vscode)
- Zed Editor (zed-industries/zed)
- Vercel AI (vercel/ai)
- LangChain.js (langchain-ai/langchainjs)
- LlamaIndex.ts (run-llama/LlamaIndexTS)
- MCP Servers (modelcontextprotocol/servers)

**需要的欄位**:
```json
{
  "tag_name": "v1.95.0",
  "name": "Version 1.95.0",
  "body": "...",  // Release Notes (Markdown)
  "published_at": "2026-01-06T10:00:00Z",
  "html_url": "https://github.com/...",
  "draft": false,
  "prerelease": false
}
```

**參數**:
- `per_page`: 最多 100（預設 30）
- `page`: 分頁

#### Secondary: Repository Info (Optional)
```
GET /repos/{owner}/{repo}
```

**用途**: 驗證倉庫存在性（可選）

### Authentication

**方式**: Personal Access Token (PAT) - Classic

**設定步驟**:
1. GitHub 設定頁面: https://github.com/settings/tokens
2. 點擊 "Generate new token (classic)"
3. 設定範圍 (Scopes):
   - ✅ `public_repo` (讀取公開倉庫)
   - ✅ `repo:status` (讀取倉庫狀態)
   - ❌ 不要勾選完整 `repo` 權限

4. 環境變數設定:
   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. @octokit/rest 使用:
   ```javascript
   const { Octokit } = require("@octokit/rest");
   const octokit = new Octokit({
     auth: process.env.GITHUB_TOKEN
   });
   ```

**安全考量**:
- ✅ Token 儲存在 `.env` (Git 忽略)
- ✅ CI/CD 使用 GitHub Secrets
- ✅ 定期檢查 Token 使用日誌
- ✅ 設定 Token 90 天過期

### Rate Limiting

**Authenticated**: 5000 requests/hour
**Unauthenticated**: 60 requests/hour (不推薦)

**追蹤實作**:
```javascript
class GitHubRateLimitTracker {
  updateFromResponse(headers) {
    this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    this.reset = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
  }

  async waitForReset() {
    if (this.remaining <= 0) {
      const waitTime = this.reset - Date.now();
      if (waitTime > 0) {
        console.log(`等待 ${Math.ceil(waitTime / 1000)} 秒...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
}
```

**並發控制** (FR-025):
- 最多 5 個並發 GitHub 請求
- 使用 `p-queue` 管理

### Code Example

```javascript
const { Octokit } = require("@octokit/rest");

async function fetchReleases(owner, repo) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  try {
    const { data } = await octokit.repos.listReleases({
      owner,
      repo,
      per_page: 5,
      page: 1
    });

    return data.map(release => ({
      source: `${owner}/${repo}`,
      title: release.name || release.tag_name,
      body: release.body,  // Markdown Release Notes
      published_at: release.published_at,
      url: release.html_url,
      is_prerelease: release.prerelease
    }));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // FR-008: 記錄錯誤並跳過該來源
    return [];
  }
}

// 使用示例
const releases = await fetchReleases('microsoft', 'vscode');
```

### Alternatives Considered

| 方案 | 為何不選 |
|-----|--------|
| **直接 HTTP 調用** | 需自己實作速率限制，容易被限流 |
| **Octokit GraphQL** | 過度設計，REST API 足夠 |
| **github-api.js** | 不如 octokit 活躍，社群支援少 |

---

## 3. 資料清理策略

### Cleanup Trigger

**時機**: 每日系統啟動時

**檢查邏輯**:
```
系統啟動（排程或手動）
  ↓
檢查當前日期
  ↓
若日期變更 → 加載前一日資料
  ↓
掃描所有 item.retention_until
  ↓
刪除 retention_until <= now 的項目
  ↓
刪除舊去重索引
  ↓
初始化新日期資料結構
```

### Cleanup Logic

**偽代碼**:
```javascript
async function cleanupOldData() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 讀取上次清理日期
  let lastCleanupDate = readLastCleanupDate();

  // 若今天未清理過，執行清理
  if (lastCleanupDate !== today) {
    // 1. 清理舊資訊項
    const validItems = loadItems().filter(
      item => new Date(item.retention_until) > now
    );
    saveItems(validItems);
    console.log(`清理: 移除 ${oldCount - validItems.length} 項過期資料`);

    // 2. 刪除舊去重索引
    if (dedupIndexExists()) {
      removeDedupIndex();
      console.log(`清理: 刪除前一日去重索引`);
    }

    // 3. 記錄清理時間
    saveLastCleanupDate(today);
  }
}
```

### Implementation

#### GitHub Actions (自動排程)
```yaml
# .github/workflows/daily-digest.yml
on:
  schedule:
    - cron: '15 18 * * *'  # 每天 18:15 UTC = 次日 02:15 台灣時間
  workflow_dispatch:       # 手動觸發

jobs:
  cleanup-and-digest:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup old data
        run: node -e "require('./src/utils/cleanup').cleanupOldData()"

      - name: Run daily digest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npm start -- --run-now
```

#### 本地排程 (Linux/macOS)
```bash
# crontab -e
15 02 * * * cd /Users/key.cheng/AI-News && node src/index.js --run-now
```

### Edge Cases 處理

| 情況 | 處理方式 |
|-----|--------|
| 清理時系統崩潰 | `.lastrun` 檔案記錄狀態，重啟時重試 |
| 清理時正產生摘要 | 使用檔案鎖（flock）避免衝突 |
| 誤刪資料檔案 | 檢查 `.backup` 版本進行恢復 |
| 時區變更 (DST) | 使用 ISO 8601 UTC 時間戳自動適應 |
| 多進程同時執行 | 使用 PID 檔案防止重複執行 |

---

## 4. 敏感資訊管理

### 環境變數儲存

**必要環境變數** (FR-028):
```bash
# .env (Git 忽略)
GITHUB_TOKEN=ghp_xxx...          # GitHub API 認證
GEMINI_API_KEY=sk-proj-xxx...    # Google Gemini API
NEWSAPI_KEY=xxx...               # NewsAPI（若使用）
REDDIT_CLIENT_ID=xxx...          # Reddit API（若使用）
EMAIL_SMTP_PASSWORD=xxx...       # 郵件推送（若使用）
```

### 日誌遮蔽 (FR-034)

**遮蔽規則**:
```javascript
const maskSensitive = (log) => {
  // API 金鑰: 僅顯示前 4 碼和後 4 碼
  log = log.replace(
    /ghp_[a-zA-Z0-9]+/g,
    (token) => `ghp_${token.slice(4, 8)}***${token.slice(-4)}`
  );

  // 認證 Token
  log = log.replace(/Bearer [a-zA-Z0-9_-]+/g, "Bearer ***");

  // Email
  log = log.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "***@***.***"
  );

  return log;
};
```

**遮蔽時機**: 寫入日誌時自動執行

---

## 5. 摘要報告結構

### 檔案格式

**路徑**: `./output/digests/YYYY-MM-DD-digest.md`

**結構**:
```markdown
# AI & AI Coding 自動化情報助手 - 每日摘要

**日期**: 2026-01-06 | **產生時間**: 02:45 UTC+8 | **總資訊項數**: 42

---

## 層級 1：核心模型與 AI 實驗室

### Anthropic News
**Claude 3.5 Sonnet 發布**

- Claude 3.5 Sonnet 正式發布，性能提升 40%
- 新增視覺理解能力，支援圖片分析
- API 定價保持不變

**來源**: Anthropic News | **作者**: Anthropic Team | **發布時間**: 2026-01-05 14:00
**連結**: https://www.anthropic.com/news/claude-3-5-sonnet

---

## 層級 2：AI Coding 編輯器與工具

[類似格式...]

---

## 層級 3：開發框架、SDK 與社群

[類似格式...]

---

## 報告統計

- **總資訊項數**: 42
- **層級 1**: 12 則 | **層級 2**: 18 則 | **層級 3**: 12 則
- **蒐集來源**: 17 個
- **成功率**: 94% (16/17 來源)
- **去重移除**: 5 則
- **過濾移除**: 8 則
- **執行耗時**: 30 分鐘
```

**檔案大小**: <5MB (FR-027)

---

## 6. 完整依賴清單

### 必要依賴 (MVP)

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",       // GitHub API
    "rss-parser": "^3.13.0",          // RSS 解析
    "axios": "^1.6.0",                // HTTP 客戶端
    "string-similarity": "^4.0.4",    // 字串相似度
    "@google/generative-ai": "^0.3.0", // Gemini API
    "dotenv": "^16.3.0",              // 環境變數
    "p-queue": "^7.4.0"               // 並發控制
  },
  "devDependencies": {
    "jest": "^29.0.0",                // 測試框架
    "simhash": "^0.1.0"               // 內容指紋
  }
}
```

### 安裝命令

```bash
npm install \
  @octokit/rest \
  rss-parser \
  axios \
  string-similarity \
  @google/generative-ai \
  dotenv \
  p-queue

npm install --save-dev \
  jest \
  simhash
```

---

## 7. 初始化步驟

### 第一次設定

```bash
# 1. 建立目錄結構
mkdir -p {config,data,output/digests,logs,src/{collectors,filters,summarizers,generators,utils}}

# 2. 複製範例配置
cp config/sources.example.json config/sources.json

# 3. 建立 .env
cat > .env << EOF
GITHUB_TOKEN=ghp_your_token_here
GEMINI_API_KEY=sk-proj-your-key-here
EOF

# 4. 初始化資料檔案
node -e "require('./src/utils/init').initializeDataStructure()"

# 5. 安裝依賴
npm install
```

### 驗證設定

```bash
# 測試 GitHub API
node -e "require('./src/collectors/github').testConnection()"

# 測試 RSS 解析
node -e "require('./src/collectors/rss').testConnection()"

# 測試 Gemini API
node -e "require('./src/summarizers/gemini').testConnection()"
```

---

## 8. 風險與緩解

| 風險 | 可能性 | 影響 | 緩解措施 |
|-----|--------|------|--------|
| **Gemini API 限流** | 中 | 摘要延遲 | 重試邏輯（2 次，間隔 5 秒）|
| **GitHub Rate Limit** | 低 | 無法蒐集 Release | PAT 認證，監控配額 |
| **RSS 格式不規範** | 中 | 解析失敗 | 容錯機制，跳過失敗項 |
| **資料檔案衝突** | 低 | 資料丟失 | 檔案鎖，備份機制 |
| **敏感資訊洩露** | 低 | 安全漏洞 | 日誌遮蔽，環境變數管理 |

---

## 9. 後續升級路徑

### Phase 1 (當前)
- JSON 檔案持久化
- @octokit/rest GitHub API
- 每日清理策略

### Phase 2 (未來)
- **考慮遷移至 SQLite** (若驗證需要)
  - 複雜查詢需求
  - 資料量超過 10MB
  - 需要複雜報告分析

- **新增功能**
  - Twitter 整合
  - Slack/Discord 推送
  - Web UI 查詢歷史報告
  - 自訂過濾規則

---

## 總結表

| 項目 | 決策 | 依據 |
|-----|------|------|
| 資料持久化 | JSON 檔案 | MVP 快速啟動，零依賴 |
| GitHub 客戶端 | @octokit/rest | 降低維護風險，專注核心 |
| 認證方式 | Personal Access Token | 安全，易於管理 |
| API 端點 | Releases only | 6-8 個 GitHub 來源 |
| 敏感資訊 | 環境變數 + 日誌遮蔽 | 安全最佳實踐 |
| 清理時機 | 每日系統啟動 | 簡單可靠 |
| 並發限制 | 5 個源同時 | 平衡效能與穩定性 |
| 報告格式 | Markdown 分層級 | 人類可讀，易於分享 |

---

**研究完成** | Next: Phase 1 設計實裝 (data-model.md, quickstart.md)
