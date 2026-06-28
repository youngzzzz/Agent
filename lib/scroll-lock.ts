/**
 * 引用计数的页面滚动锁。
 * 支持多个抽屉同时叠加：仅当第一个锁定时记录原值并禁用滚动，
 * 最后一个解锁时才还原，避免叠加/同时关闭时互相覆盖导致背景被永久锁死。
 */
let lockCount = 0;
let prevBody = "";
let prevHtml = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    const docEl = document.documentElement;
    prevBody = document.body.style.overflow;
    prevHtml = docEl.style.overflow;
    document.body.style.overflow = "hidden";
    docEl.style.overflow = "hidden";
  }
  lockCount++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    }
  };
}
