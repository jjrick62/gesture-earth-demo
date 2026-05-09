// ===== 公共工具函数 =====

/** 生成星星 HTML 字符串：★ 实心 + ☆ 空心 */
export function renderStars(rating, maxStars = 5) {
  const r = Math.max(0, Math.min(maxStars, rating || 3));
  return '★'.repeat(r) + '☆'.repeat(maxStars - r);
}
