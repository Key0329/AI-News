# Data Model: AI & AI Coding 自動化情報助手

**Branch**: `001-ai-news-assistant` | **Date**: 2026-01-06 | **Phase**: Phase 1 Design

---

## 概述

本文檔定義系統所有資料結構、檔案格式、驗證規則及關聯關係。所有資料模型設計遵循以下原則:

1. **MVP 優先**: 使用 JSON 檔案持久化，避免引入資料庫複雜度
2. **人類可讀**: 所有檔案採用可讀格式（JSON、Markdown），便於除錯
3. **資料隔離**: 配置、資料、輸出、日誌分離存放
4. **每日清理**: 資料設計支援自動清理機制
5. **向後相容**: 保留未來升級至 SQLite 的擴展路徑

---

## 資料層級架構

系統資料分為四個層級:

```
層級 1: Configuration（配置層）
  └── 來源配置（sources.json）
  └── 環境變數（.env）

層級 2: Runtime Data（執行時資料層）
  └── 資訊項目（items.json）
  └── 去重索引（dedup-index.json）

層級 3: Output（輸出層）
  └── 摘要報告（YYYY-MM-DD-digest.md）

層級 4: Logs（日誌層）
  └── 執行日誌（YYYY-MM-DD-HH-MM.log）
```

---

## 核心實體定義

### 1. 資訊項目（News Item）

**用途**: 代表單一則 AI 或 AI Coding 相關資訊

**儲存位置**: `./data/items.json`

**Schema**:

```typescript
interface NewsItem {
  // 識別欄位
  id: string;                    // 格式: "item_YYYYMMDD_NNN"，唯一識別符

  // 內容欄位
  title: string;                 // 資訊標題（必填）
  summary: string[];             // 3-5 點繁體中文摘要（AI 生成）
  content?: string;              // 原始內容（若摘要失敗使用）
  content_length: number;        // 內容字數
  language: string;              // 原始語言（如 "en", "zh-TW"）

  // 來源欄位
  source: {
    name: string;                // 來源名稱（如 "Anthropic News"）
    tier: 1 | 2 | 3;             // 來源層級
    type: "rss" | "api" | "web"; // 來源類型
  };
  author?: string;               // 作者（選填）

  // 時間欄位
  published_at: string;          // ISO 8601 格式，發布時間
  collected_at: string;          // ISO 8601 格式，蒐集時間
  retention_until: string;       // ISO 8601 格式，保留截止日期

  // 元資料欄位
  original_url: string;          // 原始連結（必填）
  relevance_score: number;       // AI 相關性評分 [0, 1]
  votes_or_score?: number;       // 社群投票數（若適用）
}
```

**範例**:

```json
{
  "id": "item_20260106_001",
  "title": "Claude 3.5 Sonnet 發布",
  "summary": [
    "Claude 3.5 Sonnet 正式發布，性能提升 40%",
    "新增視覺理解能力，支援圖片分析",
    "API 定價保持不變，相同成本下性能提升"
  ],
  "content": "Original English content...",
  "content_length": 1234,
  "language": "en",
  "source": {
    "name": "Anthropic News",
    "tier": 1,
    "type": "rss"
  },
  "author": "Anthropic Team",
  "published_at": "2026-01-05T14:00:00Z",
  "collected_at": "2026-01-06T02:30:00Z",
  "retention_until": "2026-01-07T00:00:00Z",
  "original_url": "https://www.anthropic.com/news/claude-3-5-sonnet",
  "relevance_score": 0.95,
  "votes_or_score": null
}
```

**驗證規則**:

- `id`: 必填，格式 `/^item_\d{8}_\d{3}$/`
- `title`: 必填，長度 1-500 字元
- `summary`: 陣列，長度 3-5
- `source.tier`: 必須為 1, 2, 或 3
- `published_at`, `collected_at`, `retention_until`: 必填，有效 ISO 8601 格式
- `original_url`: 必填，有效 URL 格式
- `relevance_score`: 必填，範圍 [0, 1]

---

### 2. 資訊來源（Source）

**用途**: 代表系統蒐集資訊的來源配置

**儲存位置**: `./config/sources.json`

**Schema**:

```typescript
interface Source {
  // 識別欄位
  name: string;                  // 來源名稱（唯一）

  // 分類欄位
  tier: 1 | 2 | 3;               // 來源層級
  type: "rss" | "api" | "web";   // 來源類型

  // 連線欄位
  url: string;                   // RSS feed URL 或 API endpoint
  auth_required: boolean;        // 是否需要認證
  auth_env_var?: string;         // 環境變數名稱（如 "GITHUB_TOKEN"）

  // 查詢欄位（API 專用）
  search_keywords?: string[];    // 搜尋關鍵字
  api_params?: {                 // API 專屬參數
    endpoint?: string;           // 端點路徑
    method?: "GET" | "POST";     // HTTP 方法
    query_params?: Record<string, string>;  // 查詢參數
  };

  // 控制欄位
  enabled: boolean;              // 是否啟用
  max_items: number;             // 最大抓取項數（預設 20）
  timeout_ms: number;            // 請求超時時間（預設 30000）

  // 狀態欄位（系統自動維護）
  last_success_at?: string;      // 上次成功時間（ISO 8601）
  last_error_type?: "connection" | "auth" | "parse" | "timeout" | "other";
  last_error_message?: string;   // 上次錯誤訊息
}
```

**範例**:

```json
{
  "name": "Anthropic News",
  "tier": 1,
  "type": "rss",
  "url": "https://www.anthropic.com/news/rss.xml",
  "auth_required": false,
  "enabled": true,
  "max_items": 20,
  "timeout_ms": 30000,
  "last_success_at": "2026-01-06T02:15:12Z",
  "last_error_type": null,
  "last_error_message": null
}
```

**驗證規則**:

- `name`: 必填，唯一，長度 1-100 字元
- `tier`: 必填，必須為 1, 2, 或 3
- `type`: 必填，必須為 "rss", "api", 或 "web"
- `url`: 必填，有效 URL 格式
- `auth_required`: 必填
- `auth_env_var`: 當 `auth_required=true` 時必填
- `max_items`: 必填，範圍 [1, 100]
- `timeout_ms`: 必填，範圍 [1000, 60000]

---

### 3. 來源配置檔案（Sources Config）

**用途**: 包含所有來源的完整配置檔案結構

**儲存位置**: `./config/sources.json`

**Schema**:

```typescript
interface SourcesConfig {
  version: string;               // 配置版本號（語義化版本）
  global_settings: {
    default_timeout_ms: number;  // 預設超時時間
    default_max_items: number;   // 預設最大項數
    default_timezone: string;    // 預設時區（如 "Asia/Taipei"）
  };
  sources: Source[];             // 來源清單
}
```

**範例**:

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
    }
  ]
}
```

**驗證規則**:

- `version`: 必填，符合語義化版本格式（如 "1.0.0"）
- `sources`: 必填，陣列，至少包含 3 個來源
- `sources[].name`: 所有來源名稱必須唯一

---

### 4. 去重索引（Deduplication Index）

**用途**: 追蹤重複資訊的檢測結果，便於除錯與查詢

**儲存位置**: `./data/dedup-index.json`

**Schema**:

```typescript
interface DeduplicationIndex {
  title_signatures: Record<string, {
    hash: string;                // 標題簽名（MD5 或 SimHash）
    items: {
      id: string;                // News Item ID
      source: string;            // 來源名稱
      content_length: number;    // 內容長度
      is_selected: boolean;      // 是否為保留版本
    }[];
  }>;
  content_fingerprints: Record<string, string[]>;  // 內容指紋 → Item IDs
  metadata: {
    dedup_algorithm: "levenshtein" | "cosine" | "hybrid";
    similarity_threshold: number;     // 相似度門檻（0.8）
    fingerprint_algorithm: "md5" | "simhash" | "hybrid";
    last_updated: string;             // ISO 8601 格式
  };
}
```

**範例**:

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
        },
        {
          "id": "item_20260106_002",
          "source": "Hacker News AI",
          "content_length": 900,
          "is_selected": false
        }
      ]
    }
  },
  "content_fingerprints": {
    "fp_xyz789": ["item_20260106_001", "item_20260106_002"]
  },
  "metadata": {
    "dedup_algorithm": "hybrid",
    "similarity_threshold": 0.8,
    "fingerprint_algorithm": "hybrid",
    "last_updated": "2026-01-06T02:45:00Z"
  }
}
```

**驗證規則**:

- `metadata.similarity_threshold`: 範圍 [0, 1]
- `metadata.last_updated`: 有效 ISO 8601 格式

---

### 5. 摘要報告（Daily Digest）

**用途**: 每日產生的整合報告

**儲存位置**: `./output/digests/YYYY-MM-DD-digest.md`

**格式**: Markdown

**結構**:

```markdown
# AI & AI Coding 自動化情報助手 - 每日摘要

**日期**: YYYY-MM-DD | **產生時間**: HH:MM UTC+8 | **總資訊項數**: N

---

## 層級 1：核心模型與 AI 實驗室

### [來源名稱]

**[資訊標題]**

- 摘要點 1
- 摘要點 2
- 摘要點 3

**來源**: [來源名稱] | **作者**: [作者] | **發布時間**: YYYY-MM-DD HH:MM UTC
**連結**: [原始連結]

---

## 層級 2：AI Coding 編輯器與工具

[類似格式...]

---

## 層級 3：開發框架、SDK 與社群

[類似格式...]

---

## 報告統計

- **總資訊項數**: N
- **層級 1**: N1 則（來自 X 個來源）
- **層級 2**: N2 則（來自 Y 個來源）
- **層級 3**: N3 則（來自 Z 個來源）
- **蒐集來源總數**: M 個
- **成功來源**: S 個 | **失敗來源**: F 個
- **去重移除**: D 則
- **過濾移除**: P 則（不符合 AI 相關主題）

---

## 執行日誌摘要

| 來源 | 狀態 | 蒐集項數 | 耗時 | 備註 |
|-----|------|--------|------|------|
| [來源] | ✅ 成功 | N | X.Xs | - |
| [來源] | ❌ 失敗 | 0 | X.Xs | 錯誤訊息 |

**執行統計**:
- 開始時間: YYYY-MM-DD HH:MM UTC+8
- 結束時間: YYYY-MM-DD HH:MM UTC+8
- 總耗時: N 分鐘
- 成功率: X% (S/M 來源)

---
```

**驗證規則**:

- 檔案大小不超過 5MB（FR-027）
- 必須包含至少 5 則資訊（SC-002）
- Markdown 格式正確（可使用 markdownlint 驗證）

---

### 6. 執行日誌（Execution Log）

**用途**: 記錄單次系統執行的完整日誌

**儲存位置**: `./logs/YYYY-MM-DD-HH-MM.log`

**格式**: JSON

**Schema**:

```typescript
interface ExecutionLog {
  execution: {
    id: string;                  // 格式: "exec_YYYYMMDD_HHMM"
    started_at: string;          // ISO 8601 格式
    ended_at: string;            // ISO 8601 格式
    duration_ms: number;         // 總執行時間（毫秒）
    trigger: "scheduled" | "manual";  // 觸發方式
  };

  sources: {
    name: string;                // 來源名稱
    tier: 1 | 2 | 3;
    type: "rss" | "api" | "web";
    status: "success" | "failed";
    items_collected: number;     // 蒐集項數
    items_after_dedup: number;   // 去重後項數
    items_after_filter: number;  // 過濾後項數
    duration_ms: number;         // 執行時間
    started_at: string;          // ISO 8601 格式
    ended_at: string;            // ISO 8601 格式
    error_type?: "timeout" | "connection" | "auth" | "parse" | "other";
    error_message?: string;      // 敏感資訊已遮蔽
  }[];

  summarization: {
    status: "success" | "partial" | "failed";
    items_processed: number;     // 處理項數
    items_failed: number;        // 失敗項數
    duration_ms: number;
    gemini_api_calls: number;    // API 調用次數
  };

  deduplication: {
    total_items: number;
    duplicates_found: number;
    duplicates_removed: number;
    algorithms_used: string[];   // ["levenshtein", "simhash"]
  };

  filtering: {
    total_items: number;
    items_filtered_out: number;
    reason_breakdown: Record<string, number>;  // 過濾原因統計
  };

  report: {
    status: "success" | "failed";
    file_path: string;
    file_size_bytes: number;
    generated_at: string;        // ISO 8601 格式
  };

  push?: {
    status: "pending" | "success" | "failed";
    channel?: "email" | "slack" | "other";
    attempts: number;
    last_attempt_at?: string;    // ISO 8601 格式
    next_retry_at?: string;      // ISO 8601 格式
  };

  summary: {
    total_sources: number;
    successful_sources: number;
    failed_sources: number;
    success_rate: number;        // 範圍 [0, 1]
    total_items_collected: number;
    final_items_count: number;
    sensitive_data_masked: boolean;  // 必須為 true
  };
}
```

**敏感資訊遮蔽規則**:

```javascript
// API Token: ghp_abc123***xyz789
// Bearer Token: Bearer ***
// Email: ***@***.***
```

**驗證規則**:

- `execution.id`: 格式 `/^exec_\d{8}_\d{4}$/`
- `summary.sensitive_data_masked`: 必須為 `true`
- `summary.success_rate`: 範圍 [0, 1]

---

### 7. 過濾規則（Filter Rule）

**用途**: 定義內容相關性過濾邏輯（系統內建，非檔案儲存）

**Schema**:

```typescript
interface FilterRule {
  relevance_method: "gemini_semantic";  // 使用 Gemini API 語義判斷
  relevant_topics: string[];            // 相關主題清單
  relevance_calculation: string;        // 計算方式描述
  relevance_threshold: number;          // 相關性門檻 [0, 1]
  content_min_length: number;           // 最小內容長度
  dedup_similarity_threshold: number;   // 去重門檻（0.8）
  similarity_algorithms: ("levenshtein" | "cosine")[];
  fingerprint_algorithms: ("md5" | "simhash")[];
}
```

**預設配置**（寫在程式碼中）:

```typescript
const DEFAULT_FILTER_RULE: FilterRule = {
  relevance_method: "gemini_semantic",
  relevant_topics: [
    "AI 模型",
    "AI 工具",
    "程式碼輔助",
    "開發框架",
    "大型語言模型",
    "機器學習"
  ],
  relevance_calculation: "AI 相關段落占比 > 50% 視為相關",
  relevance_threshold: 0.5,
  content_min_length: 100,
  dedup_similarity_threshold: 0.8,
  similarity_algorithms: ["levenshtein", "cosine"],
  fingerprint_algorithms: ["md5", "simhash"]
};
```

---

### 8. 排程設定（Schedule Config）

**用途**: 系統排程配置（透過環境變數或配置檔案）

**Schema**:

```typescript
interface ScheduleConfig {
  execution_time: string;        // 格式: "HH:MM"（如 "02:15"）
  timezone: string;              // 如 "Asia/Taipei"
  enabled: boolean;
  last_execution_at?: string;    // ISO 8601 格式
}
```

**儲存方式**（二選一）:

1. **環境變數**:
   ```bash
   SCHEDULE_TIME=02:15
   SCHEDULE_TIMEZONE=Asia/Taipei
   SCHEDULE_ENABLED=true
   ```

2. **配置檔案** (`./config/schedule.json`):
   ```json
   {
     "execution_time": "02:15",
     "timezone": "Asia/Taipei",
     "enabled": true,
     "last_execution_at": "2026-01-06T02:15:00Z"
   }
   ```

---

### 9. API 關鍵字配置（API Keywords Config）

**用途**: 用於技術新聞聚合 API 查詢的關鍵字

**儲存位置**: `./config/sources.json` 內的 `search_keywords` 欄位

**範例**:

```json
{
  "name": "NewsAPI - AI Coding",
  "tier": 2,
  "type": "api",
  "url": "https://newsapi.org/v2/everything",
  "search_keywords": [
    "AI coding",
    "large language model",
    "GPT",
    "Claude",
    "LLM",
    "GitHub Copilot",
    "code assistant"
  ],
  "api_params": {
    "query_params": {
      "language": "en",
      "sortBy": "publishedAt"
    }
  }
}
```

---

## 資料關聯圖

```
Sources Config (sources.json)
    ↓ 定義來源
    ↓
Sources → 蒐集 → News Items (items.json)
                      ↓
                   去重檢測
                      ↓
            Deduplication Index (dedup-index.json)
                      ↓
                   過濾相關性
                      ↓
                   AI 摘要生成
                      ↓
                Daily Digest (digest.md)
                      ↓
         Execution Log (YYYY-MM-DD-HH-MM.log)
```

---

## 檔案路徑總覽

```
/Users/key.cheng/AI-News/
├── config/
│   ├── sources.json              # 來源配置（Sources Config）
│   ├── sources.example.json      # 範例配置
│   └── schedule.json             # 排程配置（選填）
│
├── data/
│   ├── items.json                # 資訊項目（News Items）
│   ├── items.backup.json         # 前一日備份
│   ├── dedup-index.json          # 去重索引（Deduplication Index）
│   ├── dedup-index.backup.json   # 備份
│   └── .lastrun                  # 清理時間戳記錄
│
├── output/
│   └── digests/
│       ├── 2026-01-06-digest.md  # 摘要報告（Daily Digest）
│       ├── 2026-01-05-digest.md
│       └── ...
│
├── logs/
│   ├── 2026-01-06-02-15.log      # 執行日誌（Execution Log）
│   └── ...
│
├── .env                          # 環境變數（敏感資訊）
└── .gitignore                    # 包含: data/, logs/, .env
```

---

## 資料驗證總表

| 實體 | 必要驗證 | 選填驗證 |
|-----|---------|---------|
| **News Item** | id, title, source, published_at, collected_at, retention_until, original_url, relevance_score | author, content, votes_or_score |
| **Source** | name, tier, type, url, auth_required, enabled, max_items, timeout_ms | auth_env_var, search_keywords, api_params |
| **Sources Config** | version, sources（至少 3 個） | global_settings |
| **Deduplication Index** | metadata.similarity_threshold, metadata.last_updated | title_signatures, content_fingerprints |
| **Execution Log** | execution.id, summary.sensitive_data_masked | push |

---

## 資料清理邏輯

### 清理時機

- **觸發點**: 每日系統啟動時
- **檢查邏輯**: 比對當前日期與上次清理日期（記錄在 `.lastrun`）

### 清理範圍

1. **刪除過期 News Items**: `retention_until <= now`
2. **刪除前一日去重索引**: `dedup-index.json`
3. **保留摘要報告**: `output/digests/*.md`（手動清理）
4. **保留執行日誌**: `logs/*.log`（手動清理或定期歸檔）

### 清理流程

```
系統啟動
    ↓
讀取 .lastrun
    ↓
（若日期變更）
    ↓
讀取 data/items.json
    ↓
過濾 retention_until > now
    ↓
寫回 data/items.json
    ↓
刪除 data/dedup-index.json
    ↓
更新 .lastrun
    ↓
繼續執行蒐集任務
```

---

## 資料備份策略

### 自動備份

每日清理前自動備份:

```bash
cp data/items.json data/items.backup.json
cp data/dedup-index.json data/dedup-index.backup.json
```

### 手動恢復

```bash
# 恢復前一日資料
cp data/items.backup.json data/items.json
```

### 版本控制

- **排除**: `data/`, `logs/`, `output/`, `.env`（列於 `.gitignore`）
- **包含**: `config/sources.example.json`（範例配置）
- **手動備份**: 使用者可自行備份 `config/sources.json`（若包含敏感資訊則不提交）

---

## 升級路徑：JSON → SQLite

若未來需升級至 SQLite，遷移方案如下:

### 資料表設計（參考）

```sql
-- 資訊項目表
CREATE TABLE news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,  -- JSON 陣列
  content TEXT,
  content_length INTEGER,
  language TEXT,
  source_name TEXT NOT NULL,
  source_tier INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  author TEXT,
  published_at TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  retention_until TEXT NOT NULL,
  original_url TEXT NOT NULL,
  relevance_score REAL NOT NULL,
  votes_or_score INTEGER
);

-- 來源表
CREATE TABLE sources (
  name TEXT PRIMARY KEY,
  tier INTEGER NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_required INTEGER NOT NULL,
  auth_env_var TEXT,
  enabled INTEGER NOT NULL,
  max_items INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  last_success_at TEXT,
  last_error_type TEXT,
  last_error_message TEXT
);

-- 去重索引表
CREATE TABLE dedup_index (
  signature TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  items TEXT NOT NULL  -- JSON 陣列
);
```

### 遷移腳本（偽代碼）

```javascript
async function migrateJsonToSqlite() {
  const db = await sqlite.open('./data/database.db');

  // 1. 建立資料表
  await db.exec(CREATE_TABLES_SQL);

  // 2. 遷移 items.json
  const items = JSON.parse(fs.readFileSync('./data/items.json'));
  for (const item of items.items) {
    await db.run(INSERT_NEWS_ITEM_SQL, item);
  }

  // 3. 遷移 sources.json
  const sources = JSON.parse(fs.readFileSync('./config/sources.json'));
  for (const source of sources.sources) {
    await db.run(INSERT_SOURCE_SQL, source);
  }

  console.log('遷移完成！');
}
```

---

## 附錄：範例資料檔案

### A.1 完整 `items.json` 範例

```json
{
  "items": [
    {
      "id": "item_20260106_001",
      "title": "Claude 3.5 Sonnet 發布",
      "summary": [
        "Claude 3.5 Sonnet 正式發布，性能提升 40%",
        "新增視覺理解能力，支援圖片分析",
        "API 定價保持不變，相同成本下性能提升"
      ],
      "content": "Original English content...",
      "content_length": 1234,
      "language": "en",
      "source": {
        "name": "Anthropic News",
        "tier": 1,
        "type": "rss"
      },
      "author": "Anthropic Team",
      "published_at": "2026-01-05T14:00:00Z",
      "collected_at": "2026-01-06T02:30:00Z",
      "retention_until": "2026-01-07T00:00:00Z",
      "original_url": "https://www.anthropic.com/news/claude-3-5-sonnet",
      "relevance_score": 0.95,
      "votes_or_score": null
    }
  ],
  "metadata": {
    "version": "1.0.0",
    "date": "2026-01-06",
    "total_items": 1,
    "items_by_tier": { "1": 1, "2": 0, "3": 0 }
  }
}
```

### A.2 完整 `sources.json` 範例

請參考 `config/sources.example.json`（實作階段提供）

---

**Phase 1 Design 完成日期**: 2026-01-06
**下一步**: 產生 `quickstart.md` 與更新 agent context
