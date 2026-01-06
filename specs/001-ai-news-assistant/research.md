# Research & Design Decisions: AI & AI Coding 自動化情報助手

**Phase**: Phase 0 Research
**Created**: 2026-01-06
**Status**: ✅ Complete - Ready for Phase 1 Design

---

## 概要

本文檔整合了所有技術研究結果，為 Phase 1 設計階段提供完整的技術決策基礎。所有「NEEDS CLARIFICATION」項目已通過研究解決。

---

## 1. Node.js 生態系統選擇

### 1.1 Node.js 版本

**Decision**: Node.js v22 LTS

**Rationale**:
- v22.x 是最新 LTS 版本（2024 年 10 月發佈），支援至 2027 年 10 月
- 原生支援 fetch API，無需額外依賴
- 完整的 ES2024 支援和性能改進
- 符合「零外部相依」原則

**Alternatives**: v20 LTS（較舊）、v24.x Current（不適合生產）

### 1.2 RSS 解析器

**Decision**: `rss-parser` v3.x

**Rationale**:
- 專門為 RSS/Atom 解析設計，API 簡潔
- 支援 RSS 2.0、Atom 1.0、RDF
- 依賴少（僅 xml2js），維護活躍
- 符合 MVP 原則

**Alternatives**: `feedparser`（維護不活躍）

### 1.3 HTTP 客戶端

**Decision**: 原生 `fetch` API

**Rationale**:
- Node.js v22 完全原生支援，無需額外依賴
- 完全符合「零外部相依」原則
- 標準 Web API，未來通用性強
- 支援超時控制（AbortController）

**Alternatives**: axios（依賴過多），node-fetch（ESM 兼容問題）

### 1.4 測試框架

**Decision**: Vitest v1.x+

**Rationale**:
- 執行速度快（比 Jest 快 10-100 倍）
- 零配置，開箱即用
- 完整 Mock/Spy 支援，原生 TypeScript 支援
- 輕量級，符合「零外部相依」理念

**Alternatives**: Jest（配置複雜）、Mocha + Chai（需組合多工具）

### 1.5 依賴清單摘要

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

**參考**: 詳細分析見上方第一個研究 agent 的完整結果

---

## 2. 去重與相似度演算法

### 2.1 字串相似度

**Decision**: 混合策略（Levenshtein + Cosine Similarity）

**Rationale**:
- **Levenshtein**: 快速檢測標題細微改動（適合 RSS 同源重複）
- **Cosine**: 捕捉語義相似性（適合不同來源重複內容）
- 加權組合：Levenshtein 40% + Cosine 60%
- 效能良好：100 項目對比約 400ms

**實作方案**: 自行實作（約 150 行 JavaScript），無需外部依賴

**80% 相似度門檻**:
```javascript
// 階段 1: Levenshtein 相似度 > 90% → 直接返回
// 階段 2: 否則計算 Cosine 相似度
// 最終: 加權平均 >= 0.8 視為重複
```

### 2.2 內容指紋

**Decision**: 混合策略（MD5 + SimHash）

**Rationale**:
- **MD5**: 精確去重（完全相同內容），使用 Node.js 內建 `crypto`
- **SimHash**: 模糊去重（相似但不完全相同），自行實作約 100 行
- Hamming 距離 ≤ 3 視為相似（可檢測 5-10% 的改動）

**效能**: 100 項目內容指紋計算約 100ms

### 2.3 去重流程

```
階段 1: 快速篩選（完全相同標題）
  ↓
階段 2: 標題相似度檢測（80% 門檻）
  ↓
階段 3: 內容指紋驗證（MD5 + SimHash）
  ↓
階段 4: 版本選擇（字數、技術細節、來源層級、時間）
```

**版本選擇評分**:
- 字數（30 分）+ 技術細節（40 分）+ 來源層級（20 分）+ 時間新鮮度（10 分）

**參考**: [完整研究報告](./DEDUPLICATION_RESEARCH.md)（包含詳細實作程式碼）

---

## 3. Gemini API Token 優化

### 3.1 Prompt 設計

**System Prompt（精簡版，35-40 tokens）**:
```
從以下內容提煉 3-5 點核心摘要，翻譯成繁體中文。
格式: Markdown 條列（-）, 每點 15-40 字, 避免重複。
重點：AI 模型、AI 工具、程式碼輔助、開發框架。
```

**User Prompt（結構化輸入，~300 tokens）**:
```
標題: ${title}
摘要: ${summary.slice(0, 200)}
要點: ${keywords.join(', ')}

翻譯成繁體中文摘要。
```

**Token 節省**: ~45% (vs 標準冗長 System Prompt)

### 3.2 批次處理

**Decision**: 5 則資訊為一批次

**Rationale**:
- API 調用減少 80%（100 則 → 20 次）
- 批次格式：【新聞 1】【新聞 2】... → 【摘要 1】【摘要 2】...
- 批次間延遲 1-4 秒避免速率限制

### 3.3 快取策略

**Decision**: 應用層 URL Hash 快取（24 小時 TTL）

**Rationale**:
- 相同 URL 視為重複，無需重新摘要
- 快取命中率預期 30-50%
- 使用 SHA256 前 8 碼作為檔案名

### 3.4 成本對比

| 方案 | 每 100 則成本 | 節省比例 |
|------|-----------|---------|
| 原始（完整文章） | $0.11 | 0% |
| 結構化輸入 | $0.06 | 45% |
| + 批次 5 則 | $0.04 | 64% |
| **+ 應用層快取** | **$0.02** | **82%** |

**參考**: [完整優化指南](./GEMINI_TOKEN_OPTIMIZATION.md) | [快速參考](./GEMINI_QUICK_REFERENCE.md)

---

## 4. 資料持久化方案

### 4.1 儲存選擇

**Decision**: JSON 檔案

**Rationale**:
- 零安裝成本，Node.js 內建 JSON 支援
- 資料規模適合（每日 5-100 則，<5MB）
- 人類可讀，除錯友善
- 隔日自動清理，無需長期儲存
- 後續可升級至 SQLite（遷移友善）

**Alternatives**: SQLite（MVP 階段過於複雜）

### 4.2 資料結構設計

**主要檔案**:
1. `data/items.json` - 資訊項目
2. `data/dedup-index.json` - 去重索引
3. `output/digests/YYYY-MM-DD-digest.md` - 摘要報告
4. `logs/YYYY-MM-DD-HH-MM.log` - 執行日誌（JSON）

**Schema 範例**（items.json）:
```json
{
  "items": [
    {
      "id": "item_20260106_001",
      "title": "...",
      "summary": ["點1", "點2", "點3"],
      "source": { "name": "...", "tier": 1, "type": "rss" },
      "published_at": "...",
      "collected_at": "...",
      "original_url": "...",
      "relevance_score": 0.95,
      "retention_until": "2026-01-07T00:00:00Z"
    }
  ],
  "metadata": { "version": "1.0.0", "date": "2026-01-06" }
}
```

### 4.3 清理策略

**觸發時機**: 每日系統啟動時檢查日期變更

**清理邏輯**:
```
讀取 data/items.json
  ↓
過濾 retention_until > now 的項目
  ↓
刪除過期項目
  ↓
刪除 data/dedup-index.json（前一日索引）
  ↓
記錄清理時間到 .lastrun
```

**參考**: [完整研究報告](./RESEARCH_PERSISTENCE_GITHUB_API.md)（包含詳細 Schema 和實作）

---

## 5. GitHub API 整合

### 5.1 客戶端選擇

**Decision**: `@octokit/rest` v20.x

**Rationale**:
- GitHub Release 追蹤涉及 6-8 個來源（VS Code、Zed、Vercel AI 等）
- 自動處理速率限制、分頁、認證
- TypeScript 類型安全，活躍維護
- 1.2MB 依賴合理（vs 自己維護速率限制邏輯的風險）

**Alternatives**: 直接 HTTP 調用（需自己實作速率限制）

### 5.2 認證方案

**Decision**: Personal Access Token (PAT)

**設定**:
1. https://github.com/settings/tokens
2. Scopes: `public_repo` + `repo:status`
3. 環境變數: `GITHUB_TOKEN=ghp_xxx...`

**速率限制**: 5000 requests/hour（已認證） vs 60/hour（未認證）

### 5.3 必要端點

**主要**:
- `GET /repos/{owner}/{repo}/releases`
- 取得最新 5 個 Release
- 欄位: `tag_name`, `name`, `body`, `published_at`, `html_url`

**輔助**:
- `GET /repos/{owner}/{repo}` (驗證倉庫存在性)

**參考**: [完整研究報告](./RESEARCH_PERSISTENCE_GITHUB_API.md)（包含使用範例）

---

## 6. 完整技術選型總結

| 項目 | 決策 | 主要理由 |
|-----|------|--------|
| **Node.js 版本** | v22 LTS | 原生 fetch，長期支援 |
| **RSS 解析** | rss-parser | 專門設計，依賴少 |
| **HTTP 客戶端** | 原生 fetch | 零外部相依 |
| **測試框架** | Vitest | 快速、輕量、零配置 |
| **字串相似度** | Levenshtein + Cosine（自實作） | 無依賴、精確度高 |
| **內容指紋** | MD5 + SimHash（自實作） | 內建 crypto + 自實作 |
| **AI API 優化** | 結構化輸入 + 批次 + 快取 | 82% 成本節省 |
| **資料持久化** | JSON 檔案 | MVP 快速啟動 |
| **GitHub API** | @octokit/rest | 減少風險，專注核心 |

---

## 7. Phase 0 決策檢查清單

- [x] Node.js 版本與依賴選擇
- [x] 去重與相似度演算法設計
- [x] Gemini API Token 優化策略
- [x] 資料持久化方案與 Schema 設計
- [x] GitHub API 整合方案
- [x] 清理策略與自動化排程
- [x] 速率限制處理機制
- [x] 錯誤處理與重試邏輯

---

## 8. Phase 1 準備就緒

所有研究任務已完成，下一步：

1. **Phase 1 設計**:
   - 產生 `data-model.md`（基於第 5 節的 Schema 設計）
   - 產生 `quickstart.md`（開發者快速上手指南）
   - 更新 agent context

2. **實作階段準備**:
   - 可直接參考各研究文檔的程式碼範例
   - 所有技術選型已有明確決策
   - 無阻塞問題

---

## 參考文檔清單

本 research.md 整合以下詳細研究文檔：

1. **[去重與相似度演算法研究](./DEDUPLICATION_RESEARCH.md)** - 完整實作程式碼與測試案例
2. **[Gemini API Token 優化](./GEMINI_TOKEN_OPTIMIZATION.md)** - 詳細 Prompt 設計與成本分析
3. **[Gemini API 快速參考](./GEMINI_QUICK_REFERENCE.md)** - 開發時快速查閱的程式碼片段
4. **[資料持久化與 GitHub API](./RESEARCH_PERSISTENCE_GITHUB_API.md)** - 完整 Schema 設計與 GitHub API 使用範例

---

**Research Phase 完成日期**: 2026-01-06
**下一階段**: Phase 1 Design
