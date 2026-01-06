# 資料持久化與 GitHub API 整合研究報告

**Date**: 2026-01-06
**Scope**: 研究資料持久化方案、GitHub API 客戶端選擇、資料模型設計、自動清理策略
**Status**: Phase 0 Research

---

## 1. 資料持久化選擇

### 1.1 JSON 檔案 vs SQLite 對比分析

| 評估維度 | JSON 檔案 | SQLite |
|---------|---------|--------|
| **設定簡易度** | ★★★★★ 最簡單 | ★★★☆☆ 需初始化 |
| **查詢效能** | ★★☆☆☆ O(n) 掃描 | ★★★★☆ 索引查詢 |
| **資料完整性** | ★★★☆☆ 手動管理 | ★★★★★ ACID 保證 |
| **依賴數量** | ★★★★★ 無 | ★★★☆☆ 需 SQLite 模組 |
| **檔案大小** | ★★★★☆ ~1-5MB | ★★★★★ 高效壓縮 |
| **並發安全** | ★★☆☆☆ 有衝突風險 | ★★★★★ 內建鎖 |
| **資料遷移** | ★★★★☆ 易於備份 | ★★☆☆☆ 需工具 |
| **開發速度** | ★★★★★ 快速 | ★★★☆☆ 需設計 |

### 1.2 MVP 階段推薦方案

**Decision: JSON 檔案**

**Rationale（選擇理由）:**

1. **符合 MVP 原則** - 無需額外依賴，快速啟動
   - 零安裝成本（Node.js 內建 JSON 支援）
   - 無需初始化資料庫
   - 快速開發與迭代

2. **資料規模適合** - 每日資料量小
   - 每日蒐集 5-100 則資訊（<<1000 筆）
   - 摘要報告 <5MB
   - 隔日自動清理，無需長期儲存

3. **開發效率優先** - 降低啟動複雜度
   - 配置化 JSON 已存在（sources.json）
   - 資料結構簡單，無複雜關聯
   - 直接 `fs.readFileSync()` / `fs.writeFileSync()`

4. **後續可升級** - 保留擴展路徑
   - 若 MVP 驗證成功，Phase 2 可遷移至 SQLite
   - JSON 結構設計時注意遷移友善性
   - 無需改動核心邏輯

5. **除錯友善** - 開發效率
   - 人類可讀的 JSON 格式
   - 可直接使用文字編輯器檢查
   - 易於複現問題

**Alternatives Considered（其他選項）:**

| 方案 | 為何不選 |
|-----|--------|
| **SQLite** | MVP 階段複雜度過高，初始化成本不符合快速驗證需求 |
| **PostgreSQL/MySQL** | 遠超 MVP 範圍，需外部服務 |
| **Redis** | 不持久化，不符合「暫存當日資料」的要求 |
| **LevelDB** | 學習曲線陡，無 JSON 人類可讀性 |

---

## 2. GitHub API 客戶端選擇

### 2.1 直接調用 vs @octokit/rest 對比

| 評估維度 | 直接 HTTP 調用 | @octokit/rest |
|---------|--------------|--------------|
| **依賴大小** | ★★★★★ 0kb | ★★★☆☆ ~1.2MB |
| **API 便利性** | ★★★☆☆ 手動構造 | ★★★★★ 類型安全 |
| **錯誤處理** | ★★★☆☆ 手動實作 | ★★★★☆ 內建處理 |
| **速率限制** | ★★★☆☆ 手動解析 | ★★★★★ 自動追蹤 |
| **認證靈活性** | ★★★★★ 完全控制 | ★★★★☆ 預設配置 |
| **文件支援** | ★★★★☆ GitHub 官方 | ★★★★★ 社群良好 |
| **維護狀態** | ★★★☆☆ 自己維護 | ★★★★★ 活躍維護 |
| **學習曲線** | ★★★★☆ 簡單 | ★★★☆☆ 稍複雜 |

### 2.2 MVP 階段推薦方案

**Decision: 混合方案（推薦 @octokit/rest）**

**Rationale（選擇理由）:**

1. **GitHub Releases 只是 MVP 階段一部分** - 非核心功能
   - 根據 spec，MVP 優先 RSS (層級 1-2)
   - GitHub Release 追蹤只涉及層級 2-3（VS Code、Zed）及層級 3（Vercel AI、LangChain 等）
   - 共 6-8 個 GitHub 來源

2. **不值得手動實作**
   - 需要處理分頁、速率限制、認證
   - GitHub API 格式變更風險（v3 → v4）
   - @octokit/rest 已解決這些問題

3. **維護成本考量**
   - 1.2MB 依賴 vs 自己維護速率限制邏輯
   - 後者風險更高（會被 GitHub 限流）

4. **類型安全與錯誤處理**
   - @octokit/rest 提供 TypeScript 類型
   - 減少手動型別檢查的 bug

**Alternatives Considered（其他選項）:**

| 方案 | 為何不選 |
|-----|--------|
| **直接 HTTP 調用** | 需自己實作速率限制追蹤，容易踩坑 |
| **Octokit GraphQL** | 過度設計，REST API 足夠 |
| **github-api.js** | 不如 octokit 活躍，文件少 |

---

## 3. 必要的 GitHub API 端點

### 3.1 Releases 端點（主要）

**Endpoint**: `GET /repos/{owner}/{repo}/releases`

**用途**: 追蹤 GitHub Release 更新

**使用場景**:
- VS Code (microsoft/vscode)
- Zed Editor (zed-industries/zed)
- Vercel AI (vercel/ai)
- LangChain.js (langchain-ai/langchainjs)
- LlamaIndex.ts (run-llama/LlamaIndexTS)
- MCP Servers (modelcontextprotocol/servers)

**Response 欄位** (我們需要):
```json
{
  "tag_name": "v1.95.0",           // 版本號
  "name": "Version 1.95.0",         // Release 名稱
  "body": "... 更新內容...",        // Release Notes (Markdown)
  "published_at": "2026-01-06T10:00:00Z",  // 發布時間
  "html_url": "https://github.com/microsoft/vscode/releases/tag/v1.95.0",  // 連結
  "draft": false,                   // 是否為草稿
  "prerelease": false               // 是否為預發行版
}
```

**參數**:
- `per_page`: 最多 100（預設 30）
- `page`: 分頁

**速率限制**: 60 req/hour（未認證）或 5000 req/hour（已認證）

### 3.2 Repository 資訊端點（輔助）

**Endpoint**: `GET /repos/{owner}/{repo}`

**用途**: 驗證倉庫存在性、取得 README、Stars 等

**使用場景**: 驗證 GitHub 來源的有效性（可選）

---

## 4. GitHub API 認證方案

### 4.1 認證方式對比

| 方式 | 速率限制 | 安全性 | 適用場景 |
|-----|--------|--------|---------|
| **Personal Access Token (PAT)** | 5000/hour | ★★★★☆ 環境變數 | **推薦** |
| **OAuth App** | 5000/hour | ★★★★★ 授權流 | 複雜，不適 MVP |
| **GitHub App** | 取決於安裝 | ★★★★★ 細粒度權限 | 複雜，不適 MVP |
| **無認證** | 60/hour | ★★☆☆☆ 公開倉庫只讀 | 流量低時可用 |

### 4.2 推薦方案：Personal Access Token (PAT)

**設定步驟**:

1. **GitHub 設定頁面**
   - https://github.com/settings/tokens
   - Click "Generate new token (classic)"

2. **設定範圍（Scopes）**
   ```
   - public_repo（讀取公開倉庫）
   - repo:status（讀取倉庫狀態）
   ```

   > ⚠️ 重要：不要勾選 `repo` 全權限，僅需上述讀取權限

3. **環境變數設定**
   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **@octokit/rest 使用方式**
   ```javascript
   const { Octokit } = require("@octokit/rest");

   const octokit = new Octokit({
     auth: process.env.GITHUB_TOKEN
   });
   ```

**安全考量**:
- ✅ Token 儲存在 `.env`（Git 忽略）
- ✅ CI/CD 環境使用 GitHub Secrets（自動環境變數注入）
- ✅ 定期檢查 Token 使用日誌（GitHub Settings → Security → Token Access Log）
- ✅ 設定 Token 過期時間（建議 90 天）

---

## 5. 資料模型設計

### 5.1 資料結構概覽

整個系統涉及四層資料：

```
tier-1: Sources（配置）
  └── tier-2: News Items（蒐集資料）
      └── tier-3: Duplicate Index（去重索引）
          └── tier-4: Execution Log（執行日誌）
```

### 5.2 詳細 Schema 設計

#### 5.2.1 News Item（資訊項目）

**檔案**: `./data/items.json`

```json
{
  "items": [
    {
      "id": "item_20260106_001",                    // 唯一識別符
      "title": "Claude 3.5 Sonnet 發布",
      "summary": [                                   // 3-5 點摘要
        "Claude 3.5 Sonnet 正式發布，性能提升 40%",
        "新增視覺理解能力，支援圖片分析",
        "API 定價保持不變，相同成本下性能提升"
      ],
      "source": {
        "name": "Anthropic News",
        "tier": 1,
        "type": "rss"
      },
      "author": "Anthropic Team",                    // 可選
      "published_at": "2026-01-05T14:00:00Z",
      "collected_at": "2026-01-06T02:30:00Z",
      "original_url": "https://www.anthropic.com/news/claude-3-5-sonnet",
      "language": "en",                              // 原始語言
      "relevance_score": 0.95,                       // AI 相關性 0-1
      "votes_or_score": null,                        // 社群投票（可選）
      "content": "... 原始英文內容（若摘要失敗使用）...",
      "content_length": 1234,                        // 字數
      "retention_until": "2026-01-07T00:00:00Z"      // 保留截止日期
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

**欄位說明**:
- `id`: 格式 `item_YYYYMMDD_NNN`，用於去重索引查詢
- `relevance_score`: Gemini API 計算結果，范圍 [0, 1]
- `retention_until`: 用於清理邏輯，自動刪除超期資料
- `summary`: 已翻譯的繁體中文摘要（若失敗為空陣列）

#### 5.2.2 Deduplication Index（去重索引）

**檔案**: `./data/dedup-index.json`

```json
{
  "title_signatures": {
    "claude-3-5-sonnet": {                          // 標題規範化簽名
      "hash": "hash_abc123",                        // 標題 MD5 或 SimHash
      "items": [
        {
          "id": "item_20260106_001",
          "source": "Anthropic News",
          "content_length": 1234,
          "is_selected": true                       // 此版本被保留
        },
        {
          "id": "item_20260106_002",
          "source": "Hacker News AI",
          "content_length": 900,
          "is_selected": false                      // 此版本被移除
        }
      ]
    }
  },
  "content_fingerprints": {
    "fp_xyz789": [                                  // 內容指紋（SimHash）
      "item_20260106_001",
      "item_20260106_002"
    ]
  },
  "metadata": {
    "dedup_algorithm": "levenshtein",
    "similarity_threshold": 0.8,
    "fingerprint_algorithm": "simhash",
    "last_updated": "2026-01-06T02:45:00Z"
  }
}
```

**用途**:
- 快速查詢重複項目
- 追蹤已去重的決策（便於除錯）
- 支援撤銷或重新評估去重結果

#### 5.2.3 Daily Digest Report（每日摘要報告）

**檔案**: `./output/digests/2026-01-06-digest.md`

```markdown
# AI & AI Coding 自動化情報助手 - 每日摘要

**日期**: 2026-01-06 | **產生時間**: 02:45 UTC+8 | **總資訊項數**: 42

---

## 層級 1：核心模型與 AI 實驗室

### Anthropic News
**Claude 3.5 Sonnet 發布**

- Claude 3.5 Sonnet 正式發布，性能提升 40%
- 新增視覺理解能力，支援圖片分析
- API 定價保持不變，相同成本下性能提升

**來源**: Anthropic News | **作者**: Anthropic Team | **發布時間**: 2026-01-05 14:00 UTC
**連結**: https://www.anthropic.com/news/claude-3-5-sonnet

---

## 層級 2：AI Coding 編輯器與工具

### VS Code Release (v1.95.0)

- VS Code 1.95.0 發布，改進 AI 助手集成
- 新增 GitHub Copilot Chat 快速命令
- 修復多個 IntelliSense 效能問題

**來源**: VS Code Release | **發布時間**: 2026-01-04 08:00 UTC
**連結**: https://github.com/microsoft/vscode/releases/tag/v1.95.0

---

## 層級 3：開發框架、SDK 與社群

### Vercel AI SDK

[類似格式...]

---

## 報告統計

- **總資訊項數**: 42
- **層級 1**: 12 則（來自 5 個來源）
- **層級 2**: 18 則（來自 4 個來源）
- **層級 3**: 12 則（來自 8 個來源）
- **蒐集來源總數**: 17 個
- **成功來源**: 16 個 | **失敗來源**: 1 個（Hacker News 超時）
- **去重移除**: 5 則
- **過濾移除**: 8 則（不符合 AI 相關主題）

---

## 執行日誌摘要

| 來源 | 狀態 | 蒐集項數 | 耗時 | 備註 |
|-----|------|--------|------|------|
| OpenAI Blog | ✅ 成功 | 3 | 2.3s | - |
| Anthropic News | ✅ 成功 | 2 | 1.8s | - |
| Hacker News AI | ❌ 超時 | 0 | 30.0s | 請求超時，跳過 |
| ... | ... | ... | ... | ... |

**執行統計**:
- 開始時間: 2026-01-06 02:15 UTC+8
- 結束時間: 2026-01-06 02:45 UTC+8
- 總耗時: 30 分鐘
- 成功率: 94% (16/17 來源)

---
```

**檔案特點**:
- Markdown 格式，人類可讀
- 分層級結構，易於掃讀
- 包含完整元資料和執行統計
- 文件大小控制 <5MB

#### 5.2.4 Execution Log（執行日誌）

**檔案**: `./logs/2026-01-06-02-15.log`

```json
{
  "execution": {
    "id": "exec_20260106_0215",
    "started_at": "2026-01-06T02:15:00Z",
    "ended_at": "2026-01-06T02:45:00Z",
    "duration_ms": 1800000,
    "trigger": "scheduled"                          // scheduled | manual
  },
  "sources": [
    {
      "name": "OpenAI Blog",
      "tier": 1,
      "type": "rss",
      "status": "success",                          // success | failed
      "items_collected": 3,
      "items_after_dedup": 3,
      "items_after_filter": 2,
      "duration_ms": 2300,
      "started_at": "2026-01-06T02:15:10Z",
      "ended_at": "2026-01-06T02:15:12Z"
    },
    {
      "name": "Hacker News AI",
      "tier": 3,
      "type": "rss",
      "status": "failed",
      "error_type": "timeout",                      // timeout | connection | auth | parse | other
      "error_message": "Request timeout after 30s",
      "duration_ms": 30000,
      "started_at": "2026-01-06T02:25:00Z",
      "ended_at": "2026-01-06T02:25:30Z"
    }
  ],
  "summarization": {
    "status": "success",
    "items_processed": 37,
    "items_failed": 1,                              // AI 摘要失敗的項數
    "duration_ms": 45000,
    "gemini_api_calls": 38
  },
  "deduplication": {
    "total_items": 42,
    "duplicates_found": 5,
    "duplicates_removed": 5,
    "algorithms_used": ["levenshtein", "simhash"]
  },
  "filtering": {
    "total_items": 37,
    "items_filtered_out": 8,
    "reason_breakdown": {
      "low_relevance": 5,
      "short_content": 3
    }
  },
  "report": {
    "status": "success",
    "file_path": "/Users/key.cheng/AI-News/output/digests/2026-01-06-digest.md",
    "file_size_bytes": 45678,
    "generated_at": "2026-01-06T02:45:00Z"
  },
  "push": {
    "status": "pending",                            // pending | success | failed
    "channel": "email",
    "attempts": 0,
    "last_attempt_at": null,
    "next_retry_at": null
  },
  "summary": {
    "total_sources": 17,
    "successful_sources": 16,
    "failed_sources": 1,
    "success_rate": 0.94,
    "total_items_collected": 42,
    "final_items_count": 29,
    "sensitive_data_masked": true
  }
}
```

**關鍵設計**:
- 結構化 JSON，機器可讀
- 包含完整時間戳，便於性能分析
- 敏感資訊已遮蔽（見下方）
- 支援後續查詢和分析

### 5.3 敏感資訊遮蔽

**在日誌中遮蔽**:

```javascript
// 遮蔽規則
const maskSensitive = (log) => {
  // API 金鑰: 僅顯示前 4 碼和後 4 碼
  log = log.replace(
    /ghp_[a-zA-Z0-9]+/g,
    (token) => `ghp_${token.slice(4, 8)}***${token.slice(-4)}`
  );

  // 認證 Token（如 Bearer token）
  log = log.replace(
    /Bearer [a-zA-Z0-9_-]+/g,
    "Bearer ***"
  );

  // Email（若出現在日誌）
  log = log.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "***@***.***"
  );

  return log;
};
```

### 5.4 目錄結構設計

```
/Users/key.cheng/AI-News/
├── config/
│   ├── sources.json              # 資訊來源配置（已提供）
│   └── sources.example.json      # 範例配置
├── data/
│   ├── items.json                # 當日收集的資訊項目
│   ├── items.backup.json         # 前一日資訊（用於恢復）
│   ├── dedup-index.json          # 去重索引
│   └── dedup-index.backup.json   # 備份
├── output/
│   └── digests/
│       ├── 2026-01-06-digest.md  # 摘要報告
│       ├── 2026-01-05-digest.md  # 前一日報告
│       └── ...
├── logs/
│   ├── 2026-01-06-02-15.log      # 執行日誌（JSON）
│   └── ...
├── .env                          # 環境變數（Git 忽略）
├── .gitignore                    # 包含: data/, logs/, .env
└── src/
    ├── index.js
    ├── collectors/
    ├── filters/
    ├── summarizers/
    ├── generators/
    └── utils/
```

**權限設定**:
```bash
# 摘要報告 - 使用者可讀寫
chmod 644 output/digests/*.md

# 日誌 - 使用者可讀（敏感資訊遮蔽）
chmod 644 logs/*.log

# 資料檔案 - 使用者可讀寫
chmod 644 data/*.json
```

---

## 6. 資料清理策略

### 6.1 清理時機和邏輯

**清理觸發點**:

```
系統啟動時（每日）
     ↓
檢查當前日期
     ↓
（若日期變更）加載前一日資料 → 檢查 retention_until
     ↓
刪除超期資料
     ↓
保存本日資料開始蒐集
```

### 6.2 詳細清理流程

**清理時序圖**:

```
Day 1 (2026-01-05)
├── 02:15 蒐集資料 → retention_until = 2026-01-06 00:00:00
├── 02:45 生成報告
└── 全天 資料在記憶體 + data/items.json

Day 2 (2026-01-06)
├── 00:00:01 系統啟動排程
│   ├── 讀取 data/items.json（前一日資料）
│   ├── 檢查所有 item.retention_until <= now
│   ├── 刪除過期項目
│   ├── 刪除 data/dedup-index.json（前一日索引）
│   └── 初始化新日期資料
├── 02:15 蒐集資料 → retention_until = 2026-01-07 00:00:00
└── 02:45 生成報告
```

### 6.3 清理實作偽代碼

```javascript
async function cleanupOldData() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dataFile = `./data/items.json`;
  const dedupFile = `./data/dedup-index.json`;
  const lastRunFile = `./data/.lastrun`;

  // 讀取上次清理日期
  let lastCleanupDate = null;
  try {
    const lastRun = JSON.parse(fs.readFileSync(lastRunFile, 'utf-8'));
    lastCleanupDate = lastRun.date;
  } catch (e) {
    lastCleanupDate = null;
  }

  // 若今天未清理過，執行清理
  if (lastCleanupDate !== today) {
    // 清理舊資料
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      const validItems = data.items.filter(
        item => new Date(item.retention_until) > now
      );

      if (validItems.length < data.items.length) {
        console.log(`清理: 移除 ${data.items.length - validItems.length} 項過期資料`);
        fs.writeFileSync(
          dataFile,
          JSON.stringify({ items: validItems, metadata: {...} }, null, 2)
        );
      }
    }

    // 清理舊索引
    if (fs.existsSync(dedupFile)) {
      fs.unlinkSync(dedupFile);
      console.log(`清理: 刪除前一日去重索引`);
    }

    // 記錄清理時間
    fs.writeFileSync(
      lastRunFile,
      JSON.stringify({ date: today, cleaned_at: now.toISOString() }, null, 2)
    );
  }
}
```

### 6.4 自動化排程配置

**GitHub Actions Cron Job** (`.github/workflows/daily-digest.yml`):

```yaml
name: Daily AI News Digest

on:
  schedule:
    - cron: '15 18 * * *'  # 每天 18:15 UTC (次日 02:15 台灣時間)
  workflow_dispatch:       # 允許手動觸發

jobs:
  cleanup-and-digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Cleanup old data
        run: node -e "require('./src/utils/cleanup').cleanupOldData()"

      - name: Run daily digest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          NEWSAPI_KEY: ${{ secrets.NEWSAPI_KEY }}
        run: npm start -- --run-now

      - name: Upload logs and reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: digest-${{ github.run_number }}
          path: |
            output/digests/
            logs/
          retention-days: 7
```

**本地系統排程**（Linux/macOS）:

使用 `crontab -e` 配置：

```cron
# 每天 02:15 執行清理 + 蒐集
15 02 * * * cd /Users/key.cheng/AI-News && node src/index.js --run-now 2>&1 | tee -a logs/$(date +\%Y-\%m-\%d).cron.log
```

### 6.5 清理邊界情況處理

| 情況 | 處理方式 |
|-----|--------|
| 系統在清理時崩潰 | `.lastrun` 檔案記錄清理狀態，重啟時重試 |
| 清理時正在產生摘要 | 使用檔案鎖（flock）避免衝突 |
| 手動誤刪資料檔案 | 檢查 `.backup` 版本進行恢復 |
| 時區變更（DST） | 系統使用 ISO 8601 UTC 時間戳，自動適應 |
| 多個進程同時執行 | 使用 PID 檔案記錄執行狀態，防止重複執行 |

---

## 7. GitHub API 速率限制處理

### 7.1 速率限制詳情

**Authenticated Requests**:
- **Limit**: 5000 requests/hour
- **Reset**: 每小時重置
- **Header**: `X-RateLimit-Remaining` 和 `X-RateLimit-Reset`

**Unauthenticated Requests**:
- **Limit**: 60 requests/hour
- **不推薦**: MVP 階段必須使用認證

### 7.2 速率限制追蹤實作

```javascript
// utils/github-rate-limit.js
class GitHubRateLimitTracker {
  constructor() {
    this.remaining = 5000;
    this.reset = null;
  }

  // 從 Response header 更新限制
  updateFromResponse(headers) {
    this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    this.reset = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
  }

  // 檢查是否超限
  isLimitExceeded() {
    return this.remaining <= 0;
  }

  // 取得重置時間
  getResetTime() {
    return new Date(this.reset);
  }

  // 等待重置
  async waitForReset() {
    const now = Date.now();
    const waitTime = Math.max(0, this.reset - now);
    if (waitTime > 0) {
      console.log(`速率限制已達，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 使用示例
const tracker = new GitHubRateLimitTracker();

async function fetchReleases(owner, repo) {
  if (tracker.isLimitExceeded()) {
    await tracker.waitForReset();
  }

  const response = await octokit.repos.listReleases({
    owner,
    repo,
    per_page: 5  // 設定較小值避免超限
  });

  tracker.updateFromResponse(response.headers);
  return response.data;
}
```

### 7.3 批量請求優化

**策略**:
1. **並發限制** - 最多 5 個並發 GitHub 請求（FR-025）
2. **優先順序** - 層級 1 > 層級 2 > 層級 3
3. **退避策略** - 若剩餘配額 <100，延遲後續請求

```javascript
// 使用 p-queue 控制並發
const PQueue = require('p-queue');

const queue = new PQueue({ concurrency: 5 });

const githubSources = [
  { repo: 'microsoft/vscode', tier: 2 },
  { repo: 'zed-industries/zed', tier: 2 },
  // ...
];

const releases = await Promise.all(
  githubSources.map(source =>
    queue.add(() => fetchReleases(source.repo.split('/')[0], source.repo.split('/')[1]))
  )
);
```

---

## 8. 實作建議

### 8.1 初始化步驟

1. **安裝依賴**
   ```bash
   npm install \
     @octokit/rest \                    # GitHub API 客戶端
     rss-parser \                       # RSS 解析
     axios \                            # HTTP 客戶端（RSS + Others）
     string-similarity \                # 字串相似度
     simhash \                          # 內容指紋
     @google/generative-ai \            # Gemini API
     dotenv \                           # 環境變數
     p-queue                            # 並發控制
   ```

2. **建立目錄結構**
   ```bash
   mkdir -p {config,data,output/digests,logs,src/{collectors,filters,summarizers,generators,utils}}
   ```

3. **配置環境變數** (`.env`)
   ```env
   GITHUB_TOKEN=ghp_xxx...
   GEMINI_API_KEY=sk-proj-xxx...
   NEWSAPI_KEY=xxx...
   AI_NEWS_CONFIG_PATH=./config/sources.json
   AI_NEWS_OUTPUT_PATH=./output/digests
   AI_NEWS_LOGS_PATH=./logs
   ```

4. **初始化資料檔案**
   ```bash
   node -e "require('./src/utils/init').initializeDataStructure()"
   ```

### 8.2 模組化設計（簡化版）

**不引入複雜的模組註冊系統**，而是使用簡單的函式組合：

```javascript
// src/index.js
const { collectFromSources } = require('./collectors');
const { deduplicateAndFilter } = require('./filters');
const { summarizeItems } = require('./summarizers');
const { generateMarkdownReport } = require('./generators');
const { cleanupOldData } = require('./utils/cleanup');

async function main() {
  // 1. 清理舊資料
  await cleanupOldData();

  // 2. 蒐集
  const rawItems = await collectFromSources();

  // 3. 去重與過濾
  const filteredItems = await deduplicateAndFilter(rawItems);

  // 4. 摘要生成
  const summarizedItems = await summarizeItems(filteredItems);

  // 5. 報告產生
  const report = await generateMarkdownReport(summarizedItems);

  // 6. 推送（可選）
  // await pushReport(report);
}

main().catch(console.error);
```

### 8.3 測試策略

```javascript
// tests/unit/dedup.test.js
const { deduplicateItems } = require('../../src/filters/dedup');

describe('Deduplication', () => {
  it('should identify duplicate titles with 80% similarity', () => {
    const items = [
      { title: 'Claude 3.5 Sonnet Released' },
      { title: 'Claude 3.5 Sonnet is now available' }
    ];

    const result = deduplicateItems(items);
    expect(result.duplicates.length).toBe(1);
  });
});
```

---

## 9. 風險與緩解措施

| 風險 | 可能性 | 影響 | 緩解措施 |
|-----|--------|------|--------|
| **Gemini API 限流** | 中 | 摘要產生延遲 | 實作重試邏輯（2 次，間隔 5 秒） |
| **GitHub Rate Limit** | 低 | 無法蒐集 Release | 使用 PAT 認證，監控配額 |
| **RSS Feed 格式不規範** | 中 | 解析失敗 | 容錯機制，跳過格式錯誤項目 |
| **資料檔案衝突** | 低 | 資料丟失 | 使用檔案鎖，備份機制 |
| **敏感資訊洩露** | 低 | 安全漏洞 | 遮蔽日誌，環境變數管理 |

---

## 10. 決策總結表

| 項目 | 決策 | 根據 |
|-----|------|------|
| **資料持久化** | JSON 檔案 | MVP 快速啟動 |
| **GitHub API 客戶端** | @octokit/rest | 減少風險，專注核心功能 |
| **認證方式** | Personal Access Token | 安全且易於管理 |
| **必要端點** | Releases 只讀 | 7 個 GitHub 來源 |
| **敏感資訊** | 環境變數 + 日誌遮蔽 | 安全最佳實踐 |
| **清理時機** | 每日系統啟動時 | 簡單可靠 |
| **並發控制** | 5 個並發源 | 平衡效能與穩定性 |

---

## 附錄：GitHub API 使用範例

### A.1 @octokit/rest 完整範例

```javascript
const { Octokit } = require("@octokit/rest");
const fs = require("fs");

async function fetchGitHubReleases() {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const repositories = [
    "microsoft/vscode",
    "zed-industries/zed",
    "vercel/ai"
  ];

  const allReleases = [];

  for (const repo of repositories) {
    const [owner, repoName] = repo.split("/");

    try {
      // 取得最新 5 個 Release
      const { data } = await octokit.repos.listReleases({
        owner,
        repo: repoName,
        per_page: 5
      });

      data.forEach(release => {
        allReleases.push({
          source: repo,
          title: release.name || release.tag_name,
          published_at: release.published_at,
          body: release.body,  // Markdown Release Notes
          url: release.html_url,
          is_prerelease: release.prerelease
        });
      });

      console.log(`✓ ${repo}: 取得 ${data.length} 個 Release`);
    } catch (error) {
      console.error(`✗ ${repo}: ${error.message}`);
    }
  }

  return allReleases;
}

// 使用
fetchGitHubReleases().then(releases => {
  console.log(`總共取得 ${releases.length} 個 Release`);
  fs.writeFileSync("releases.json", JSON.stringify(releases, null, 2));
});
```

### A.2 錯誤處理範例

```javascript
async function robustFetchReleases(owner, repo, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await octokit.repos.listReleases({
        owner,
        repo,
        per_page: 5
      });
      return data;
    } catch (error) {
      lastError = error;

      if (error.status === 404) {
        console.error(`倉庫 ${owner}/${repo} 不存在`);
        return null;
      }

      if (error.status === 403) {
        console.error(`速率限制或權限拒絕`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      if (error.status === 500) {
        console.error(`GitHub 伺服器錯誤，重試...`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
    }
  }

  throw lastError;
}
```

---

## 參考資源

- **@octokit/rest 文件**: https://octokit.github.io/rest.js/v20
- **GitHub REST API v3**: https://docs.github.com/en/rest
- **GitHub Authentication**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- **Rate Limiting**: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

---

**報告結束** | 次階段：實裝 Phase 1 設計方案
