/**
 * News Item 資料模型與驗證規則
 *
 * 代表單一則 AI 或 AI Coding 相關資訊
 */

/**
 * 驗證 News Item 資料結構
 * @param {Object} item - 待驗證的資料項目
 * @returns {{ valid: boolean, errors: string[] }} 驗證結果
 */
export const validateNewsItem = (item) => {
  const errors = [];

  // 必填欄位檢查
  if (!item.id || typeof item.id !== 'string') {
    errors.push('id 欄位必填且必須為字串');
  } else if (!/^item_\d{8}_\d{3}$/.test(item.id)) {
    errors.push('id 格式必須為 item_YYYYMMDD_NNN');
  }

  if (!item.title || typeof item.title !== 'string') {
    errors.push('title 欄位必填且必須為字串');
  } else if (item.title.length === 0 || item.title.length > 500) {
    errors.push('title 長度必須在 1-500 字元之間');
  }

  // summary 驗證
  if (!Array.isArray(item.summary)) {
    errors.push('summary 必須為陣列');
  } else if (item.summary.length < 3 || item.summary.length > 5) {
    errors.push('summary 陣列長度必須為 3-5');
  }

  // source 驗證
  if (!item.source || typeof item.source !== 'object') {
    errors.push('source 欄位必填且必須為物件');
  } else {
    if (!item.source.name || typeof item.source.name !== 'string') {
      errors.push('source.name 欄位必填且必須為字串');
    }
    if (![1, 2, 3].includes(item.source.tier)) {
      errors.push('source.tier 必須為 1, 2 或 3');
    }
    if (!['rss', 'api', 'web'].includes(item.source.type)) {
      errors.push('source.type 必須為 rss, api 或 web');
    }
  }

  // 時間欄位驗證
  const timeFields = ['published_at', 'collected_at', 'retention_until'];
  timeFields.forEach(field => {
    if (!item[field] || typeof item[field] !== 'string') {
      errors.push(`${field} 欄位必填且必須為字串`);
    } else {
      const date = new Date(item[field]);
      if (isNaN(date.getTime())) {
        errors.push(`${field} 必須為有效的 ISO 8601 格式`);
      }
    }
  });

  // URL 驗證
  if (!item.original_url || typeof item.original_url !== 'string') {
    errors.push('original_url 欄位必填且必須為字串');
  } else {
    try {
      new URL(item.original_url);
    } catch {
      errors.push('original_url 必須為有效的 URL 格式');
    }
  }

  // relevance_score 驗證
  if (typeof item.relevance_score !== 'number') {
    errors.push('relevance_score 必須為數字');
  } else if (item.relevance_score < 0 || item.relevance_score > 1) {
    errors.push('relevance_score 必須在 [0, 1] 範圍內');
  }

  // 選填欄位驗證
  if (item.content !== undefined && typeof item.content !== 'string') {
    errors.push('content 必須為字串（若提供）');
  }

  if (item.content_length !== undefined && typeof item.content_length !== 'number') {
    errors.push('content_length 必須為數字（若提供）');
  }

  if (item.language !== undefined && typeof item.language !== 'string') {
    errors.push('language 必須為字串（若提供）');
  }

  if (item.author !== undefined && typeof item.author !== 'string') {
    errors.push('author 必須為字串（若提供）');
  }

  if (item.votes_or_score !== undefined && item.votes_or_score !== null && typeof item.votes_or_score !== 'number') {
    errors.push('votes_or_score 必須為數字或 null（若提供）');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 產生 News Item ID
 * 格式: item_YYYYMMDD_NNN
 * @returns {string} ID
 */
export const generateNewsItemId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return `item_${year}${month}${day}_${random}`;
};

/**
 * 建立新的 News Item
 * @param {Object} data - 資料內容
 * @returns {Object} 標準化的 News Item 物件
 */
export const createNewsItem = (data) => {
  const now = new Date().toISOString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // 產生 ID（若未提供）
  const id = data.id || generateNewsItemId();

  return {
    // 識別欄位
    id,

    // 內容欄位
    title: data.title,
    summary: data.summary || [],
    content: data.content,
    content_length: data.content_length || (data.content ? data.content.length : 0),
    language: data.language || 'en',

    // 來源欄位
    source: {
      name: data.source.name,
      tier: data.source.tier,
      type: data.source.type
    },
    author: data.author,

    // 時間欄位
    published_at: data.published_at,
    collected_at: data.collected_at || now,
    retention_until: data.retention_until || tomorrow.toISOString(),

    // 元資料欄位
    original_url: data.original_url,
    relevance_score: data.relevance_score || 0,
    votes_or_score: data.votes_or_score
  };
};

/**
 * 檢查 News Item 是否過期
 * @param {Object} item - News Item 物件
 * @returns {boolean} 是否過期
 */
export const isExpired = (item) => {
  if (!item.retention_until) return false;

  const retentionDate = new Date(item.retention_until);
  const now = new Date();

  return retentionDate <= now;
};
