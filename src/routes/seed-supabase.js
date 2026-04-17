const express = require("express");
const router = express.Router();
const { seedSupabase } = require("../../seed-supabase");

router.get("/", async (_req, res) => {
  res.json({ message: "Supabase seed started", timestamp: new Date().toISOString() });
  seedSupabase().catch((err) => console.error("[seed-supabase] fatal:", err.message));
});

router.post("/", async (_req, res) => {
  res.json({ message: "Supabase seed started", timestamp: new Date().toISOString() });
  seedSupabase().catch((err) => console.error("[seed-supabase] fatal:", err.message));
});

module.exports = router;
