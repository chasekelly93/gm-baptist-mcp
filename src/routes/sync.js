const express = require("express");
const router = express.Router();
const { runSync } = require("../../sync");

router.get("/", async (_req, res) => {
  res.json({ message: "Sync started", timestamp: new Date().toISOString() });
  runSync().catch((err) => console.error("[sync] fatal:", err.message));
});

router.post("/", async (_req, res) => {
  res.json({ message: "Sync started", timestamp: new Date().toISOString() });
  runSync().catch((err) => console.error("[sync] fatal:", err.message));
});

module.exports = router;
