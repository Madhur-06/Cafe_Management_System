/* ==========================================================================
   Modal - Reusable modal dialog component
   ========================================================================== */

import { icon } from '../utils/icons.js';

export function openModal({ title, content, actions = [], onClose, wide = false }) {
  closeModal(); // close any existing

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal';

  const modal = document.createElement('div');
  modal.className = 'modal-content';
  if (wide) modal.style.maxWidth = '720px';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h3 class="modal-title">${title}</h3>
    <button class="modal-close" id="modal-close-btn" aria-label="Close dialog">${icon('close', '', 'Close dialog')}</button>
  `;

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  if (actions.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    actions.forEach(({ label, className = 'btn-ghost', onClick }) => {
      const btn = document.createElement('button');
      btn.className = `btn ${className}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (onClick) onClick();
      });
      actionsDiv.appendChild(btn);
    });
    modal.appendChild(actionsDiv);
  }

  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);

  // Close handlers
  backdrop.querySelector('#modal-close-btn').addEventListener('click', () => {
    closeModal();
    if (onClose) onClose();
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
      if (onClose) onClose();
    }
  });

  return backdrop;
}

export function closeModal() {
  const existing = document.getElementById('active-modal');
  if (existing) {
    existing.style.animation = 'fadeIn 200ms reverse forwards';
    setTimeout(() => existing.remove(), 200);
  }
}
