const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("."));

let isSavingState = false;
let isSavingRatings = false;

app.post("/save-state", (req, res) => {
  if (isSavingState) {
    return res.status(429).json({ ok: false, reason: "busy" });
  }
  isSavingState = true;
  const filePath = path.join(__dirname, "data", "dragon-state.json");
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    isSavingState = false;
    if (err) {
      console.error("[Server] Failed to save state:", err);
      return res.status(500).json({ ok: false });
    }
    console.log("[Server] State saved");
    res.json({ ok: true });
  });
});

app.post("/save-ratings", (req, res) => {
  if (isSavingRatings) {
    return res.status(429).json({ ok: false, reason: "busy" });
  }
  isSavingRatings = true;
  const filePath = path.join(__dirname, "data", "sleep-ratings.json");
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    isSavingRatings = false;
    if (err) {
      console.error("[Server] Failed to save ratings:", err);
      return res.status(500).json({ ok: false });
    }
    console.log("[Server] Ratings saved");
    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Sleep Dragon running at http://localhost:${PORT}`);
});
