/**
 * Email Pusher - 電子郵件推送模組
 * 負責將摘要報告透過 SMTP 傳送至指定信箱
 */

import nodemailer from "nodemailer";
import { marked } from "marked";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 電子郵件推送器類別
 */
export class EmailPusher {
  constructor(config) {
    this.config = {
      host: config.host || process.env.EMAIL_SMTP_HOST,
      port: config.port || process.env.EMAIL_SMTP_PORT || 587,
      secure: config.secure !== undefined ? config.secure : false,
      auth: {
        user: config.user || process.env.EMAIL_SMTP_USER,
        pass: config.password || process.env.EMAIL_SMTP_PASSWORD,
      },
      from:
        config.from || process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER,
      to: config.to || process.env.EMAIL_TO,
    };

    // 驗證必要配置
    this.validateConfig();
  }

  /**
   * 驗證配置
   */
  validateConfig() {
    const required = ["host", "auth.user", "auth.pass", "to"];
    const missing = [];

    if (!this.config.host) missing.push("EMAIL_SMTP_HOST");
    if (!this.config.auth.user) missing.push("EMAIL_SMTP_USER");
    if (!this.config.auth.pass) missing.push("EMAIL_SMTP_PASSWORD");
    if (!this.config.to) missing.push("EMAIL_TO");

    if (missing.length > 0) {
      throw new Error(
        `Email pusher 配置缺少必要欄位: ${missing.join(
          ", "
        )}. 請設定對應的環境變數。`
      );
    }
  }

  /**
   * 建立 SMTP 傳輸器
   */
  createTransporter() {
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });
  }

  /**
   * 將 Markdown 轉換為 HTML
   * @param {string} markdownContent - Markdown 內容
   * @returns {string} HTML 內容
   */
  async convertMarkdownToHtml(markdownContent) {
    try {
      // 設定 marked 選項
      marked.setOptions({
        breaks: true,
        gfm: true,
      });

      const htmlContent = marked.parse(markdownContent);

      // 包裝完整 HTML 結構，加入樣式
      const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 資訊摘要報告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f6f8fa;
    }
    h1 {
      color: #0366d6;
      border-bottom: 2px solid #0366d6;
      padding-bottom: 10px;
    }
    h2 {
      color: #24292e;
      margin-top: 24px;
      border-bottom: 1px solid #e1e4e8;
      padding-bottom: 8px;
    }
    h3 {
      color: #586069;
      margin-top: 16px;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    code {
      background-color: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 85%;
    }
    pre {
      background-color: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 16px;
      color: #6a737d;
      margin: 0;
    }
    ul, ol {
      padding-left: 2em;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    .content {
      background-color: white;
      padding: 24px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e1e4e8;
      color: #6a737d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="content">
    ${htmlContent}
  </div>
  <div class="footer">
    <p>本報告由 AI News Assistant 自動產生</p>
  </div>
</body>
</html>`;

      return fullHtml;
    } catch (error) {
      logger.error("Markdown 轉 HTML 失敗", { error: error.message });
      throw error;
    }
  }

  /**
   * 從檔案路徑讀取 Markdown 並轉換為 HTML
   * @param {string} filePath - Markdown 檔案路徑
   * @returns {Object} { html, markdown }
   */
  async loadAndConvertMarkdown(filePath) {
    try {
      const markdownContent = await fs.readFile(filePath, "utf-8");
      const htmlContent = await this.convertMarkdownToHtml(markdownContent);

      return {
        markdown: markdownContent,
        html: htmlContent,
      };
    } catch (error) {
      logger.error("讀取或轉換 Markdown 檔案失敗", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 傳送電子郵件
   * @param {Object} options - 郵件選項
   * @param {string} options.subject - 郵件主旨
   * @param {string} options.htmlContent - HTML 內容
   * @param {string} options.textContent - 純文字內容（選填）
   * @returns {Promise<Object>} 傳送結果
   */
  async sendEmail({ subject, htmlContent, textContent }) {
    const transporter = this.createTransporter();

    const mailOptions = {
      from: this.config.from,
      to: this.config.to,
      subject: subject,
      html: htmlContent,
      text: textContent || "請使用支援 HTML 的郵件客戶端檢視此郵件。",
    };

    try {
      logger.info("開始傳送郵件", {
        to: this.config.to,
        subject: subject,
      });

      const info = await transporter.sendMail(mailOptions);

      logger.info("郵件傳送成功", {
        messageId: info.messageId,
        response: info.response,
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      logger.error("郵件傳送失敗", {
        to: this.config.to,
        subject: subject,
        error: error.message,
        code: error.code,
      });

      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  /**
   * 推送摘要報告
   * @param {string} reportPath - 報告檔案路徑
   * @param {string} date - 報告日期（YYYY-MM-DD 格式）
   * @returns {Promise<Object>} 推送結果
   */
  async pushReport(reportPath, date) {
    try {
      // 讀取並轉換 Markdown
      const { html, markdown } = await this.loadAndConvertMarkdown(reportPath);

      // 產生郵件主旨
      const subject = `AI 資訊摘要報告 - ${date}`;

      // 傳送郵件
      const result = await this.sendEmail({
        subject,
        htmlContent: html,
        textContent: markdown,
      });

      return result;
    } catch (error) {
      logger.error("推送報告失敗", {
        reportPath,
        date,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 推送報告並處理重試邏輯
   * @param {string} reportPath - 報告檔案路徑
   * @param {string} date - 報告日期
   * @param {Object} retryState - 重試狀態（選填）
   * @returns {Promise<Object>} 推送結果與重試狀態
   */
  async pushWithRetry(reportPath, date, retryState = {}) {
    const maxRetries = 1; // 重試一次
    const currentAttempt = retryState.attempt || 0;

    const result = await this.pushReport(reportPath, date);

    if (result.success) {
      return {
        ...result,
        status: "delivered",
        attempts: currentAttempt + 1,
      };
    }

    // 失敗處理
    if (currentAttempt < maxRetries) {
      logger.warn("郵件傳送失敗，標記為待重試", {
        date,
        attempt: currentAttempt + 1,
        maxRetries: maxRetries + 1,
      });

      return {
        ...result,
        status: "pending_retry",
        attempts: currentAttempt + 1,
        nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 下次排程執行時重試
      };
    } else {
      logger.error("郵件傳送失敗次數超過上限，標記為已放棄", {
        date,
        attempts: currentAttempt + 1,
      });

      return {
        ...result,
        status: "abandoned",
        attempts: currentAttempt + 1,
      };
    }
  }
}

/**
 * 建立電子郵件推送器實例
 * @param {Object} config - 配置選項
 * @returns {EmailPusher} 推送器實例
 */
export function createEmailPusher(config = {}) {
  return new EmailPusher(config);
}
