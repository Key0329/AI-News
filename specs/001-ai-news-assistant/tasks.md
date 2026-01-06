# Tasks: AI & AI Coding 自動化情報助手

**Feature Branch**: `001-ai-news-assistant`
**Generated**: 2026-01-06
**Input**: Design documents from `/specs/001-ai-news-assistant/`

**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md

**Tests**: 未明確要求 TDD，因此不包含測試任務。若需要測試，可透過 Vitest 手動編寫。

**Organization**: 任務依據 User Stories 組織，每個故事可獨立實作與測試。

---

## 格式說明: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案，無相依性）
- **[Story]**: 所屬 User Story（US1, US2, US3, US4, US5）
- 所有任務包含明確的檔案路徑

**專案結構**: Single Project（根目錄為 `/Users/key.cheng/AI-News`）

---

## Phase 1: Setup（專案初始化）

**目的**: 建立專案基礎結構與依賴

- [X] T001 初始化 Node.js 專案結構，建立 src/, config/, data/, output/digests/, logs/, tests/ 目錄
- [X] T002 [P] 建立 package.json，設定 dependencies（rss-parser, @google/generative-ai, @octokit/rest）與 devDependencies（vitest）
- [X] T003 [P] 建立 .gitignore 檔案，排除 data/, logs/, output/, .env, node_modules/
- [X] T004 [P] 建立 .env.example 檔案，包含 GEMINI_API_KEY, GITHUB_TOKEN, NEWSAPI_KEY 等環境變數範本
- [X] T005 [P] 建立 config/sources.example.json 範例配置檔案，包含三層級至少 3 個來源範例
- [X] T006 [P] 建立 README.md，包含專案說明、安裝步驟、快速開始指引

---

## Phase 2: Foundational（基礎架構 - 阻塞前置條件）

**目的**: 核心基礎設施，必須完成後才能開始任何 User Story 實作

**⚠️ 關鍵**: 所有 User Story 依賴此階段完成

- [X] T007 建立 src/utils/config-loader.js，實作配置檔案載入與驗證（支援 sources.json 與環境變數）
- [X] T008 [P] 建立 src/utils/logger.js，實作日誌系統（包含敏感資訊遮蔽、JSON 格式輸出）
- [X] T009 [P] 建立 src/utils/env-validator.js，實作環境變數驗證（檢查 GEMINI_API_KEY, GITHUB_TOKEN 等必要變數）
- [X] T010 [P] 建立 src/models/news-item.js，定義 NewsItem 資料結構與驗證規則
- [X] T011 [P] 建立 src/models/source.js，定義 Source 資料結構與驗證規則
- [X] T012 [P] 建立 src/utils/file-manager.js，實作 JSON 檔案讀寫（items.json, dedup-index.json）
- [X] T013 建立 src/utils/data-cleaner.js，實作每日資料清理邏輯（檢查 retention_until，刪除過期項目）
- [X] T013a [P] 建立 src/utils/execution-state.js，實作執行狀態追蹤（記錄當前階段、開始時間、處理項數到 data/execution-state.json）
- [X] T013b 在 src/index.js 中實作系統啟動時恢復檢測（檢查 data/execution-state.json 是否存在且時間戳記 < 2 小時前）
- [X] T013c 在 src/index.js 中實作恢復提示機制（偵測到未完成任務時，顯示訊息並自動清理或詢問使用者：「偵測到未完成的執行任務（階段：{stage}，開始時間：{time}），是否要清理並重新開始？[Y/n]」，符合 FR-030）

**Checkpoint**: ✅ 基礎設施完成 - User Story 實作現在可以開始平行進行

---

## Phase 3: User Story 5 - 資料來源配置化管理 (Priority: P2)

**目標**: 實作配置檔案載入與驗證機制，讓來源管理與程式碼解耦

**獨立測試**: 修改 config/sources.json 新增/移除來源，驗證系統能正確載入配置並執行蒐集

**為何優先實作**: 此功能是 US1（蒐集）與 US3（多層級來源）的前置需求，必須先完成配置化才能動態管理來源

### 實作任務（User Story 5）

- [X] T014 [P] [US5] 在 src/utils/config-loader.js 中實作 loadSourcesConfig() 函式，讀取並解析 sources.json
- [X] T015 [P] [US5] 在 src/utils/config-loader.js 中實作 validateSourcesConfig() 函式，驗證配置格式與必要欄位（version, sources 陣列至少 3 個）
- [X] T016 [US5] 在 src/utils/config-loader.js 中實作 reloadConfigIfChanged() 函式，支援配置檔案熱重載（每次排程執行時重新載入）
- [X] T017 [US5] 在 src/utils/config-loader.js 中實作來源 enabled 欄位檢查，過濾停用的來源
- [X] T018 [US5] 在 src/utils/env-validator.js 中實作 validateRequiredEnvVars() 函式，驗證來源配置中標記的環境變數是否存在
- [X] T019 [US5] 在 src/index.js 中整合配置載入邏輯，系統啟動時驗證配置並處理錯誤（顯示缺少欄位訊息）

**Checkpoint**: ✅ 配置化系統完成 - 可透過修改 sources.json 動態管理來源

---

## Phase 4: User Story 1 - 自動定時蒐集與摘要產生 (Priority: P1) 🎯 MVP

**目標**: 實作核心蒐集流程，從至少 3 個來源獲取資訊並產生繁體中文摘要報告

**獨立測試**: 執行 `npm start -- --run-now`，驗證能產生包含至少 5 則資訊的摘要報告

### 實作任務（User Story 1）

#### 蒐集模組

- [ ] T020 [P] [US1] 建立 src/collectors/rss-collector.js，實作 RSS feed 解析（使用 rss-parser）
- [ ] T021 [P] [US1] 建立 src/collectors/github-collector.js，實作 GitHub Releases API 蒐集（使用 @octokit/rest）
- [ ] T022 [US1] 建立 src/collectors/collector-orchestrator.js，實作來源蒐集編排器（並發控制最多 5 個，超時 30 秒）
- [ ] T023 [US1] 在 collector-orchestrator.js 中實作錯誤處理（來源失敗不影響其他來源，記錄錯誤類型與訊息）

#### 摘要模組

- [ ] T024 [US1] 建立 src/summarizers/gemini-summarizer.js，實作 Gemini API 調用（使用 @google/generative-ai）
- [ ] T025 [US1] 在 gemini-summarizer.js 中實作 System Prompt（精簡版，35-40 tokens，要求 3-5 點繁體中文摘要）
- [ ] T026 [US1] 在 gemini-summarizer.js 中實作批次處理（5 則為一批次，批次間延遲 1-4 秒）
- [ ] T027 [US1] 在 gemini-summarizer.js 中實作 URL Hash 快取（24 小時 TTL，使用 SHA256 前 8 碼）
- [ ] T028 [US1] 在 gemini-summarizer.js 中實作 API 失敗處理（重試 2 次，間隔 5 秒，失敗後保留原始內容標註「摘要生成失敗」）

#### 報告產生模組

- [ ] T029 [US1] 建立 src/generators/markdown-generator.js，實作 Markdown 報告產生（分層級結構）
- [ ] T030 [US1] 在 markdown-generator.js 中實作報告元資料區塊（日期、總項數、產生時間）
- [ ] T031 [US1] 在 markdown-generator.js 中實作各層級資訊區塊渲染（標題、摘要、來源、作者、時間、連結）
- [ ] T032 [US1] 在 markdown-generator.js 中實作報告統計區塊（總項數、各層級項數、來源數、去重移除數）
- [ ] T033 [US1] 在 markdown-generator.js 中實作執行日誌摘要區塊（來源狀態表格、成功率）

#### 日誌模組

- [ ] T034 [US1] 在 src/utils/logger.js 中實作 ExecutionLog 結構化日誌記錄（JSON 格式，包含 execution, sources, summarization, report 區塊）
- [ ] T035 [US1] 在 src/utils/logger.js 中實作敏感資訊遮蔽（API 金鑰前 4 碼+***+後 4 碼）
- [ ] T036 [US1] 在 src/utils/logger.js 中實作日誌檔案寫入（logs/YYYY-MM-DD-HH-MM.log）

#### 主流程整合

- [ ] T037 [US1] 建立 src/index.js 主程式，整合蒐集 → 摘要 → 報告產生流程
- [ ] T038 [US1] 在 src/index.js 中實作命令列參數解析（--run-now 手動觸發）
- [ ] T039 [US1] 在 src/index.js 中實作每日清理觸發（系統啟動時檢查日期變更）
- [ ] T040 [US1] 在 src/index.js 中實作執行摘要輸出（總來源數、成功來源、總執行時間、最終項數）

**Checkpoint**: ✅ User Story 1 完成 - 系統能自動蒐集並產生繁體中文摘要報告（MVP 可交付！）

---

## Phase 5: User Story 2 - 智能內容過濾與去重 (Priority: P2)

**目標**: 實作內容相關性過濾與去重邏輯，提升資訊精準度

**獨立測試**: 準備包含相關/無關內容與重複項目的測試資料，驗證系統能正確過濾並去重

### 實作任務（User Story 2）

#### 去重模組

- [ ] T041 [P] [US2] 建立 src/filters/deduplicator.js，實作標題去重（階段 1: 完全相同標題快速篩選）
- [ ] T042 [P] [US2] 在 deduplicator.js 中實作 Levenshtein 相似度計算（自行實作，約 50 行）
- [ ] T043 [P] [US2] 在 deduplicator.js 中實作 Cosine 相似度計算（自行實作，約 100 行）
- [ ] T044 [US2] 在 deduplicator.js 中實作混合相似度策略（Levenshtein 40% + Cosine 60%，門檻 80%）
- [ ] T045 [US2] 在 deduplicator.js 中實作 MD5 內容指紋（使用 Node.js 內建 crypto）
- [ ] T046 [US2] 在 deduplicator.js 中實作 SimHash 內容指紋（自行實作，約 100 行，Hamming 距離 ≤ 3）
- [ ] T047 [US2] 在 deduplicator.js 中實作版本選擇邏輯（評分: 字數 30 分 + 技術細節 40 分 + 來源層級 20 分 + 時間 10 分）
- [ ] T048 [US2] 在 deduplicator.js 中實作去重索引更新（寫入 data/dedup-index.json）

#### 過濾模組

- [ ] T049 [US2] 建立 src/filters/relevance-filter.js，實作 AI 相關性判斷（使用 Gemini API 語義判斷）
- [ ] T050 [US2] 在 relevance-filter.js 中實作相關主題清單（AI 模型、AI 工具、程式碼輔助、開發框架等）
- [ ] T051 [US2] 在 relevance-filter.js 中實作相關性計算（AI 相關段落占比 > 50% 視為相關）
- [ ] T052 [US2] 在 relevance-filter.js 中實作邊界案例處理（同時提到 AI 和其他主題的文章）

#### 流程整合

- [ ] T053 [US2] 在 src/index.js 中整合去重流程（蒐集後 → 去重 → 過濾 → 摘要）
- [ ] T054 [US2] 在 src/index.js 中整合過濾流程，記錄過濾移除數量到執行日誌
- [ ] T055 [US2] 在 src/generators/markdown-generator.js 中更新統計區塊，顯示去重移除數與過濾移除數

**Checkpoint**: ✅ User Story 2 完成 - 系統能精準過濾相關內容並去除重複

---

## Phase 6: User Story 3 - 多層級資訊來源整合 (Priority: P3)

**目標**: 實作三層級來源蒐集（官方部落格、工具 Release、社群與框架）

**獨立測試**: 配置三層級來源清單，驗證系統能成功從每個層級蒐集資訊

**注意**: 此階段主要是擴展來源配置，核心蒐集邏輯已在 US1 完成

### 實作任務（User Story 3）

- [ ] T056 [P] [US3] 在 config/sources.example.json 中新增層級 1 來源（OpenAI Blog, Anthropic News, DeepMind Blog, Meta AI, Mistral AI 的 RSS）
- [ ] T057 [P] [US3] 在 config/sources.example.json 中新增層級 2 來源（Cursor Blog, GitHub Changelog, Codeium Blog RSS + VS Code, Zed GitHub Releases）
- [ ] T058 [P] [US3] 在 config/sources.example.json 中新增層級 3 來源（Vercel AI, MCP Servers, LangChain.js, LlamaIndex.ts GitHub Releases + Hacker News AI, Reddit LocalLLaMA RSS）
- [ ] T059 [US3] 在 src/collectors/collector-orchestrator.js 中實作層級優先級處理（去重時優先保留高層級來源）
- [ ] T060 [US3] 在 src/utils/logger.js 中實作層級失敗率統計（記錄各層級成功/失敗來源數）
- [ ] T061 [US3] 在 src/generators/markdown-generator.js 中確保報告按層級分組顯示（層級 1 → 層級 2 → 層級 3）

**Checkpoint**: ✅ User Story 3 完成 - 系統能從三層級多樣化來源蒐集資訊

---

## Phase 7: User Story 4 - 報告推送與外部整合 (Priority: P4)

**目標**: 實作摘要報告推送至外部通訊頻道（電子郵件）

**獨立測試**: 設定測試用電子郵件地址，驗證系統能成功傳送摘要報告

**注意**: 此功能屬於增強功能，非 MVP 核心需求

### 實作任務（User Story 4）

- [ ] T062 [P] [US4] 建立 src/push/email-pusher.js，實作電子郵件推送（使用 nodemailer 或 SMTP）
- [ ] T063 [US4] 在 email-pusher.js 中實作 Markdown 轉 HTML（使用 marked 或類似套件）
- [ ] T064 [US4] 在 email-pusher.js 中實作郵件格式化（主旨包含日期，內容為 HTML 格式）
- [ ] T065 [US4] 在 email-pusher.js 中實作推送失敗處理（記錄錯誤，標記為「待重試」）
- [ ] T066 [US4] 在 email-pusher.js 中實作重試策略（下次排程執行時重試一次，失敗後標記為「已放棄」）
- [ ] T067 [US4] 在 src/index.js 中整合推送流程（報告產生後 → 推送 → 記錄推送狀態到執行日誌）
- [ ] T068 [US4] 在 .env.example 中新增電子郵件推送環境變數（EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, EMAIL_TO）

**Checkpoint**: ✅ User Story 4 完成 - 系統能自動推送摘要報告至電子郵件

---

## Phase 8: Polish & Cross-Cutting Concerns（優化與跨功能改進）

**目的**: 影響多個 User Story 的改進

- [ ] T069 [P] 在 quickstart.md 中更新實際安裝步驟與命令（基於實作結果）
- [ ] T070 [P] 在 README.md 中新增系統架構圖與主要功能說明
- [ ] T071 [P] 在根目錄建立 CONTRIBUTING.md，說明如何貢獻（程式碼風格、提交訊息格式）
- [ ] T072 效能優化：檢查 Gemini API 批次處理是否有效減少調用次數（目標 80% 減少）
- [ ] T073 安全強化：驗證所有環境變數是否正確遮蔽於日誌中（執行 `grep -r "ghp_" logs/` 應無結果）
- [ ] T074 執行 quickstart.md 中的驗證步驟，確保所有指令正確無誤
- [ ] T075 [P] 建立 .github/workflows/daily-digest.yml GitHub Actions 配置（定時排程 cron: '15 18 * * *'）
- [ ] T076 程式碼清理：移除 console.log 除錯訊息，統一使用 logger.js

---

## 相依性與執行順序

### Phase 相依性

```
Phase 1: Setup
  ↓
Phase 2: Foundational (阻塞所有 User Stories)
  ↓
Phase 3: User Story 5 (P2) - 配置化管理
  ↓
Phase 4: User Story 1 (P1) - 蒐集與摘要 🎯 MVP
  ↓
Phase 5: User Story 2 (P2) - 過濾與去重
  ↓
Phase 6: User Story 3 (P3) - 多層級來源
  ↓
Phase 7: User Story 4 (P4) - 推送整合
  ↓
Phase 8: Polish & Cross-Cutting Concerns
```

### User Story 相依性

- **US5 (P2) - 配置化管理**: 必須優先於 US1 和 US3（提供來源配置機制）
- **US1 (P1) - 蒐集與摘要**: 核心功能，依賴 US5 完成
- **US2 (P2) - 過濾與去重**: 依賴 US1 完成（需要蒐集到的資料）
- **US3 (P3) - 多層級來源**: 依賴 US1 完成（擴展來源配置）
- **US4 (P4) - 推送整合**: 依賴 US1 完成（需要產生的報告）

### 建議執行順序

**MVP 範圍（最小可行產品）**:
1. Phase 1: Setup → Phase 2: Foundational
2. Phase 3: US5（配置化管理）
3. Phase 4: US1（蒐集與摘要）
4. **🎯 MVP 交付點** - 可產生基本摘要報告

**增量交付順序**:
1. Phase 5: US2（過濾與去重）→ 提升資訊品質
2. Phase 6: US3（多層級來源）→ 擴展資訊來源
3. Phase 7: US4（推送整合）→ 增強便利性
4. Phase 8: Polish → 最終優化

### 平行執行機會

**Setup 階段**（Phase 1）:
```bash
# 可同時執行:
Task T002, T003, T004, T005, T006
```

**Foundational 階段**（Phase 2）:
```bash
# 可同時執行:
Task T008, T009, T010, T011, T012
```

**User Story 1 - 蒐集模組**（Phase 4）:
```bash
# 可同時執行:
Task T020 (RSS collector), T021 (GitHub collector)
```

**User Story 2 - 去重演算法**（Phase 5）:
```bash
# 可同時執行:
Task T042 (Levenshtein), T043 (Cosine), T045 (MD5), T046 (SimHash)
```

**User Story 3 - 來源配置**（Phase 6）:
```bash
# 可同時執行:
Task T056 (層級 1), T057 (層級 2), T058 (層級 3)
```

---

## 實作策略

### 策略 1: MVP 優先（建議）

**目標**: 最快交付可用系統

```
1. 完成 Phase 1 + 2 (Setup + Foundational)
2. 完成 Phase 3 (US5 - 配置化)
3. 完成 Phase 4 (US1 - 蒐集與摘要)
4. ✅ MVP 交付 - 暫停驗證
5. 執行 npm start -- --run-now 測試
6. 檢查 output/digests/*.md 報告品質
7. 若滿意，部署並開始每日使用
8. 後續增量加入 US2, US3, US4
```

**交付時間線**:
- Week 1: Phase 1-2 (Setup + Foundational)
- Week 2: Phase 3-4 (US5 + US1)
- **Week 2 末: MVP 可交付** 🎯

### 策略 2: 完整功能交付

**目標**: 完成所有 User Stories

```
1. 依序完成 Phase 1-7
2. 最後執行 Phase 8 (Polish)
3. 完整系統交付
```

**交付時間線**:
- Week 1-2: Phase 1-4 (MVP)
- Week 3: Phase 5-6 (US2, US3)
- Week 4: Phase 7-8 (US4, Polish)
- **Week 4 末: 完整系統交付**

### 策略 3: 平行團隊開發

**前提**: 多位開發者同時工作

```
團隊完成 Phase 1-2 後:
- Developer A: Phase 4 (US1 - 蒐集與摘要)
- Developer B: Phase 5 (US2 - 過濾與去重)
- Developer C: Phase 6 (US3 - 多層級來源)

完成後整合測試，最後加入 US4 和 Polish
```

---

## 驗證檢查清單

### MVP 驗證（Phase 4 完成後）

- [ ] 執行 `npm start -- --run-now` 無錯誤
- [ ] `output/digests/YYYY-MM-DD-digest.md` 檔案已產生
- [ ] 報告包含至少 5 則資訊
- [ ] 報告包含繁體中文摘要（3-5 點）
- [ ] 報告包含三層級結構區塊
- [ ] 執行日誌 `logs/YYYY-MM-DD-HH-MM.log` 已產生
- [ ] 日誌中敏感資訊已遮蔽（無完整 API 金鑰）
- [ ] `data/items.json` 包含蒐集的資訊項目
- [ ] 執行時間 < 5 分鐘（SC-001）

### 完整系統驗證（Phase 8 完成後）

- [ ] 去重功能正常（重複內容僅保留一份）
- [ ] 過濾功能正常（無關資訊已移除）
- [ ] 三層級來源均成功蒐集
- [ ] 推送功能正常（電子郵件成功接收）
- [ ] GitHub Actions 定時排程運作正常
- [ ] 所有成功標準達成（SC-001 ~ SC-008）
- [ ] quickstart.md 中的指令可正常執行
- [ ] 程式碼無除錯訊息殘留

---

## 任務統計

### 總覽

- **總任務數**: 79 個
- **Setup 階段**: 6 個任務（T001-T006）
- **Foundational 階段**: 10 個任務（T007-T013c）
- **User Story 5**: 6 個任務（T014-T019）
- **User Story 1**: 21 個任務（T020-T040）🎯 MVP 核心
- **User Story 2**: 15 個任務（T041-T055）
- **User Story 3**: 6 個任務（T056-T061）
- **User Story 4**: 7 個任務（T062-T068）
- **Polish 階段**: 8 個任務（T069-T076）

### 平行執行機會

- **Setup 階段**: 5 個可平行任務（T002-T006）
- **Foundational 階段**: 6 個可平行任務（T008-T012, T013a）
- **User Story 1**: 2 個可平行任務（T020-T021）
- **User Story 2**: 4 個可平行任務（T042-T046）
- **User Story 3**: 3 個可平行任務（T056-T058）
- **User Story 4**: 1 個可平行任務（T062）
- **Polish 階段**: 4 個可平行任務（T069-T071, T075）

**總平行機會**: 25 個任務可平行執行

### MVP 範圍任務數

- **MVP 任務數**: 43 個任務（Phase 1-4）
- **增強功能任務數**: 36 個任務（Phase 5-8）

---

## 附註

- **[P] 標記**: 不同檔案、無相依性，可平行執行
- **[Story] 標記**: 追溯任務所屬 User Story
- **檔案路徑**: 所有任務包含明確檔案路徑
- **Checkpoint**: 每個 Phase 結束設有檢查點，可驗證功能獨立性
- **避免事項**: 模糊任務描述、同檔案衝突、破壞獨立性的跨 Story 相依

**建議提交策略**:
- 每完成一個任務或邏輯群組即提交
- 每個 Phase 完成後建立 Checkpoint 提交
- MVP 完成後建立 Tag（如 `v0.1.0-mvp`）

---

**Generated Date**: 2026-01-06 (Updated after spec analysis)
**Total Tasks**: 79
**MVP Tasks**: 43 (Phase 1-4)
**Parallel Opportunities**: 25 tasks
**Suggested MVP Scope**: Phase 1-4 (US5 + US1)
