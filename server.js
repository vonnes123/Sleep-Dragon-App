const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("."));

// Save dragon state back to JSON
app.post("/save-state", (req, res) => {
  const filePath = path.join(__dirname, "data", "dragon-state.json");
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) {
      console.error("[Server] Failed to save state:", err);
      return res.status(500).json({ ok: false });
    }
    console.log("[Server] State saved");
    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Sleep Dragon running at http://localhost:${PORT}`);
});
