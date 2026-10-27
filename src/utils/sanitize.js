// XSS Prevention & Sanitization Utility
// All user-supplied strings MUST be escaped before rendering in the DOM.

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tagged template literal for safe HTML interpolation.
 * Automatically escapes any interpolated variable unless explicitly marked safe.
 */
export function safeHTML(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const val = values[i];
      if (val && typeof val === 'object' && val.__isSafeHTML) {
        result += val.content;
      } else if (Array.isArray(val)) {
        result += val.map(item => (item && item.__isSafeHTML ? item.content : escapeHTML(item))).join('');
      } else {
        result += escapeHTML(val);
      }
    }
  }
  return result;
}

export function markSafe(htmlString) {
  return {
    __isSafeHTML: true,
    content: htmlString
  };
}
