require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const apiRoutes = require("./routes/api");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.NODE_ENV === "production" ? false : true }));
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api", apiRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get("*path", (_req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "index.html")));
app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`MarketHub server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
