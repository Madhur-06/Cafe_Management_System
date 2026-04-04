const STORE_PREFIX = "odoo_pos_";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const CATEGORY_BADGES = {
  Pizza: "P",
  Pasta: "PA",
  Burger: "B",
  Coffee: "C",
  Drinks: "D",
  Beverages: "D",
  Dessert: "DS",
  Snacks: "S",
};

const PAYMENT_ICONS = {
  cash: "₹",
  card: "CC",
  upi: "UPI",
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

  getAll(collection) {
    return this.get(collection, []);
  }

  find(collection, id) {
    return this.getAll(collection).find((item) => String(item.id) === String(id)) || null;
  }

  add(collection, item) {
    const items = this.getAll(collection);
    const nextItem = {
      ...item,
      id: item.id || `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
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

  getToken() {
    return this.get("token", "");
  }

  setToken(token) {
    if (token) this.set("token", token);
    else this.remove("token");
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

  getActiveBranchId() {
    return this.get("activeBranchId", null);
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

  _withBranch(path, branchId = this.getActiveBranchId()) {
    if (!branchId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}branch_id=${encodeURIComponent(branchId)}`;
  }

  _applyCurrentUser(me) {
    this.setCurrentUser({
      id: me.id,
      username: me.username,
      fullName: me.name,
      email: me.email,
      role: me.role,
      branchId: me.branch_id ?? null,
      branchName: me.branch_name ?? null,
    });
  }

  _normalizeBranches(branches) {
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address || "",
      phone: branch.phone || "",
      is_active: branch.is_active !== false,
    }));
  }

  _ensureActiveBranch(branches = this.getAll("branches")) {
    const user = this.getCurrentUser();
    if (!branches.length) {
      this.remove("activeBranchId");
      return null;
    }

    let nextBranchId = this.getActiveBranchId();
    if (String(user?.role || "").toLowerCase() !== "admin") {
      nextBranchId = user?.branchId || branches[0]?.id || null;
    } else if (!nextBranchId || !branches.some((branch) => String(branch.id) === String(nextBranchId))) {
      nextBranchId = branches[0]?.id || null;
    }

    if (nextBranchId) this.set("activeBranchId", nextBranchId);
    else this.remove("activeBranchId");
    return nextBranchId;
  }

  async fetchBranches() {
    const branches = this._normalizeBranches(await this._api("/branches"));
    this.set("branches", branches);
    this._ensureActiveBranch(branches);
    return branches;
  }

  async setActiveBranch(branchId) {
    const user = this.getCurrentUser();
    if (String(user?.role || "").toLowerCase() !== "admin") {
      this._ensureActiveBranch();
      return this.getActiveBranchId();
    }
    this.set("activeBranchId", branchId || null);
    this.remove("currentOrder");
    this.setActiveSession(null);
    await this.syncProtectedData();
    return this.getActiveBranchId();
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
        icon: PAYMENT_ICONS[method.type] || method.name,
        is_active: true,
      };
    });
  }

  _normalizeProducts(products, categoriesMeta) {
    const categoryMap = new Map(categoriesMeta.map((category) => [String(category.id), category.name]));
    return products.map((product) => ({
      ...product,
      category: categoryMap.get(String(product.category_id)) || "Uncategorized",
      emoji: CATEGORY_BADGES[categoryMap.get(String(product.category_id))] || "PR",
      price: Number(product.price),
      tax: Number(product.tax || 0),
    }));
  }

  _normalizeFloors(floors) {
    return floors.map((floor) => ({
      id: floor.id,
      branchId: floor.branch_id,
      branchName: floor.branch_name || "",
      name: floor.name,
      active: floor.is_active !== false,
    }));
  }

  _normalizeTables(floors) {
    return floors.flatMap((floor) =>
      (floor.tables || []).map((table) => ({
        id: table.id,
        branchId: table.branch_id,
        branchName: table.branch_name || floor.branch_name || "",
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
      branchId: session.branch_id,
      branchName: session.branch_name || "",
      status: session.status,
      openedAt: session.opened_at || session.created_at,
      responsible: session.responsible_name || `User #${session.responsible_id}`,
      responsibleId: session.responsible_id,
      totalSales: Number(totalsBySession.get(String(session.id)) || 0),
      orderCount: Number(countsBySession.get(String(session.id)) || 0),
    }));
  }

  _normalizeOrders(orders) {
    return orders.map((order) => ({
      id: order.id,
      backendId: order.id,
      branchId: order.branch_id,
      branchName: order.branch_name || "",
      tableId: order.table_id,
      tableNumber: tableNumberValue(order.table_name),
      status:
        order.payment_status === "paid"
          ? "paid"
          : order.kitchen_status === "preparing" || order.kitchen_status === "to_cook" || order.status === "sent"
            ? "in_progress"
            : "open",
      items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.name,
        price: Number(item.unit_price),
        qty: item.quantity,
        tax: Number(item.tax_rate || 0),
        emoji: "IT",
      })),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_total),
      total: Number(order.grand_total),
      sessionId: order.session_id,
      createdAt: order.created_at,
      updatedAt: order.paid_at || order.closed_at || order.created_at,
      paymentMethod: order.payments?.[0]?.payment_method_name || "",
      paymentStatus: order.payment_status,
      kitchenStatus: order.kitchen_status,
      responsibleId: order.responsible_id,
      responsible: order.responsible_name || (order.responsible_id ? `User #${order.responsible_id}` : ""),
    }));
  }

  _normalizeKitchenOrders(orders) {
    return orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      orderNumber: order.order_number,
      branchId: order.branch_id,
      branchName: order.branch_name || "",
      tableNumber: tableNumberValue(order.table_name),
      items: (order.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.quantity,
        prepared: item.kitchen_done,
        emoji: "IT",
      })),
      stage: order.kitchen_status === "preparing" ? "preparing" : order.kitchen_status === "completed" ? "completed" : "to_cook",
      createdAt: order.created_at,
      paidOrder: order.payment_status === "paid",
    }));
  }

  _normalizeCustomerOrders(orders) {
    return orders.map((order) => ({
      id: order.id,
      branchId: order.branch_id,
      branchName: order.branch_name || "",
      tableNumber: tableNumberValue(order.table_name),
      status: order.payment_status === "paid" ? "paid" : order.kitchen_status === "preparing" || order.kitchen_status === "to_cook" ? "in_progress" : "open",
      items: (order.items || []).map((item) => ({
        name: item.name,
        qty: item.quantity,
        price: Number(item.total_price) / Math.max(item.quantity, 1),
        emoji: "IT",
      })),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_total),
      total: Number(order.grand_total),
      paymentMethod: "",
      updatedAt: order.created_at,
    }));
  }

  async initialize() {
    this.set("settings", { storeName: "Odoo POS Cafe", currency: "₹" });
    this.set("paymentMethods", this.getFixedPaymentMethods());
    if (!this.getToken()) return;

    try {
      const me = await this._api("/me");
      this._applyCurrentUser(me);
      await this.fetchBranches();
      await this.syncProtectedData();
    } catch {
      this.logout();
    }
  }

  async login(username, password) {
    const normalizedUsername = String(username || "").trim();
    const response = await this._api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: normalizedUsername, password }),
    }, false);
    this.setToken(response.access_token);
    this.set("last_username", normalizedUsername);
    this._applyCurrentUser(response.user);
    await this.fetchBranches();
    await this.syncProtectedData();
    return this.getCurrentUser();
  }

  async signup() {
    throw new Error("Sign up is disabled. Ask an admin to create your account.");
  }

  logout() {
    this.setToken("");
    [
      "currentUser",
      "activeSession",
      "activeBranchId",
      "branches",
      "users",
      "products",
      "productsRaw",
      "categories",
      "categoriesMeta",
      "paymentMethods",
      "floors",
      "tables",
      "terminals",
      "sessions",
      "orders",
      "kitchenOrders",
      "customerOrders",
      "reports_raw",
      "currentOrder",
    ].forEach((key) => this.remove(key));
  }

  async syncProtectedData() {
    if (!this.getToken()) return;

    const user = this.getCurrentUser();
    const branches = this.getAll("branches");
    const activeBranchId = this._ensureActiveBranch(branches);
    if (!activeBranchId) throw new Error("No active branch available");
    const role = String(user?.role || "").toLowerCase();

    if (role === "chef") {
      this.set("categoriesMeta", []);
      this.set("categories", []);
      this.set("productsRaw", []);
      this.set("products", []);
      this.set("floors", []);
      this.set("tables", []);
      this.set("terminals", []);
      this.set("sessions", []);
      this.set("orders", []);
      this.set("reports_raw", null);
      this.set("paymentMethods", this.getFixedPaymentMethods());
      this.setActiveSession(null);
      await this.syncPublicData();
      return;
    }

    const branchQueryPath = (path) => this._withBranch(path, activeBranchId);
    const requests = [
      this._api("/categories"),
      this._api("/products"),
      this._api(branchQueryPath("/floors")),
      this._api(branchQueryPath("/terminals")),
      this._api(branchQueryPath("/sessions")),
      this._api(branchQueryPath("/orders")),
      role === "admin" ? this._api(branchQueryPath("/reports")) : Promise.resolve(null),
      role === "admin" ? this._api("/reports/branches") : Promise.resolve([]),
    ];

    const [categoriesMeta, productsRaw, floorsRaw, terminals, sessionsRaw, ordersRaw, reportsRaw, branchReportsRaw] = await Promise.all(requests);

    const products = this._normalizeProducts(productsRaw, categoriesMeta);
    const paymentMethods = this.getFixedPaymentMethods();
    const floors = this._normalizeFloors(floorsRaw);
    const tables = this._normalizeTables(floorsRaw);
    const orders = this._normalizeOrders(ordersRaw);
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
    this.set("reports_branch_summary", branchReportsRaw);
    if (activeOpenSession) this.setActiveSession(activeOpenSession);
    else this.setActiveSession(null);

    await this.syncPublicData();
  }

  async syncPublicData() {
    const branchId = this.getActiveBranchId();
    const branchQueryPath = (path) => this._withBranch(path, branchId);
    const [kitchenOrdersRaw, customerOrdersRaw] = await Promise.all([
      this._api(branchQueryPath("/kitchen/orders"), {}, false),
      this._api(branchQueryPath("/customer-display"), {}, false),
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

  async createBranch(branch) {
    await this._api("/branches", {
      method: "POST",
      body: JSON.stringify({
        name: branch.name,
        code: branch.code,
        address: branch.address || "",
        phone: branch.phone || "",
        is_active: branch.is_active !== false,
      }),
    });
    await this.fetchBranches();
    await this.syncProtectedData();
  }

  async updateBranch(branchId, branch) {
    await this._api(`/branches/${branchId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: branch.name,
        code: branch.code,
        address: branch.address || "",
        phone: branch.phone || "",
        is_active: branch.is_active !== false,
      }),
    });
    await this.fetchBranches();
    await this.syncProtectedData();
  }

  async deleteBranch(branchId) {
    await this._api(`/branches/${branchId}`, { method: "DELETE" });
    await this.fetchBranches();
    await this.syncProtectedData();
  }

  async fetchUsers() {
    const users = await this._api("/users");
    this.set("users", users);
    return users;
  }

  async createUser(user) {
    const created = await this._api("/users", {
      method: "POST",
      body: JSON.stringify({
        branch_id: user.branch_id,
        name: user.name,
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
      }),
    });
    await this.fetchUsers();
    return created;
  }

  async updateUser(userId, user) {
    const updated = await this._api(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        branch_id: user.branch_id,
        name: user.name,
        username: user.username,
        email: user.email,
        password: user.password || null,
        role: user.role,
        is_active: user.is_active,
      }),
    });
    await this.fetchUsers();
    return updated;
  }

  async deleteUser(userId) {
    await this._api(`/users/${userId}`, { method: "DELETE" });
    await this.fetchUsers();
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
    await this._api(this._withBranch("/floors"), { method: "POST", body: JSON.stringify({ name }) });
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

    await this._api(this._withBranch("/terminals"), {
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
    const activeSession = this.getActiveSession();
    if (!activeSession?.id) throw new Error("No active session found");
    const payload = {
      session_id: activeSession.id,
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
    await this._api(this._withBranch(`/kitchen/orders/${orderId}/advance`), { method: "POST" }, false);
    await this.syncPublicData();
  }

  async toggleKitchenItem(itemId) {
    await this._api(this._withBranch(`/kitchen/items/${itemId}/toggle`), { method: "POST" }, false);
    await this.syncPublicData();
  }
}

export const store = new Store();
export default store;
