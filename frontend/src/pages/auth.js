/* ==========================================================================
   Auth Page - Login only
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { showToast } from '../components/toast.js';
import { icon } from '../utils/icons.js';

function defaultRouteForRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'chef') return '#/kitchen';
  if (normalized === 'staff') return '#/backend/pos-settings';
  return '#/backend/products';
}

export function renderAuth() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card glass">
        <div class="auth-logo">
          <div class="auth-logo-icon">${icon('brand', '', 'Odoo POS Cafe')}</div>
          <h1>Odoo POS Cafe</h1>
          <p>Restaurant Point of Sale System</p>
        </div>

        <form class="auth-form" id="auth-form" novalidate>
          <div class="form-group">
            <label class="form-label">Username <span class="required">*</span></label>
            <input type="text" class="form-input" id="auth-username"
              placeholder="Enter username" autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label">Password <span class="required">*</span></label>
            <div class="password-wrapper">
              <input type="password" class="form-input" id="auth-password"
                placeholder="Enter password"
                autocomplete="current-password" />
              <button type="button" class="toggle-pw-btn" id="toggle-pw" title="Show/hide password">${icon('eye')}<span>Show</span></button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block auth-submit">
            Login
          </button>
        </form>

        <div class="auth-footer">
          Accounts are created by the admin only.
        </div>
      </div>
    </div>
  `;

  document.getElementById('toggle-pw')?.addEventListener('click', () => {
    const input = document.getElementById('auth-password');
    input.type = input.type === 'password' ? 'text' : 'password';
    document.getElementById('toggle-pw').innerHTML = `${icon(input.type === 'password' ? 'eye' : 'eyeOff')}<span>${input.type === 'password' ? 'Show' : 'Hide'}</span>`;
  });

  app.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    let valid = true;
    if (!username) {
      showFieldError('auth-username', 'Username is required');
      valid = false;
    }
    if (!password) {
      showFieldError('auth-password', 'Password is required');
      valid = false;
    }
    if (!valid) return;

    try {
      const user = await store.login(username, password);
      showToast(`Welcome back, ${user.fullName}!`, 'success');
      router.navigate(defaultRouteForRole(user.role));
    } catch (error) {
      showFieldError('auth-username', 'Invalid username or password');
      showToast(error.message || 'Invalid username or password', 'error');
    }
  });
}

function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  input.classList.add('input-error');
  const existing = input.parentElement.querySelector('.error-msg')
    || input.closest('.form-group')?.querySelector('.error-msg');
  if (!existing) {
    const err = document.createElement('span');
    err.className = 'error-msg';
    err.textContent = message;
    (input.closest('.password-wrapper') || input).insertAdjacentElement('afterend', err);
  }
}

function clearErrors() {
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-msg').forEach(el => el.remove());
}
