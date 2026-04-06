const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok", name: "gm-baptist-mcp", version: "1.1.0" });
});

module.exports = router;
