# 資料持久化與 GitHub API 整合 - 研究交付摘要

**Date**: 2026-01-06 | **Status**: Phase 0 Research Complete | **Deliverables**: 2 + Reference Docs

---

## 交付成果概覽

本次研究針對「AI & AI Coding 自動化情報助手」專案的三個關鍵技術問題進行了深入分析，形成了 MVP 階段的明確技術決策。

### 主要交付文件

1. **RESEARCH_PERSISTENCE_GITHUB_API.md** (29KB, 10 大章節)
   - 詳細的技術研究報告，包含完整分析、決策理由、程式碼範例

2. **RESEARCH_SUMMARY.md** (15KB, 9 大段落)
   - 執行摘要版本，按使用者要求的 Markdown 結構化格式
   - 適合快速決策參考和技術文件引用

3. **本文件 (RESEARCH_DELIVERY_SUMMARY.md)**
   - 交付摘要，包含決策快速查詢表、實作建議、後續步驟

---

## 核心決策（快速參考）

### 決策 #1: 資料持久化方案

**選擇: JSON 檔案**

| 維度 | 決策 | 理由 |
|-----|------|------|
| 技術選型 | JSON (本地檔案) | MVP 零依賴，快速啟動 |
| 資料量 | 每日 5-100 項 | 無需資料庫級複雜度 |
| 清理策略 | 每日自動清理 | 隔日簡單刪除 |
| 升級路徑 | → Phase 2 SQLite | 保留未來擴展空間 |

**關鍵參數**:
- 每日蒐集: 5-100 則資訊
- 摘要報告: <5MB
- 保留期: 1 天 (隔日 00:00 清理)
- 檔案位置: `./data/`, `./output/digests/`, `./logs/`

**完整 Schema 範例** (見 RESEARCH_SUMMARY.md 第 3 章):
- News Items: 資訊項目 + 元資料
- Dedup Index: 去重索引 (標題簽名 + 內容指紋)
- Execution Log: JSON 格式執行日誌

---

### 決策 #2: GitHub API 客戶端

**選擇: @octokit/rest (推薦)**

| 維度 | 決策 | 理由 |
|-----|------|------|
| 技術選型 | @octokit/rest | 降低維護風險 |
| 所需端點 | Releases 只讀 | 6-8 個 GitHub 來源 |
| 認證方式 | Personal Access Token | 安全 + 易於管理 |
| 速率限制 | 5000 req/hour | 足夠 MVP 使用 |

**使用場景** (7 個 GitHub 來源):
- Layer 2: VS Code, Zed Editor
- Layer 3: Vercel AI, LangChain.js, LlamaIndex.ts, MCP Servers

**認證設定** (3 步):
1. GitHub Settings → Tokens → Generate PAT (classic)
2. Scopes: `public_repo`, `repo:status` (最小權限)
3. `.env`: `GITHUB_TOKEN=ghp_xxx...`

**完整使用範例** (見 RESEARCH_PERSISTENCE_GITHUB_API.md 附錄 A):
```javascript
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data } = await octokit.repos.listReleases({
  owner: "microsoft",
  repo: "vscode",
  per_page: 5
});
```

---

### 決策 #3: 資料清理策略

**清理時機: 每日系統啟動**

| 項目 | 設定 | 詳情 |
|-----|------|------|
| 觸發時機 | 系統啟動 | 排程執行或手動觸發 |
| 清理邏輯 | 檢查 retention_until | 刪除超期項目 + 舊索引 |
| 邊界情況 | 5 項已處理 | 檔案鎖、備份、PID 追蹤 |
| 排程方案 | GitHub Actions / crontab | 每天 02:15 台灣時間 |

**時序示例**:
```
Day 1 02:15: 蒐集資料 → retention_until = Day 2 00:00
Day 2 00:00: 系統啟動 → 清理 Day 1 資料 → 初始化 Day 2
```

---

## 資料結構設計概覽

### 1. News Item Schema
```json
{
  "id": "item_20260106_001",
  "title": "Claude 3.5 Sonnet Released",
  "summary": ["3-5 點繁體中文摘要..."],
  "source": {"name": "Anthropic News", "tier": 1, "type": "rss"},
  "published_at": "2026-01-05T14:00:00Z",
  "collected_at": "2026-01-06T02:30:00Z",
  "original_url": "https://...",
  "language": "en",
  "relevance_score": 0.95,
  "retention_until": "2026-01-07T00:00:00Z"
}
```

### 2. Deduplication Index Schema
```json
{
  "title_signatures": {
    "claude-3-5-sonnet": {
      "hash": "hash_abc123",
      "items": [{"id": "item_...", "is_selected": true}]
    }
  },
  "content_fingerprints": {
    "fp_xyz789": ["item_001", "item_002"]
  }
}
```

### 3. Execution Log Schema
```json
{
  "execution": {
    "id": "exec_20260106_0215",
    "started_at": "2026-01-06T02:15:00Z",
    "ended_at": "2026-01-06T02:45:00Z",
    "duration_ms": 1800000
  },
  "sources": [...],
  "summary": {
    "total_sources": 17,
    "successful_sources": 16,
    "success_rate": 0.94
  }
}
```

### 4. Daily Digest Report (Markdown)
```markdown
# AI & AI Coding 自動化情報助手 - 每日摘要

## 層級 1：核心模型與 AI 實驗室
### Anthropic News
**Claude 3.5 Sonnet 發布**
- 3-5 點繁體中文摘要
- ...

## 層級 2：AI Coding 編輯器與工具
### VS Code Release
**版本 1.95.0**
- ...

## 層級 3：開發框架與社群
...

## 報告統計
...
```

---

## 完整目錄結構

```
./
├── config/
│   ├── sources.json              # 資訊來源配置
│   └── sources.example.json      # 範例（已提供）
├── data/
│   ├── items.json                # 當日蒐集資訊
│   ├── items.backup.json         # 備份
│   ├── dedup-index.json          # 去重索引
│   ├── dedup-index.backup.json   # 備份
│   └── .lastrun                  # 上次清理時間
├── output/
│   └── digests/
│       ├── 2026-01-06-digest.md
│       └── 2026-01-05-digest.md
├── logs/
│   ├── 2026-01-06-02-15.log      # 執行日誌（JSON）
│   └── 2026-01-05-02-15.log
├── src/
│   ├── index.js
│   ├── collectors/
│   ├── filters/
│   ├── summarizers/
│   ├── generators/
│   └── utils/
├── .env                          # 環境變數（Git 忽略）
├── .gitignore                    # 包含: data/, logs/, .env
└── package.json
```

---

## 敏感資訊管理

### 環境變數

**必要變數** (FR-028):
```bash
# GitHub API
GITHUB_TOKEN=ghp_xxx...

# Google Gemini API
GEMINI_API_KEY=sk-proj-xxx...

# 其他 API（如使用）
NEWSAPI_KEY=xxx...
REDDIT_CLIENT_ID=xxx...
EMAIL_SMTP_PASSWORD=xxx...
```

**設定檔案** (`.env`):
```bash
# .env - Git 忽略
# 從 GitHub Secrets 或本地環境變數載入

# .env.example - Git 追蹤（不含實際值）
GITHUB_TOKEN=
GEMINI_API_KEY=
NEWSAPI_KEY=
```

### 日誌遮蔽

**自動遮蔽規則** (FR-034):
- API 金鑰: `ghp_****···****` (顯示前 4 + 後 4)
- Bearer Token: `Bearer ***`
- Email: `***@***.***`

**實作位置**: 寫入日誌時自動執行

---

## 實作依賴清單

### 必要依賴

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",           // GitHub API (1.2MB)
    "rss-parser": "^3.13.0",              // RSS 解析
    "axios": "^1.6.0",                    // HTTP 客戶端
    "string-similarity": "^4.0.4",        // 字串相似度（80% 去重）
    "@google/generative-ai": "^0.3.0",    // Gemini API
    "dotenv": "^16.3.0",                  // 環境變數
    "p-queue": "^7.4.0"                   // 並發控制（最多 5 個源）
  },
  "devDependencies": {
    "jest": "^29.0.0",                    // 測試框架
    "simhash": "^0.1.0"                   // 內容指紋
  }
}
```

**安裝**:
```bash
npm install @octokit/rest rss-parser axios string-similarity @google/generative-ai dotenv p-queue
npm install --save-dev jest simhash
```

---

## 初始化流程

### 第一次設定（5 步）

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
# 測試各 API 連接
node -e "require('./src/collectors/github').testConnection()"
node -e "require('./src/collectors/rss').testConnection()"
node -e "require('./src/summarizers/gemini').testConnection()"
```

---

## 風險與緩解

### 高風險項目

| 風險 | 可能性 | 影響 | 緩解 |
|-----|--------|------|-----|
| Gemini API 限流 | 中 | 摘要延遲 | 重試 2 次，間隔 5 秒 |
| GitHub Rate Limit | 低 | 無法蒐集 | PAT 認證，監控配額 |
| 資料檔案衝突 | 低 | 資料丟失 | 檔案鎖，備份機制 |
| 敏感資訊洩露 | 低 | 安全漏洞 | 日誌遮蔽，環境變數 |

### 邊界情況

| 情況 | 處理方式 |
|-----|--------|
| 清理時系統崩潰 | `.lastrun` 記錄狀態，重啟時重試 |
| 清理時產生摘要 | 使用檔案鎖避免衝突 |
| 誤刪資料檔案 | 檢查 `.backup` 恢復 |
| 時區變更 (DST) | 使用 ISO 8601 UTC 自動適應 |

---

## 後續實作步驟

### Phase 1：設計實裝 (Next)

1. **資料模型詳細設計** → `data-model.md`
   - 完整 TypeScript interfaces
   - 驗證規則
   - 序列化格式

2. **快速開始指南** → `quickstart.md`
   - 逐步教程
   - 常見問題
   - 除錯技巧

3. **API 契約定義** → `contracts/`
   - GitHub API 合約
   - RSS Parser 合約
   - Gemini API 合約

### Phase 2：任務分解 (After Phase 1)

執行 `/speckit.tasks` 生成 `tasks.md`，包含：
- 模組化實作任務
- 單元測試任務
- 整合測試任務
- 部署配置任務

### Phase 3：實裝執行 (After Phase 2)

執行 `/speckit.implement` 自動執行 `tasks.md` 中的任務

---

## 決策對應表

### User 需求 → 技術決策

| User 需求 (原文) | 技術決策 | 根據規格 |
|-----------------|--------|--------|
| "暫存當日資料，隔日自動清理" | JSON + 每日清理 | FR-011 |
| "追蹤 GitHub Release" | @octokit/rest + 7 個倉庫 | FR-002, FR-015 |
| "資訊項目、來源狀態、執行日誌" | 分層結構 (items/index/logs) | FR-010, FR-031 |
| "設定簡易度、查詢效能、資料完整性、依賴數量" | JSON (簡易優先) | MVP 原則 |
| "GitHub API 端點" | Releases 只讀 | FR-015 |
| "認證方式" | PAT in .env | FR-013, FR-028 |

---

## 參考資源總匯

### 本研究的關鍵檔案

1. **RESEARCH_PERSISTENCE_GITHUB_API.md** (主要報告)
   - 10 章節的詳細分析
   - 完整程式碼範例
   - 附錄：GitHub API 使用範例

2. **RESEARCH_SUMMARY.md** (執行摘要)
   - 結構化決策格式
   - 快速參考表
   - 初始化步驟

3. 本文件 (RESEARCH_DELIVERY_SUMMARY.md)
   - 交付摘要
   - 決策快速查詢
   - 後續步驟

### 外部文件

- **spec.md**: 完整功能規格 (44 個 FR, 5 個 User Stories)
- **plan.md**: 實裝計劃概略
- **sources.example.json**: 資訊來源配置範例（已提供）

### 官方文件

- @octokit/rest: https://octokit.github.io/rest.js/v20
- GitHub REST API: https://docs.github.com/en/rest
- GitHub PAT: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

---

## 快速決策查詢

**Q: 使用什麼持久化方案？**
A: JSON 檔案（零依賴，MVP 快速啟動）

**Q: 怎樣追蹤 GitHub Release？**
A: @octokit/rest + Personal Access Token

**Q: 何時清理舊資料？**
A: 每日系統啟動時，自動刪除 retention_until 超期的項目

**Q: 如何存儲 API 金鑰？**
A: 環境變數 `.env` (Git 忽略)

**Q: 敏感資訊如何防護？**
A: 日誌自動遮蔽，環境變數管理

**Q: 支援多少並發源？**
A: 最多 5 個（FR-025）

**Q: 單份摘要報告最大多大？**
A: 5MB（FR-027），超過時截斷低優先級項目

**Q: 資料規模預期？**
A: 每日 5-100 則資訊，1 天保留期

---

## 檢查清單

### 技術決策確認

- [x] 資料持久化方案確定 (JSON)
- [x] GitHub API 客戶端確定 (@octokit/rest)
- [x] 認證方式確定 (PAT)
- [x] 資料模型設計完成 (4 層結構)
- [x] 清理策略設計完成 (每日啟動)
- [x] 安全方案確定 (環境變數 + 日誌遮蔽)
- [x] 依賴清單確定 (7 個核心 + 2 個開發)

### 文件交付確認

- [x] RESEARCH_PERSISTENCE_GITHUB_API.md (詳細報告)
- [x] RESEARCH_SUMMARY.md (執行摘要)
- [x] RESEARCH_DELIVERY_SUMMARY.md (本文件)
- [x] sources.example.json (已有)

### 後續計劃確認

- [ ] Phase 1: 設計實裝 (data-model.md, quickstart.md, contracts/)
- [ ] Phase 2: 任務分解 (/speckit.tasks → tasks.md)
- [ ] Phase 3: 實裝執行 (/speckit.implement)

---

## 交付完成

**研究結果**: ✅ 完成

**建議行動**:
1. 審核本文件中的三項核心決策
2. 確認技術棧符合專案需求
3. 進入 Phase 1 設計實裝階段

**聯絡人**: Claude Code (AI Assistant)
**下一步**: 執行 `/speckit.plan` 進入 Phase 1 設計

---

**End of Research Delivery Summary** | Date: 2026-01-06
