/* ==========================================================================
   Toast — Notification component
   ========================================================================== */

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span style="font-size:1.1em">${icons[type] || icons.info}</span> ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeIn 300ms reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
