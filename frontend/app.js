const API = "/api";
const state = { token: localStorage.getItem("markethub_token") || "", user: null, products: [], cart: new Map(), view: "shop", registering: false };
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const icons = ["🎧","📚","🎒","☕","🪴","⌚","🧴","🎨","👟","🕯️"];

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function notify(message, error = false) {
  const box = $("#notice"); box.textContent = message; box.classList.remove("hidden", "error");
  if (error) box.classList.add("error");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  $(`#${view}View`).classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  if (view === "orders") loadOrders();
  if (view === "seller") loadSeller();
}
function updateAccount() {
  $("#accountLabel").textContent = state.user ? `${state.user.name} · ${state.user.role}` : "Not signed in";
  $("#authButton").textContent = state.user ? "Account" : "Sign in";
  $("#logoutButton").classList.toggle("hidden", !state.user);
}
async function loadProducts() {
  try {
    const data = await request("/products");
    state.products = data.products || [];
    const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
    $("#categoryFilter").innerHTML = '<option value="">All categories</option>' + categories.map(c => `<option value="${safe(c)}">${safe(c)}</option>`).join("");
    renderProducts();
  } catch (error) {
    $("#productGrid").innerHTML = `<div class="empty-state">Could not load products. ${safe(error.message)}<br>Check your Supabase setup and restart the server.</div>`;
  }
}
function renderProducts() {
  const search = $("#searchInput").value.trim().toLowerCase(), category = $("#categoryFilter").value;
  const products = state.products.filter(p => `${p.name} ${p.description || ""} ${p.vendor_name || ""}`.toLowerCase().includes(search) && (!category || p.category === category));
  $("#productGrid").innerHTML = products.length ? products.map((p, i) => `
    <article class="product-card">
      <div class="product-art" aria-hidden="true">${icons[(i + p.name.length) % icons.length]}</div>
      <div class="product-meta"><span class="pill">${safe(p.category)}</span><span class="muted small">${Number(p.stock)} available</span></div>
      <h3>${safe(p.name)}</h3><p class="vendor-name">Sold by ${safe(p.vendor_name || "Marketplace vendor")}</p>
      <p class="muted small">${safe(p.description || "A product from our marketplace.")}</p>
      <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="button button-primary" data-add="${safe(p.id)}" ${p.stock < 1 ? "disabled" : ""}>Add to cart</button></div>
    </article>`).join("") : '<div class="empty-state">No products match your search yet.</div>';
}
function openAuth(register = false) {
  state.registering = register;
  $("#authTitle").textContent = register ? "Create account" : "Sign in";
  $("#authSubtitle").textContent = register ? "Join the marketplace as a customer or seller." : "Access your marketplace account.";
  $("#registerFields").classList.toggle("hidden", !register);
  $("#authForm").elements.password.autocomplete = register ? "new-password" : "current-password";
  $("#authSubmit").textContent = register ? "Create account" : "Sign in";
  $("#switchText").textContent = register ? "Already registered?" : "New here?";
  $("#switchAuth").textContent = register ? "Sign in" : "Create an account";
  $("#authDialog").showModal();
}
async function loadSession() {
  if (!state.token) { updateAccount(); return; }
  try { const data = await request("/auth/me"); state.user = data.user; }
  catch { state.token = ""; state.user = null; localStorage.removeItem("markethub_token"); }
  updateAccount();
}
function updateCartCount() { $("#cartCount").textContent = [...state.cart.values()].reduce((sum, item) => sum + item.quantity, 0); }
function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const current = state.cart.get(id);
  if ((current?.quantity || 0) >= product.stock) return notify("You cannot add more than the available stock.", true);
  state.cart.set(id, { product, quantity: (current?.quantity || 0) + 1 }); updateCartCount(); notify(`${product.name} added to your cart.`);
}
function openCart() {
  if (!state.cart.size) { notify("Your cart is empty. Add a product first."); return; }
  $("#cartItems").innerHTML = [...state.cart.entries()].map(([id, item]) => `<div class="cart-row"><div><strong>${safe(item.product.name)}</strong><div class="muted small">${money(item.product.price)} each</div></div><input type="number" min="1" max="${Number(item.product.stock)}" value="${item.quantity}" aria-label="Quantity for ${safe(item.product.name)}" data-quantity="${safe(id)}"><button type="button" class="text-button" data-remove="${safe(id)}">Remove</button></div>`).join("");
  $("#cartTotal").textContent = money([...state.cart.values()].reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0));
  $("#cartDialog").showModal();
}
async function loadOrders() {
  const box = $("#ordersList");
  if (!state.user) { box.innerHTML = '<p class="muted">Please sign in to view your orders.</p>'; return; }
  box.innerHTML = "Loading orders…";
  try {
    const data = await request("/orders/mine");
    box.innerHTML = data.orders.length ? data.orders.map(order => `<div class="order-row"><div><strong>Order #${safe(order.id.slice(0, 8))}</strong><div class="muted small">${new Date(order.created_at).toLocaleString()} · ${order.item_count} item(s)</div></div><div style="text-align:right"><strong>${money(order.total)}</strong><br><span class="status ${order.status === "pending" ? "pending" : ""}">${safe(order.status)}</span></div></div>`).join("") : '<p class="muted">No orders yet. Browse products to place your first order.</p>';
  } catch (error) { box.textContent = error.message; }
}
async function loadSeller() {
  const box = $("#sellerContent");
  if (!state.user || state.user.role !== "vendor") { box.innerHTML = '<p class="muted">Sign in with a vendor account to manage products. You can choose “Vendor / seller” when creating an account.</p>'; return; }
  box.innerHTML = '<div class="seller-layout"><form id="productForm" class="seller-form"><h3>Add a product</h3><label>Product name<input name="name" required maxlength="120"></label><label>Description<textarea name="description" maxlength="800"></textarea></label><label>Category<input name="category" required maxlength="60" placeholder="Accessories"></label><label>Price (₹)<input name="price" type="number" min="0.01" step="0.01" required></label><label>Available stock<input name="stock" type="number" min="0" max="100000" step="1" required></label><button class="button button-primary" type="submit">Add product</button></form><div><h3>Your products</h3><div id="sellerProducts">Loading…</div></div></div>';
  try {
    const data = await request("/vendor/products");
    $("#sellerProducts").innerHTML = data.products.length ? data.products.map(p => `<div class="seller-product"><div><strong>${safe(p.name)}</strong><div class="muted small">${money(p.price)} · stock ${p.stock}</div></div><button data-delete-product="${safe(p.id)}">Delete</button></div>`).join("") : '<p class="muted">You have not added products yet.</p>';
  } catch (error) { $("#sellerProducts").textContent = error.message; }
}
$("#authButton").addEventListener("click", () => state.user ? notify(`Signed in as ${state.user.email} (${state.user.role}).`) : openAuth());
$("#logoutButton").addEventListener("click", () => { state.token = ""; state.user = null; localStorage.removeItem("markethub_token"); updateAccount(); showView("shop"); notify("You have signed out."); });
$("#switchAuth").addEventListener("click", () => openAuth(!state.registering));
$("#authForm").addEventListener("submit", async event => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const body = { email: form.get("email"), password: form.get("password") };
  if (state.registering) Object.assign(body, { name: form.get("name"), role: form.get("role") });
  try {
    const data = await request(state.registering ? "/auth/register" : "/auth/login", { method: "POST", body: JSON.stringify(body) });
    state.token = data.token; state.user = data.user; localStorage.setItem("markethub_token", state.token); updateAccount(); $("#authDialog").close(); event.currentTarget.reset(); notify(state.registering ? "Account created successfully." : "Welcome back."); loadProducts();
  } catch (error) { notify(error.message, true); }
});
$("#productGrid").addEventListener("click", event => { const button = event.target.closest("[data-add]"); if (button) addToCart(button.dataset.add); });
$("#searchInput").addEventListener("input", renderProducts);
$("#categoryFilter").addEventListener("change", renderProducts);
$("#cartButton").addEventListener("click", openCart);
$("#cartItems").addEventListener("click", event => { const id = event.target.dataset.remove; if (id) { state.cart.delete(id); updateCartCount(); openCart(); } });
$("#cartItems").addEventListener("change", event => { const id = event.target.dataset.quantity; if (!id) return; const item = state.cart.get(id); const qty = Math.max(1, Math.min(item.product.stock, Number(event.target.value) || 1)); item.quantity = qty; updateCartCount(); openCart(); });
$("#cartForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.user) { $("#cartDialog").close(); openAuth(); notify("Please sign in before placing an order."); return; }
  const address = new FormData(event.currentTarget).get("address");
  const items = [...state.cart.values()].map(item => ({ product_id: item.product.id, quantity: item.quantity }));
  try {
    const data = await request("/orders", { method: "POST", body: JSON.stringify({ address, items }) });
    state.cart.clear(); updateCartCount(); $("#cartDialog").close(); event.currentTarget.reset(); notify(`Order placed successfully. Order number: ${data.order.id.slice(0, 8)}.`); loadProducts(); showView("orders");
  } catch (error) { notify(error.message, true); }
});
$("#sellerContent").addEventListener("submit", async event => {
  if (event.target.id !== "productForm") return;
  event.preventDefault(); const f = new FormData(event.target);
  try { await request("/vendor/products", { method: "POST", body: JSON.stringify({ name: f.get("name"), description: f.get("description"), category: f.get("category"), price: Number(f.get("price")), stock: Number(f.get("stock")) }) }); notify("Product added to your store."); await loadSeller(); await loadProducts(); }
  catch (error) { notify(error.message, true); }
});
$("#sellerContent").addEventListener("click", async event => {
  const id = event.target.dataset.deleteProduct; if (!id) return;
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try { await request(`/vendor/products/${encodeURIComponent(id)}`, { method: "DELETE" }); notify("Product deleted."); await loadSeller(); await loadProducts(); }
  catch (error) { notify(error.message, true); }
});
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
$("#browseButton").addEventListener("click", () => $("#shopView").scrollIntoView({ behavior: "smooth" }));
$("#brandLink").addEventListener("click", event => { event.preventDefault(); showView("shop"); window.scrollTo({ top: 0, behavior: "smooth" }); });
(async function init() { await loadSession(); await loadProducts(); showView("shop"); })();
