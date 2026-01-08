# Gemini API 更新摘要

**更新日期**: 2026-01-06
**變更內容**: 將 AI 模型從 OpenAI/Anthropic 改為 Google Gemini 3.0 Flash Preview

---

## 更新項目

### 1. Clarifications (澄清記錄)
**位置**: Session 2026-01-05

**變更前**:
> 使用付費 AI API（如 OpenAI、Anthropic）進行摘要和翻譯

**變更後**:
> 使用 Google Gemini API（Gemini 3.0 Flash Preview）進行摘要和翻譯

---

### 2. FR-003 (內容相關性判斷)
**位置**: Functional Requirements

**變更前**:
> 透過 AI API 進行語義判斷

**變更後**:
> 透過 Google Gemini API 進行語義判斷，檢查內容是否包含 AI 模型（如 GPT、Claude、Llama、**Gemini**）...

**說明**: 明確指定使用 Gemini API，並在 AI 模型範例中加入 Gemini

---

### 3. FR-005 (摘要生成與翻譯)
**位置**: Functional Requirements

**變更前**:
> 系統必須能透過外部 AI API（如 OpenAI 或 Anthropic）從英文內容中提煉 3-5 點核心摘要...

**變更後**:
> 系統必須能透過 Google Gemini API（使用 **Gemini 3.0 Flash Preview** 模型）從英文內容中提煉 3-5 點核心摘要...

**說明**: 明確指定模型版本為 Gemini 3.0 Flash Preview

---

### 4. FR-028 (環境變數驗證)
**位置**: Functional Requirements

**變更前**:
> (1) AI API 金鑰（如 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`）

**變更後**:
> (1) Gemini API 金鑰（`GEMINI_API_KEY`）

**說明**: 環境變數名稱改為 `GEMINI_API_KEY`

---

### 5. Assumption #9 (使用成本)
**位置**: Assumptions

**變更前**:
> 使用者願意承擔外部 AI API（OpenAI 或 Anthropic）的持續使用成本

**變更後**:
> 使用者願意承擔 Google Gemini API 的持續使用成本（**Gemini 3.0 Flash Preview 提供免費配額，超出後按量計費**）

**說明**: 明確說明 Gemini 3.0 Flash Preview 的計費模式

---

### 6. Assumption #10 (API 可用性與配額)
**位置**: Assumptions

**變更前**:
> 外部 AI API 服務穩定可用，具備足夠的速率限制配額以處理每日摘要生成需求（假設可用性 SLA 達 99.9%，每日 API 配額足以處理至少 100 則資訊的摘要生成）

**變更後**:
> Google Gemini API 服務穩定可用，具備足夠的速率限制配額以處理每日摘要生成需求（假設可用性 SLA 達 99.9%，**Gemini 3.0 Flash Preview 免費配額為每分鐘 15 次請求**，足以處理至少 100 則資訊的摘要生成）

**說明**: 明確說明 Gemini 3.0 Flash Preview 的速率限制

---

### 7. Filter Rule 實體 (過濾規則)
**位置**: Key Entities

**變更前**:
> 相關性判斷方法（AI API 語義判斷）...透過 AI API 分析內容中 AI 相關主題的段落占比...

**變更後**:
> 相關性判斷方法（**Google Gemini API** 語義判斷）...透過 **Gemini API** 分析內容中 AI 相關主題的段落占比...

**說明**: 明確指定使用 Gemini API 進行語義分析

---

## Gemini 3.0 Flash Preview 特性

### 優勢
1. **免費配額**: 提供慷慨的免費配額，降低初期成本
2. **速度快**: Flash 系列針對快速回應優化，適合批次處理
3. **多語言支援**: 對繁體中文翻譯品質優異
4. **最新模型**: 3.0 版本提供最新的語義理解能力

### 速率限制
- **免費配額**: 每分鐘 15 次請求（RPM）
- **處理能力**: 假設每則資訊摘要需要 1 次 API 調用，每分鐘可處理 15 則資訊
- **每日容量**: 在免費配額下，每日可處理約 21,600 則資訊（遠超過實際需求的 100 則）

### 環境變數配置
需要在系統中設定以下環境變數：
```bash
export GEMINI_API_KEY="your-api-key-here"
```

### API 金鑰取得方式
1. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 使用 Google 帳號登入
3. 點選「Get API Key」
4. 創建或選擇專案
5. 複製 API 金鑰並設定為環境變數

---

## 未變更項目

以下項目**不需要變更**，因為它們是資訊來源而非使用的 AI 模型：

- **FR-002**: 層級 1 來源清單（OpenAI Blog、Anthropic News 等仍保留，這些是新聞來源）
- **User Story 3**: 資訊來源描述（保留 OpenAI、Anthropic 作為資訊來源）
- **Assumption #15**: 官方技術部落格清單（保留，這些是 RSS 來源）

---

## 影響評估

### 功能影響
- ✅ **無功能變更**: 所有功能需求保持不變
- ✅ **API 相容性**: Gemini API 提供類似的文字生成和翻譯能力
- ✅ **成本優勢**: 免費配額降低初期成本

### 實作影響
- 🔧 需要整合 Google Gemini API SDK
- 🔧 需要調整 API 調用邏輯以符合 Gemini API 格式
- 🔧 需要測試繁體中文翻譯品質

### 測試影響
- 🧪 需要驗證 Gemini API 的摘要品質
- 🧪 需要驗證繁體中文翻譯準確度
- 🧪 需要測試速率限制處理

---

**更新狀態**: ✅ 已完成
**影響範圍**: 7 個更新項目
**後續步驟**: 可進入 `/plan` 階段進行技術架構設計
