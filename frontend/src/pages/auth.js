/* ==========================================================================
   Auth Page — Login / Signup with validation
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { showToast } from '../components/toast.js';

export function renderAuth() {
  const app = document.getElementById('app');
  let mode = 'login';

  function render() {
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-card glass">
          <div class="auth-logo">
            <div class="auth-logo-icon">☕</div>
            <h1>Odoo POS Cafe</h1>
            <p>Restaurant Point of Sale System</p>
          </div>

          <div class="auth-tabs">
            <div class="auth-tab ${mode === 'login' ? 'active' : ''}" data-tab="login">Login</div>
            <div class="auth-tab ${mode === 'signup' ? 'active' : ''}" data-tab="signup">Sign Up</div>
          </div>

          <form class="auth-form" id="auth-form" novalidate>
            ${mode === 'signup' ? `
              <div class="form-group">
                <label class="form-label">Full Name <span class="required">*</span></label>
                <input type="text" class="form-input" id="auth-name"
                  placeholder="Enter your full name" minlength="2" maxlength="60" autocomplete="name" />
                <span class="field-hint">At least 2 characters</span>
              </div>
              <div class="form-group">
                <label class="form-label">Email <span class="required">*</span></label>
                <input type="email" class="form-input" id="auth-email"
                  placeholder="you@example.com" autocomplete="email" />
                <span class="field-hint">Must be a valid email address</span>
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Username <span class="required">*</span></label>
              <input type="text" class="form-input" id="auth-username"
                placeholder="Enter username" minlength="3" maxlength="30"
                autocomplete="${mode === 'login' ? 'username' : 'new-username'}" />
              ${mode === 'signup' ? '<span class="field-hint">3–30 characters, letters/numbers/underscore only</span>' : ''}
            </div>
            <div class="form-group">
              <label class="form-label">Password <span class="required">*</span></label>
              <div class="password-wrapper">
                <input type="password" class="form-input" id="auth-password"
                  placeholder="${mode === 'signup' ? 'Min 6 characters' : 'Enter password'}"
                  minlength="${mode === 'signup' ? 6 : 1}"
                  autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" />
                <button type="button" class="toggle-pw-btn" id="toggle-pw" title="Show/hide password">👁</button>
              </div>
              ${mode === 'signup' ? '<span class="field-hint">At least 6 characters</span>' : ''}
            </div>
            ${mode === 'signup' ? `
              <div class="form-group">
                <label class="form-label">Confirm Password <span class="required">*</span></label>
                <div class="password-wrapper">
                  <input type="password" class="form-input" id="auth-confirm-password"
                    placeholder="Re-enter password" autocomplete="new-password" />
                  <button type="button" class="toggle-pw-btn" id="toggle-pw2" title="Show/hide password">👁</button>
                </div>
              </div>
            ` : ''}
            <button type="submit" class="btn btn-primary btn-lg btn-block auth-submit">
              ${mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div class="auth-footer">
            ${mode === 'login'
              ? 'Demo: username <strong>admin</strong>, password <strong>admin</strong>'
              : 'Already have an account? Click Login above.'}
          </div>
        </div>
      </div>
    `;

    // Tab switching
    app.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => { mode = tab.dataset.tab; render(); });
    });

    // Show/hide password
    document.getElementById('toggle-pw')?.addEventListener('click', () => {
      const input = document.getElementById('auth-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('toggle-pw2')?.addEventListener('click', () => {
      const input = document.getElementById('auth-confirm-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Form submit
    app.querySelector('#auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (mode === 'login') handleLogin();
      else handleSignup();
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

  async function handleLogin() {
    clearErrors();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    let valid = true;
    if (!username) { showFieldError('auth-username', 'Username is required'); valid = false; }
    if (!password) { showFieldError('auth-password', 'Password is required'); valid = false; }
    if (!valid) return;

    try {
      const user = await store.login(username, password);
      showToast(`Welcome back, ${user.fullName}!`, 'success');
      router.navigate('#/backend/products');
    } catch (error) {
      showFieldError('auth-username', 'Invalid username or password');
      showToast(error.message || 'Invalid username or password', 'error');
    }
  }

  async function handleSignup() {
    clearErrors();
    const fullName = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const confirm = document.getElementById('auth-confirm-password').value;

    let valid = true;

    if (!fullName || fullName.length < 2) {
      showFieldError('auth-name', 'Full name must be at least 2 characters'); valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('auth-email', 'Enter a valid email address'); valid = false;
    }
    if (!username || username.length < 3) {
      showFieldError('auth-username', 'Username must be at least 3 characters'); valid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showFieldError('auth-username', 'Only letters, numbers and underscores allowed'); valid = false;
    }
    if (!password || password.length < 6) {
      showFieldError('auth-password', 'Password must be at least 6 characters'); valid = false;
    }
    if (password && confirm !== password) {
      showFieldError('auth-confirm-password', 'Passwords do not match'); valid = false;
    }
    if (!valid) return;

    try {
      await store.signup({ fullName, email, username, password });
      showToast('Account created successfully!', 'success');
      router.navigate('#/backend/products');
    } catch (error) {
      const message = error.message || 'Unable to create account';
      if (message.toLowerCase().includes('email')) {
        showFieldError('auth-email', message);
      } else {
        showFieldError('auth-username', message);
      }
      showToast(message, 'error');
    }
  }

  render();
}
