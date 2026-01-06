# AI & AI Coding 自動化情報助手

自動蒐集全球最新的 AI 與 AI Coding 相關資訊，並整理成繁體中文摘要報告。

## 功能特色

- 🤖 **自動蒐集**: 從三層級來源（AI 實驗室、工具、社群）定時獲取資訊
- 🌏 **繁體中文摘要**: 使用 Google Gemini API 將英文內容翻譯並提煉摘要
- 🎯 **智能過濾**: AI 語義判斷相關性，自動去除重複內容
- 📊 **結構化報告**: Markdown 格式，分層級顯示，易於閱讀
- ⚙️ **配置化管理**: JSON 配置檔案，輕鬆新增/移除來源

## 快速開始

### 前置需求

- Node.js v22.x LTS
- Google Gemini API Key（[申請連結](https://ai.google.dev/)）
- GitHub Personal Access Token（[申請連結](https://github.com/settings/tokens)）

### 安裝

```bash
# 1. 複製專案
cd AI-News

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env
# 編輯 .env 填入 API 金鑰

# 4. 設定來源配置
cp config/sources.example.json config/sources.json
# 可自訂來源清單
```

### 執行

```bash
# 手動執行（測試用）
npm start -- --run-now

# 查看產生的摘要報告
cat output/digests/$(date +%Y-%m-%d)-digest.md
```

## 專案結構

```
AI-News/
├── src/
│   ├── collectors/      # 資料蒐集模組（RSS, GitHub API）
│   ├── filters/         # 內容過濾與去重
│   ├── summarizers/     # AI 摘要生成
│   ├── generators/      # 報告產生器
│   ├── utils/           # 工具函式
│   ├── models/          # 資料結構定義
│   └── index.js         # 主程式進入點
├── config/
│   └── sources.json     # 資訊來源配置
├── output/digests/      # 產生的摘要報告
├── logs/                # 執行日誌
└── tests/               # 測試
```

## 配置

### 來源配置（config/sources.json）

```json
{
  "version": "1.0.0",
  "sources": [
    {
      "name": "Anthropic News",
      "tier": 1,
      "type": "rss",
      "url": "https://www.anthropic.com/news/rss.xml",
      "enabled": true,
      "max_items": 20
    }
  ]
}
```

詳細配置說明請參考 [specs/001-ai-news-assistant/quickstart.md](specs/001-ai-news-assistant/quickstart.md)

## 文檔

- [功能規格](specs/001-ai-news-assistant/spec.md)
- [實作計劃](specs/001-ai-news-assistant/plan.md)
- [資料模型](specs/001-ai-news-assistant/data-model.md)
- [快速開始指南](specs/001-ai-news-assistant/quickstart.md)

## 技術架構

- **語言**: Node.js (ES Modules)
- **RSS 解析**: rss-parser
- **AI 摘要**: @google/generative-ai (Gemini 3.0 Flash)
- **GitHub API**: @octokit/rest
- **測試**: Vitest

## 授權

MIT License

## 貢獻

歡迎提交 Issue 或 Pull Request！
