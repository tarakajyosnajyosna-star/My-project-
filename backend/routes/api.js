const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const supabase = require("../supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanText = value => typeof value === "string" ? value.trim() : "";
function dbError(res, error, fallback = "The database request could not be completed.") {
  console.error("Database operation failed:", error?.message || "unknown error");
  return res.status(500).json({ error: fallback });
}
function signToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "2h" });
}

router.get("/health", (_req, res) => res.json({ status: "ok", service: "markethub-api" }));

router.post("/auth/register", async (req, res) => {
  const name = cleanText(req.body.name), email = cleanText(req.body.email).toLowerCase(), password = req.body.password, role = req.body.role;
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Name must contain 2–80 characters." });
  if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  if (typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8–72 characters long." });
  if (!["customer", "vendor"].includes(role)) return res.status(400).json({ error: "Choose customer or vendor as your account type." });
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from("profiles").insert({ id: randomUUID(), name, email, password_hash, role }).select("id,name,email,role,created_at").single();
    if (error?.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
    if (error) return dbError(res, error, "Could not create your account. Check the database setup.");
    const token = signToken(data);
    return res.status(201).json({ token, user: data });
  } catch (error) {
    if (error.message.includes("JWT_SECRET")) return res.status(500).json({ error: "Server authentication is not configured. Set JWT_SECRET in backend/.env." });
    return dbError(res, error, "Could not create your account.");
  }
});

router.post("/auth/login", async (req, res) => {
  const email = cleanText(req.body.email).toLowerCase(), password = req.body.password;
  if (!emailPattern.test(email) || typeof password !== "string") return res.status(400).json({ error: "Enter your email and password." });
  try {
    const { data: profile, error } = await supabase.from("profiles").select("id,name,email,role,password_hash,created_at").eq("email", email).maybeSingle();
    if (error) return dbError(res, error, "Could not sign in. Check the database setup.");
    if (!profile || !(await bcrypt.compare(password, profile.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
    const user = { id: profile.id, name: profile.name, email: profile.email, role: profile.role, created_at: profile.created_at };
    return res.json({ token: signToken(user), user });
  } catch (error) {
    if (error.message.includes("JWT_SECRET")) return res.status(500).json({ error: "Server authentication is not configured. Set JWT_SECRET in backend/.env." });
    return dbError(res, error, "Could not sign in.");
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("profiles").select("id,name,email,role,created_at").eq("id", req.user.sub).maybeSingle();
    if (error) return dbError(res, error);
    if (!data) return res.status(401).json({ error: "Account no longer exists." });
    return res.json({ user: data });
  } catch (error) { return dbError(res, error); }
});

router.get("/products", async (req, res) => {
  const search = cleanText(req.query.search).slice(0, 100);
  try {
    let query = supabase.from("products").select("id,vendor_id,name,description,category,price,stock,created_at,profiles!products_vendor_id_fkey(name)").eq("is_active", true).order("created_at", { ascending: false }).limit(100);
    if (search) query = query.ilike("name", `%${search.replace(/[%_,]/g, "")}%`);
    const { data, error } = await query;
    if (error) return dbError(res, error, "Could not load products. Verify that database/schema.sql has been run.");
    return res.json({ products: (data || []).map(p => ({ id:p.id, vendor_id:p.vendor_id, name:p.name, description:p.description, category:p.category, price:p.price, stock:p.stock, created_at:p.created_at, vendor_name:p.profiles?.name || "Marketplace vendor" })) });
  } catch (error) { return dbError(res, error, "Could not load products."); }
});

router.get("/vendor/products", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").select("id,name,description,category,price,stock,is_active,created_at").eq("vendor_id", req.user.sub).order("created_at", { ascending: false });
    if (error) return dbError(res, error);
    return res.json({ products: data || [] });
  } catch (error) { return dbError(res, error); }
});

router.post("/vendor/products", requireAuth, requireRole("vendor"), async (req, res) => {
  const name = cleanText(req.body.name), description = cleanText(req.body.description), category = cleanText(req.body.category);
  const price = Number(req.body.price), stock = Number(req.body.stock);
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Product name must contain 2–120 characters." });
  if (description.length > 800) return res.status(400).json({ error: "Description must be at most 800 characters." });
  if (category.length < 2 || category.length > 60) return res.status(400).json({ error: "Category must contain 2–60 characters." });
  if (!Number.isFinite(price) || price <= 0 || price > 10000000) return res.status(400).json({ error: "Enter a valid price greater than zero." });
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return res.status(400).json({ error: "Stock must be a whole number from 0 to 100000." });
  try {
    const { data, error } = await supabase.from("products").insert({ vendor_id: req.user.sub, name, description, category, price: price.toFixed(2), stock }).select("id,name,description,category,price,stock,is_active,created_at").single();
    if (error) return dbError(res, error, "Could not add product.");
    return res.status(201).json({ product: data });
  } catch (error) { return dbError(res, error, "Could not add product."); }
});

router.delete("/vendor/products/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: "Invalid product ID." });
  try {
    const { data, error } = await supabase.from("products").update({ is_active: false }).eq("id", req.params.id).eq("vendor_id", req.user.sub).select("id").maybeSingle();
    if (error) return dbError(res, error, "Could not remove product.");
    if (!data) return res.status(404).json({ error: "Product was not found in your store." });
    return res.json({ message: "Product removed from the marketplace." });
  } catch (error) { return dbError(res, error, "Could not remove product."); }
});

router.post("/orders", requireAuth, requireRole("customer"), async (req, res) => {
  const address = cleanText(req.body.address), items = req.body.items;
  if (address.length < 8 || address.length > 300) return res.status(400).json({ error: "Delivery address must contain 8–300 characters." });
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) return res.status(400).json({ error: "An order must contain between 1 and 30 product lines." });
  const quantities = new Map();
  for (const item of items) {
    if (!item || !uuidPattern.test(String(item.product_id || "")) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 100) return res.status(400).json({ error: "Each order item needs a valid product ID and quantity from 1 to 100." });
    quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + Number(item.quantity));
  }
  try {
    const { data, error } = await supabase.rpc("place_marketplace_order", { p_customer_id: req.user.sub, p_delivery_address: address, p_items: [...quantities.entries()].map(([product_id, quantity]) => ({ product_id, quantity })) });
    if (error) {
      if (["P0001", "22023"].includes(error.code)) return res.status(400).json({ error: error.message || "The order could not be placed." });
      return dbError(res, error, "Could not place order. Check product stock and database setup.");
    }
    return res.status(201).json({ order: data });
  } catch (error) { return dbError(res, error, "Could not place order."); }
});

router.get("/orders/mine", requireAuth, requireRole("customer"), async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from("orders").select("id,total,status,created_at,order_items(quantity)").eq("customer_id", req.user.sub).order("created_at", { ascending: false }).limit(100);
    if (error) return dbError(res, error);
    return res.json({ orders: (orders || []).map(o => ({ ...o, item_count: (o.order_items || []).reduce((sum, item) => sum + item.quantity, 0), order_items: undefined })) });
  } catch (error) { return dbError(res, error); }
});

module.exports = router;
