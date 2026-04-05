/* ==========================================================================
   Router — Hash-based SPA router with route guards
   ========================================================================== */

import store from './store.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeEach = null;
    window.addEventListener('hashchange', () => this._resolve());
  }

  on(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  start() {
    if (!window.location.hash) {
      window.location.hash = '#/login';
    }
    this._resolve();
  }

  _resolve() {
    const hash = window.location.hash.slice(1) || '/login';
    const [pathOnly, queryString = ''] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryString));
    const { handler, params } = this._match(pathOnly);
    const routeParams = { ...params, query };

    if (this.beforeEach) {
      const redirectTo = this.beforeEach(pathOnly, routeParams);
      if (redirectTo && redirectTo !== pathOnly) {
        this.navigate(redirectTo);
        return;
      }
    }

    this.currentRoute = hash;
    if (handler) {
      handler(routeParams);
    }
  }

  _match(path) {
    // Try exact match first
    if (this.routes[path]) {
      return { handler: this.routes[path], params: {} };
    }

    // Try parameterized routes
    for (const route of Object.keys(this.routes)) {
      const paramNames = [];
      const regexStr = route.replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
      const match = path.match(new RegExp(`^${regexStr}$`));
      if (match) {
        const params = {};
        paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        return { handler: this.routes[route], params };
      }
    }

    // Fallback
    return { handler: this.routes['/login'] || (() => {}), params: {} };
  }
}

export const router = new Router();
export default router;
