/* ==========================================================================
   Toast - Notification component
   ========================================================================== */

import { icon } from '../utils/icons.js';

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: icon('success', '', 'Success'),
    error: icon('error', '', 'Error'),
    info: icon('info', '', 'Information'),
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon-wrap">${icons[type] || icons.info}</span> ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeIn 300ms reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
