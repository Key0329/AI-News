# 配置檔案使用指南

## 概述

此目錄包含兩個範例配置檔案，展示如何配置 AI News Assistant 的資訊來源：

- `sources.example.yaml` - YAML 格式（推薦，更易讀）
- `sources.example.json` - JSON 格式（適合程式處理）

## 快速開始

### 1. 複製範例配置檔案

選擇您偏好的格式：

```bash
# 使用 YAML（推薦）
cp sources.example.yaml sources.yaml

# 或使用 JSON
cp sources.example.json sources.json
```

### 2. 設定環境變數

某些來源需要 API 金鑰，請在您的 shell 設定檔（如 `.bashrc`, `.zshrc`）或環境變數檔案（如 `.env`）中設定：

```bash
# GitHub Personal Access Token
# 用於追蹤 GitHub Repository Release
# 取得方式: https://github.com/settings/tokens
export GITHUB_TOKEN="ghp_your_token_here"

# OpenAI API Key（用於摘要生成）
export OPENAI_API_KEY="sk-your_key_here"

# 或 Anthropic API Key
export ANTHROPIC_API_KEY="sk-ant-your_key_here"
```

### 3. 自訂來源

編輯 `sources.yaml` 或 `sources.json`：

#### 啟用/停用來源

```yaml
- name: "TLDR AI"
  type: "web"
  enabled: false  # 改為 true 以啟用
```

#### 新增自訂來源

```yaml
- name: "Your Custom Blog"
  type: "rss"
  tier: 3
  url: "https://yourblog.com/feed.xml"
  enabled: true
  description: "自訂部落格描述"
  env_var: null
```

## 配置結構說明

### 全域配置

```yaml
config:
  version: "1.0.0"           # 配置版本
  default_language: "en"      # 預設語言
  default_timezone: "Asia/Taipei"  # 時區
  max_items_per_source: 20   # 每個來源最多抓取數量
```

### 關鍵字配置

用於需要關鍵字查詢的 API（未來擴展）：

```yaml
keywords:
  - "AI coding"
  - "large language model"
  - "GPT"
  - "Claude"
```

### 來源配置

每個來源包含以下欄位：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `name` | ✅ | 來源名稱（唯一識別） |
| `type` | ✅ | 來源類型：`rss`, `github`, `web` |
| `tier` | ✅ | 來源層級：1, 2, 3 |
| `url` / `repo` | ✅ | RSS URL 或 GitHub Repo（格式：`owner/repo`） |
| `enabled` | ✅ | 是否啟用：`true` / `false` |
| `description` | 建議 | 來源描述 |
| `env_var` | 選填 | 環境變數名稱（用於 API 金鑰） |
| `fetch_type` | GitHub 專用 | `releases`, `commits`, `issues` |

## 來源類型

### RSS Feed

```yaml
- name: "OpenAI Blog"
  type: "rss"
  tier: 1
  url: "https://openai.com/news/rss.xml"
  enabled: true
  env_var: null  # RSS 不需要 API 金鑰
```

### GitHub Repository

```yaml
- name: "VS Code Release"
  type: "github"
  tier: 2
  repo: "microsoft/vscode"  # 格式：owner/repo
  enabled: true
  env_var: "GITHUB_TOKEN"   # 需要 GitHub Token
  fetch_type: "releases"    # 追蹤 Release Notes
```

### Web Scraping（未來擴展）

```yaml
- name: "TLDR AI"
  type: "web"
  tier: 3
  url: "https://tldr.tech/ai"
  enabled: false  # MVP 階段建議先停用
```

## 三層級來源架構

範例配置檔案已包含完整的三層級來源：

### 層級 1：核心模型與 AI 實驗室（5 個 RSS）
- OpenAI Blog
- Anthropic News
- Google DeepMind
- Meta AI
- Mistral AI

### 層級 2：AI Coding 編輯器與工具（3 個 RSS + 2 個 GitHub）
- Cursor Blog (RSS)
- GitHub Changelog (RSS)
- Codeium Blog (RSS)
- VS Code Release (GitHub)
- Zed Editor (GitHub)

### 層級 3：開發框架、SDK 與社群（4 個 GitHub + 2 個 RSS + 2 個 Web）
- Vercel AI SDK (GitHub)
- MCP Servers (GitHub)
- LangChain.js (GitHub)
- LlamaIndex.ts (GitHub)
- Hacker News AI (RSS)
- Reddit LocalLLaMA (RSS)
- TLDR AI (Web - 建議先停用)
- Ben's Bites (Web - 建議先停用)

## 去重策略

當同一則新聞出現在多個來源時，系統會：

1. **優先保留官方來源**：層級 1（官方部落格）> 層級 2 > 層級 3
2. **優先保留含有 GitHub 連結的版本**
3. **優先保留內容最完整的版本**（字數、技術細節）

## 最佳實踐

### 1. MVP 階段建議配置

初期建議先啟用：
- ✅ 所有層級 1 的 RSS（5 個官方部落格）
- ✅ 層級 2 的 RSS（3 個編輯器部落格）
- ✅ 層級 2 的 GitHub（2 個工具 Release）
- ✅ 層級 3 的重點 GitHub（至少 Vercel AI SDK、MCP Servers）
- ✅ 層級 3 的社群 RSS（Hacker News AI、Reddit LocalLLaMA）

暫時停用：
- ❌ Web 類型來源（TLDR AI、Ben's Bites）- 等 MVP 完成後再擴展

### 2. GitHub Token 配置

- 使用 Personal Access Token（不需要任何特殊權限）
- Token 主要用於提高 GitHub API 速率限制（未認證：60 次/小時 → 認證：5000 次/小時）
- 取得方式：https://github.com/settings/tokens → Generate new token (classic) → 不勾選任何 scope

### 3. 配置檔案管理

```bash
# ✅ 正確做法：配置檔案加入 .gitignore
echo "sources.yaml" >> .gitignore
echo "sources.json" >> .gitignore
echo ".env" >> .gitignore

# ✅ 提交範例配置到版本控制
git add sources.example.yaml sources.example.json

# ❌ 錯誤做法：不要提交包含實際 token 的配置
```

### 4. 驗證配置

系統啟動時會自動驗證配置檔案：
- 檢查 JSON/YAML 格式是否正確
- 檢查必要欄位是否完整
- 檢查環境變數是否已設定
- 列出所有啟用的來源及其狀態

## 故障排除

### Q: 系統提示「配置檔案不存在」

```bash
# 確認配置檔案位置（應在專案根目錄）
ls -la sources.yaml  # 或 sources.json

# 如果不存在，複製範例配置
cp specs/001-ai-news-assistant/sources.example.yaml sources.yaml
```

### Q: GitHub API 回傳 403 錯誤

```bash
# 檢查 GITHUB_TOKEN 是否已設定
echo $GITHUB_TOKEN

# 如果未設定，請設定環境變數
export GITHUB_TOKEN="ghp_your_token_here"
```

### Q: RSS Feed 解析失敗

檢查來源是否：
1. URL 正確且可存取
2. 使用標準的 RSS 2.0 或 Atom 格式
3. 伺服器未封鎖請求（User-Agent 問題）

### Q: 想要新增自訂來源但不知道格式

參考現有來源的配置，確保包含所有必要欄位：
- `name`（唯一識別名稱）
- `type`（rss / github / web）
- `tier`（1 / 2 / 3）
- `url` 或 `repo`
- `enabled`（true / false）

## 相關文件

- [Feature Specification (spec.md)](./spec.md) - 完整功能規格
- [Requirements Checklist](./checklists/requirements.md) - 需求檢查清單
- [Project Constitution](../../.specify/memory/constitution.md) - 專案開發規範

## 支援

如有問題或建議，請參考規格文件或開啟 Issue 討論。
