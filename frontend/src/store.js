/* ==========================================================================
   Store -- API-backed data cache with local draft support
   ========================================================================== */

const STORE_PREFIX = "odoo_pos_";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const CATEGORY_EMOJIS = {
  Pizza: "🍕",
  Pasta: "🍝",
  Burger: "🍔",
  Coffee: "☕",
  Drinks: "🥤",
  Beverages: "🥤",
  Dessert: "🍰",
  Snacks: "🍟",
};

const PAYMENT_ICONS = {
  cash: "💵",
  digital: "💳",
  upi: "📱",
};

const FIXED_PAYMENT_METHODS = [
  { id: "cash", name: "Cash", type: "cash", enabled: true, upiId: null },
  { id: "card", name: "Card", type: "card", enabled: true, upiId: null },
  { id: "upi", name: "UPI", type: "upi", enabled: true, upiId: "" },
];

function tableNumberValue(tableNumber) {
  const match = String(tableNumber || "").match(/\d+/);
  return match ? Number(match[0]) : tableNumber;
}

function parseError(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) return payload.detail.map((item) => item.msg || "Invalid request").join(", ");
  return fallback;
}

class Store {
  constructor() {
    this._listeners = {};
  }

  _key(name) {
    return STORE_PREFIX + name;
  }

  get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(this._key(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  set(name, value) {
    localStorage.setItem(this._key(name), JSON.stringify(value));
    this._emit(name, value);
  }

  remove(name) {
    localStorage.removeItem(this._key(name));
    this._emit(name, null);
  }

  getToken() {
    return this.get("token", "");
  }

  setToken(token) {
    if (token) this.set("token", token);
    else this.remove("token");
  }

  async _api(path, options = {}, includeAuth = true) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (includeAuth && this.getToken()) headers.Authorization = `Bearer ${this.getToken()}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(parseError(payload, `Request failed (${response.status})`));
    }
    return payload;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  getAll(collection) {
    return this.get(collection, []);
  }

  add(collection, item) {
    const items = this.getAll(collection);
    const nextItem = {
      ...item,
      id: item.id || this.generateId(),
      createdAt: item.createdAt || new Date().toISOString(),
    };
    items.push(nextItem);
    this.set(collection, items);
    return nextItem;
  }

  update(collection, id, updates) {
    const items = this.getAll(collection);
    const index = items.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    this.set(collection, items);
    return items[index];
  }

  deleteItem(collection, id) {
    this.set(collection, this.getAll(collection).filter((item) => String(item.id) !== String(id)));
  }

  find(collection, id) {
    return this.getAll(collection).find((item) => String(item.id) === String(id)) || null;
  }

  findWhere(collection, predicate) {
    return this.getAll(collection).filter(predicate);
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach((cb) => cb(data));
    (this._listeners["*"] || []).forEach((cb) => cb(event, data));
  }

  getCurrentUser() {
    return this.get("currentUser", null);
  }

  setCurrentUser(user) {
    this.set("currentUser", user);
  }

  getActiveSession() {
    return this.get("activeSession", null);
  }

  setActiveSession(session) {
    if (session) this.set("activeSession", session);
    else this.remove("activeSession");
  }

  async initialize() {
    this.set("settings", { storeName: "Odoo POS Cafe", currency: "₹" });
    this.set("paymentMethods", this.getFixedPaymentMethods());
    if (!this.getToken()) return;
    try {
      const me = await this._api("/me");
      this.setCurrentUser({
        id: me.id,
        username: this.get("last_username", me.email),
        fullName: me.name,
        email: me.email,
        role: me.role,
      });
      await this.syncProtectedData();
    } catch {
      this.logout();
    }
  }

  _resolveLoginEmail(usernameOrEmail) {
    if (usernameOrEmail.includes("@")) return usernameOrEmail;
    const aliases = this.get("user_aliases", {});
    return aliases[usernameOrEmail] || (usernameOrEmail === "admin" ? "admin@odoo-pos.local" : usernameOrEmail);
  }

  async login(usernameOrEmail, password) {
    const email = this._resolveLoginEmail(usernameOrEmail.trim());
    const response = await this._api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }, false);
    this.setToken(response.access_token);
    this.set("last_username", usernameOrEmail.trim());
    this.setCurrentUser({
      id: response.user.id,
      username: usernameOrEmail.trim(),
      fullName: response.user.name,
      email: response.user.email,
      role: response.user.role,
    });
    await this.syncProtectedData();
    return this.getCurrentUser();
  }

  async signup({ fullName, email, username, password }) {
    const response = await this._api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name: fullName, email, password }),
    }, false);
    const aliases = this.get("user_aliases", {});
    aliases[username] = email;
    this.set("user_aliases", aliases);
    this.set("last_username", username);
    this.setToken(response.access_token);
    this.setCurrentUser({
      id: response.user.id,
      username,
      fullName: response.user.name,
      email: response.user.email,
      role: response.user.role,
    });
    await this.syncProtectedData();
    return this.getCurrentUser();
  }

  logout() {
    this.setToken("");
    [
      "currentUser",
      "activeSession",
      "products",
      "productsRaw",
      "categories",
      "categoriesMeta",
      "paymentMethods",
      "floors",
      "tables",
      "sessions",
      "orders",
      "kitchenOrders",
      "customerOrders",
      "reports_raw",
      "currentOrder",
    ].forEach((key) => this.remove(key));
  }

  _normalizeProducts(products, categoriesMeta) {
    const categoryMap = new Map(categoriesMeta.map((category) => [String(category.id), category.name]));
    return products.map((product) => ({
      ...product,
      category: categoryMap.get(String(product.category_id)) || "Uncategorized",
      emoji: CATEGORY_EMOJIS[categoryMap.get(String(product.category_id))] || "📦",
      price: Number(product.price),
      tax: Number(product.tax || 0),
    }));
  }

  _normalizePaymentMethods(methods) {
    return methods.map((method) => ({
      ...method,
      icon: PAYMENT_ICONS[method.type] || "💳",
      upiId: method.upi_id,
    }));
  }

  getFixedPaymentMethods() {
    const settings = this.get("paymentMethodSettings", {});
    return FIXED_PAYMENT_METHODS.map((method) => {
      const override = settings[method.id] || {};
      return {
        ...method,
        ...override,
        id: method.id,
        name: method.name,
        type: method.type,
        icon: PAYMENT_ICONS[method.type] || PAYMENT_ICONS.digital || "💳",
        is_active: true,
      };
    });
  }

  _normalizeFloors(floors) {
    return floors.map((floor) => ({ id: floor.id, name: floor.name, active: true }));
  }

  _normalizeTables(floors) {
    return floors.flatMap((floor) =>
      floor.tables.map((table) => ({
        id: table.id,
        floorId: floor.id,
        number: tableNumberValue(table.table_number),
        seats: table.seats,
        active: table.active,
        status: "available",
        rawTableNumber: table.table_number,
      }))
    );
  }

  _normalizeSessions(sessions, orders = []) {
    const currentUser = this.getCurrentUser();
    const totalsBySession = new Map();
    const countsBySession = new Map();

    orders.forEach((order) => {
      const sessionId = String(order.session_id ?? order.sessionId ?? "");
      if (!sessionId) return;
      const orderTotal = Number(order.grand_total ?? order.total ?? 0);
      totalsBySession.set(sessionId, (totalsBySession.get(sessionId) || 0) + orderTotal);
      countsBySession.set(sessionId, (countsBySession.get(sessionId) || 0) + 1);
    });

    return sessions.map((session) => ({
      id: session.id,
      status: session.status,
      openedAt: session.opened_at || session.created_at,
      responsible: session.responsible_id === currentUser?.id ? currentUser.fullName : `User #${session.responsible_id}`,
      responsibleId: session.responsible_id,
      totalSales: Number(totalsBySession.get(String(session.id)) || 0),
      orderCount: Number(countsBySession.get(String(session.id)) || 0),
    }));
  }

  _normalizeOrders(orders, paymentMethods) {
    const paymentMethodMap = new Map(paymentMethods.map((method) => [String(method.id), method.name]));
    return orders.map((order) => ({
      id: order.id,
      backendId: order.id,
      tableId: order.table_id,
      tableNumber: tableNumberValue(order.table_name),
      status: order.payment_status === "paid" ? "paid" : order.kitchen_status === "preparing" || order.kitchen_status === "to_cook" || order.status === "sent" ? "in_progress" : "open",
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.name,
        price: Number(item.unit_price),
        qty: item.quantity,
        tax: 0,
        emoji: "🍽️",
      })),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_total),
      total: Number(order.grand_total),
      sessionId: order.session_id,
      createdAt: order.created_at,
      updatedAt: order.paid_at || order.closed_at || order.created_at,
      paymentMethod:
        order.payments[0]?.payment_method_name
        || (order.payments[0]?.payment_method_code ? paymentMethodMap.get(String(order.payments[0].payment_method_code)) : "")
        || "",
      paymentStatus: order.payment_status,
      kitchenStatus: order.kitchen_status,
      responsibleId: order.responsible_id,
      responsible: order.responsible_id ? `User #${order.responsible_id}` : "",
    }));
  }

  _normalizeKitchenOrders(orders) {
    return orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      orderNumber: order.order_number,
      tableNumber: tableNumberValue(order.table_name),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.quantity,
        prepared: item.kitchen_done,
        emoji: "🍽️",
      })),
      stage: order.kitchen_status === "preparing" ? "preparing" : order.kitchen_status === "completed" ? "completed" : "to_cook",
      createdAt: order.created_at,
      paidOrder: order.payment_status === "paid",
    }));
  }

  _normalizeCustomerOrders(orders) {
    return orders.map((order) => ({
      id: order.id,
      tableNumber: tableNumberValue(order.table_name),
      status: order.payment_status === "paid" ? "paid" : order.kitchen_status === "preparing" || order.kitchen_status === "to_cook" ? "in_progress" : "open",
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.quantity,
        price: Number(item.total_price) / Math.max(item.quantity, 1),
        emoji: "🍽️",
      })),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_total),
      total: Number(order.grand_total),
      paymentMethod: "",
      updatedAt: order.created_at,
    }));
  }

  async syncProtectedData() {
    if (!this.getToken()) return;
    const [categoriesMeta, productsRaw, floorsRaw, terminals, sessionsRaw, ordersRaw, reportsRaw] = await Promise.all([
      this._api("/categories"),
      this._api("/products"),
      this._api("/floors"),
      this._api("/terminals"),
      this._api("/sessions"),
      this._api("/orders"),
      this._api("/reports"),
    ]);

    const products = this._normalizeProducts(productsRaw, categoriesMeta);
    const paymentMethods = this.getFixedPaymentMethods();
    const floors = this._normalizeFloors(floorsRaw);
    const tables = this._normalizeTables(floorsRaw);
    const orders = this._normalizeOrders(ordersRaw, paymentMethods);
    const sessions = this._normalizeSessions(sessionsRaw, ordersRaw);

    const activeOpenSession = sessions.find((session) => session.status === "open") || null;

    this.set("categoriesMeta", categoriesMeta);
    this.set("categories", categoriesMeta.map((category) => category.name));
    this.set("productsRaw", productsRaw);
    this.set("products", products);
    this.set("paymentMethods", paymentMethods);
    this.set("floors", floors);
    this.set("tables", tables);
    this.set("terminals", terminals);
    this.set("sessions", sessions);
    this.set("orders", orders);
    this.set("reports_raw", reportsRaw);
    if (activeOpenSession) this.setActiveSession(activeOpenSession);
    else this.setActiveSession(null);

    await this.syncPublicData();
  }

  async syncPublicData() {
    const [kitchenOrdersRaw, customerOrdersRaw] = await Promise.all([
      this._api("/kitchen/orders", {}, false),
      this._api("/customer-display", {}, false),
    ]);
    this.set("kitchenOrders", this._normalizeKitchenOrders(kitchenOrdersRaw));
    this.set("customerOrders", this._normalizeCustomerOrders(customerOrdersRaw));
  }

  _categoryIdByName(name) {
    const category = this.get("categoriesMeta", []).find((item) => item.name === name);
    return category?.id;
  }

  async createCategory(name) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) throw new Error("Category name is required");
    await this._api("/categories", {
      method: "POST",
      body: JSON.stringify({ name: trimmedName }),
    });
    await this.syncProtectedData();
    return this._categoryIdByName(trimmedName);
  }

  async createProduct(product) {
    const categoryId = this._categoryIdByName(product.category);
    if (!categoryId) throw new Error("Category not found");
    await this._api("/products", {
      method: "POST",
      body: JSON.stringify({
        name: product.name,
        category_id: categoryId,
        price: Number(product.price),
        unit: product.unit,
        tax: Number(product.tax || 0),
        description: product.description || "",
        image: null,
        send_to_kitchen: true,
        variants: product.variants || [],
      }),
    });
    await this.syncProtectedData();
  }

  async updateProduct(id, product) {
    const categoryId = this._categoryIdByName(product.category);
    if (!categoryId) throw new Error("Category not found");
    await this._api(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: product.name,
        category_id: categoryId,
        price: Number(product.price),
        unit: product.unit,
        tax: Number(product.tax || 0),
        description: product.description || "",
        image: null,
        send_to_kitchen: true,
        variants: product.variants || [],
      }),
    });
    await this.syncProtectedData();
  }

  async deleteProduct(id) {
    await this._api(`/products/${id}`, { method: "DELETE" });
    await this.syncProtectedData();
  }

  async updatePaymentMethod(id, updates) {
    const current = this.getFixedPaymentMethods().find((method) => String(method.id) === String(id));
    if (!current) throw new Error("Payment method not found");
    const settings = this.get("paymentMethodSettings", {});
    settings[id] = {
      enabled: updates.enabled ?? current.enabled,
      upiId: updates.upiId ?? current.upiId ?? null,
    };
    this.set("paymentMethodSettings", settings);
    this.set("paymentMethods", this.getFixedPaymentMethods());
    return this.find("paymentMethods", id);
  }

  async createFloor(name) {
    await this._api("/floors", { method: "POST", body: JSON.stringify({ name }) });
    await this.syncProtectedData();
  }

  async deleteFloor(id) {
    await this._api(`/floors/${id}`, { method: "DELETE" });
    await this.syncProtectedData();
  }

  async createTable({ floorId, number, seats, active }) {
    await this._api("/tables", {
      method: "POST",
      body: JSON.stringify({
        floor_id: floorId,
        table_number: `Table ${number}`,
        seats: Number(seats),
        active,
        appointment_resource: null,
      }),
    });
    await this.syncProtectedData();
  }

  async updateTable(id, { floorId, number, seats, active }) {
    await this._api(`/tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        floor_id: floorId,
        table_number: `Table ${number}`,
        seats: Number(seats),
        active,
        appointment_resource: null,
      }),
    });
    await this.syncProtectedData();
  }

  async deleteTable(id) {
    await this._api(`/tables/${id}`, { method: "DELETE" });
    await this.syncProtectedData();
  }

  async ensureTerminal() {
    let terminals = this.get("terminals", []);
    if (terminals.length > 0) return terminals[0];

    await this._api("/terminals", {
      method: "POST",
      body: JSON.stringify({
        name: "Main Terminal",
        location: "Main Hall",
        active: true,
      }),
    });
    await this.syncProtectedData();
    terminals = this.get("terminals", []);
    return terminals[0] || null;
  }

  async openSession() {
    const terminal = await this.ensureTerminal();
    if (!terminal) throw new Error("No terminal found");
    await this._api("/sessions/open", {
      method: "POST",
      body: JSON.stringify({ terminal_id: terminal.id, opening_amount: 0 }),
    });
    await this.syncProtectedData();
    return this.getActiveSession();
  }

  async closeSession(sessionId, closingAmount = 0) {
    await this._api(`/sessions/${sessionId}/close`, {
      method: "POST",
      body: JSON.stringify({ closing_amount: Number(closingAmount) }),
    });
    await this.syncProtectedData();
  }

  setDraftOrder(order) {
    this.set("currentOrder", order);
  }

  getDraftOrder() {
    return this.get("currentOrder", null);
  }

  async createOrUpdateBackendOrder(orderDraft) {
    const existing = orderDraft?.backendId ? this.find("orders", orderDraft.backendId) : null;
    if (existing) return existing;
    const products = this.get("products", []);
    const payload = {
      session_id: this.getActiveSession()?.id,
      table_id: orderDraft.tableId,
      source: "pos",
      items: (orderDraft.items || []).map((item) => {
        const product = products.find((entry) => String(entry.id) === String(item.productId));
        return { product_id: product?.id || item.productId, quantity: item.qty };
      }),
    };
    const created = await this._api("/orders", { method: "POST", body: JSON.stringify(payload) });
    await this.syncProtectedData();
    return this.find("orders", created.id) || created;
  }

  async sendOrder(orderDraft) {
    const order = await this.createOrUpdateBackendOrder(orderDraft);
    await this._api(`/orders/${order.id}/send`, { method: "POST" });
    await this.syncProtectedData();
    return this.find("orders", order.id);
  }

  async payOrder(orderDraft, methodId) {
    const order = await this.createOrUpdateBackendOrder(orderDraft);
    const paymentMethod = this.find("paymentMethods", methodId);
    const paid = await this._api(`/orders/${order.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        payment_method_code: paymentMethod?.type || methodId,
        amount: Number(order.total || order.grand_total || 0),
        reference: paymentMethod?.type === "upi" ? `UPI-${Date.now()}` : null,
      }),
    });
    await this.syncProtectedData();
    return this.find("orders", paid.id) || paid;
  }

  async createSelfOrderToken(tableId, sessionId) {
    return this._api(`/self-order/tokens?table_id=${tableId}&session_id=${sessionId}`, { method: "POST" });
  }

  async submitSelfOrder(token, items) {
    const products = this.get("products", []);
    return this._api("/self-order", {
      method: "POST",
      body: JSON.stringify({
        token,
        items: items.map((item) => {
          const product = products.find((entry) => String(entry.id) === String(item.productId));
          return { product_id: product?.id || item.productId, quantity: item.qty };
        }),
      }),
    }, false);
  }

  async advanceKitchenOrder(orderId) {
    await this._api(`/kitchen/orders/${orderId}/advance`, { method: "POST" }, false);
    await this.syncPublicData();
  }

  async toggleKitchenItem(itemId) {
    await this._api(`/kitchen/items/${itemId}/toggle`, { method: "POST" }, false);
    await this.syncPublicData();
  }
}

export const store = new Store();
export default store;
