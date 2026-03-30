window.PageControllers = {
  home: {
    init() {
      const canvas = document.getElementById("petCanvas");

      requestAnimationFrame(() => {
        const slot = document.getElementById("dragon-slot");
        if (canvas && slot) {
          canvas.style.display = "block";
          canvas.style.opacity = "1";
          slot.appendChild(canvas);
        }
        renderHome();

        if (window._pendingPopup) {
          const { prevIndex, newIndex } = window._pendingPopup;
          window._pendingPopup = null;
          setTimeout(() => showSleepPopup(prevIndex, newIndex), 500);
        }
      });

      if (!canvas) return;

      canvas.addEventListener("dragover", (e) => e.preventDefault());

      canvas.addEventListener("drop", async (e) => {
        e.preventDefault();
        const id = parseFloat(e.dataTransfer.getData("foodId"));
        const item = await Progression.removeFoodFromStash(id);
        if (!item) return;
        const qualities = Progression.getQualities();
        const q = qualities.find((q) => q.name === item.quality);
        Dragon.setAnimation("chew", 2);
        const didLevelUp = await Progression.addXP(q.xp);
        if (didLevelUp) Dragon.setAnimation("level_up", 1);
        renderHome();
      });
    }
  },

  "pet-vitals": {
    init() {
      renderPetVitals();
    }
  },

  profile: {
    init() {
      const days = (window.activeEntryIndex ?? 49) + 1;
      const msgEl = document.getElementById("profile-days-msg");
      if (msgEl) {
        msgEl.textContent = `You have been taking care of Drago for ${days} days. Well Done!!!`;
      }
    }
  },

  "remote-control": {
    init() {
      const channel = new BroadcastChannel("dragon_control");

      document
        .getElementById("btnNextDayAdvance")
        .addEventListener("click", () => {
          if (currentEntry >= total - 1) return;
          const prevEntry = currentEntry;
          currentEntry++;
          window.activeEntryIndex = currentEntry;
          updateEntryLabel();
          channel.postMessage({
            type: "nextDay",
            payload: { prevIndex: prevEntry, newIndex: currentEntry }
          });
        });

      document.getElementById("btnGiveFood").addEventListener("click", () => {
        const food = Progression.randomFood();
        channel.postMessage({ type: "addFood", payload: { food } });
      });

      document
        .getElementById("btnSendNotification")
        .addEventListener("click", async () => {
          const message = getNudgeMessage();
          await sendSleepNudge();
          channel.postMessage({ type: "nudge", payload: { message } });
        });

      let currentEntry = window.activeEntryIndex ?? 49;
      const total = DataLoader.getAll().length;
      const entryLabel = document.getElementById("current-entry");

      function updateEntryLabel() {
        if (entryLabel)
          entryLabel.textContent = `Entry ${currentEntry + 1} of ${total}`;
      }

      updateEntryLabel();

      document.getElementById("btnPrevDay").addEventListener("click", () => {
        if (currentEntry <= 0) return;
        currentEntry--;
        window.activeEntryIndex = currentEntry;
        updateEntryLabel();
        channel.postMessage({
          type: "setEntry",
          payload: { index: currentEntry }
        });
      });

      document.getElementById("btnNextDay").addEventListener("click", () => {
        if (currentEntry >= total - 1) return;
        currentEntry++;
        window.activeEntryIndex = currentEntry;
        updateEntryLabel();
        channel.postMessage({
          type: "setEntry",
          payload: { index: currentEntry }
        });
      });

      document.querySelectorAll("[data-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          channel.postMessage({
            type: "setMode",
            payload: { mode: btn.dataset.mode }
          });
        });
      });

      document.querySelectorAll("[data-anim]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const loops =
            btn.dataset.loops === "Infinity"
              ? Infinity
              : parseInt(btn.dataset.loops);
          const next = btn.dataset.next || null;
          channel.postMessage({
            type: "setAnimation",
            payload: { name: btn.dataset.anim, loops, next }
          });
        });
      });
    }
  },

  report: {
    init() {
      const tabs = document.querySelectorAll(".report-tab");
      const view = document.getElementById("report-view");

      async function loadTab(tab) {
        tabs.forEach((t) =>
          t.classList.toggle("active", t.dataset.tab === tab)
        );
        const res = await fetch(`pages/report-${tab}.html`);
        view.innerHTML = await res.text();
        const controllerKey = `report-${tab}`;
        if (window.PageControllers?.[controllerKey]) {
          window.PageControllers[controllerKey].init();
        }
      }

      tabs.forEach((t) =>
        t.addEventListener("click", () => loadTab(t.dataset.tab))
      );
      loadTab("today");
    }
  },

  "report-today": {
    init() {
      this.refresh();
    },
    refresh() {
      const index = window.activeEntryIndex ?? 49;
      const record = DataLoader.getAll()[index];
      if (!record) return;

      const h = Math.floor(record.asleep / 60);
      const m = Math.round(record.asleep % 60);
      const durEl = document.getElementById("today-duration");
      if (durEl) durEl.textContent = `${h} hrs ${m} mins`;

      const legendEl = document.getElementById("today-legend");
      if (legendEl) {
        legendEl.className = "chart-legend legend-built";
        legendEl.innerHTML = `
          <div class="legend-built-item">
            <div class="legend-built-swatch" style="background:#1a3a6e;"></div>
            <span style="color:#555;">Deep</span>
          </div>
          <div class="legend-built-item">
            <div class="legend-built-swatch" style="background:#6da8e0;"></div>
            <span style="color:#555;">REM</span>
          </div>
          <div class="legend-built-item">
            <div class="legend-built-swatch" style="background:#a8c4f5;"></div>
            <span style="color:#555;">Light</span>
          </div>
          <div class="legend-built-item">
            <div class="legend-built-swatch" style="background:#d0dff5;border:1px solid #ccc;"></div>
            <span style="color:#555;">Wake</span>
          </div>
          <div class="legend-built-item">
            <div class="legend-built-line" style="background:#2ecc71;"></div>
            <span style="color:#2ecc71;">HRV (ms)</span>
          </div>
          <div class="legend-built-item">
            <div class="legend-built-line" style="background:#e05c7a;"></div>
            <span style="color:#e05c7a;">BPM</span>
          </div>
        `;
      }

      function updateSubtitle() {
        const subtitleEl = document.getElementById("chart-subtitle");
        if (!subtitleEl) return;
        subtitleEl.textContent = `Entry ${index + 1} · ${record.date} · Sleep stages simulated from nightly totals (NCBI NBK526132) · HRV avg ${record.sleepHRV}ms · BPM avg ${record.sleepBPM}`;
      }

      Charts.renderCombinedChart("chart-combined", record);
      updateSubtitle();
      Charts.renderDonutChart("chart-donut", record);

      const toggleState = { stages: true, hrv: true, bpm: true };
      const trackIds = {
        "track-stages": "stages",
        "track-hrv": "hrv",
        "track-bpm": "bpm"
      };

      Object.entries(trackIds).forEach(([trackId, layerName]) => {
        const track = document.getElementById(trackId);
        if (!track) return;
        track.addEventListener("click", () => {
          toggleState[layerName] = !toggleState[layerName];
          track.classList.toggle("on", toggleState[layerName]);
          Charts.toggleLayer(
            "chart-combined",
            layerName,
            toggleState[layerName]
          );
          updateSubtitle();
        });
      });

      const scoreEl = document.getElementById("quality-score");
      const messageEl = document.getElementById("quality-message");
      if (scoreEl && record.efficiency != null) {
        const score = Math.round(record.efficiency);
        scoreEl.textContent = `${score}%`;
        let msg = "";
        if (score >= 90)
          msg = `Sleep efficiency was ${score}% — excellent, keep it up!`;
        else if (score >= 80)
          msg = `Sleep efficiency was ${score}% — good night's rest.`;
        else if (score >= 70)
          msg = `Sleep efficiency was ${score}% — room to improve.`;
        else
          msg = `Sleep efficiency was ${score}% — try to get to bed earlier.`;
        if (messageEl) messageEl.textContent = msg;
      }
    }
  },

  "report-weekly": {
    init() {
      this.refresh();
    },
    refresh() {
      const index = window.activeEntryIndex ?? 49;
      const weekDays = Weekly.buildWeek(index);
      if (!weekDays) return;

      const allEff = weekDays
        .filter((d) => !d.isEmpty && d.efficiency != null)
        .map((d) => d.efficiency);
      const avgEff = allEff.length
        ? Math.round((allEff.reduce((s, v) => s + v, 0) / allEff.length) * 10) /
          10
        : null;

      const avgEl = document.getElementById("weekly-eff-avg");
      if (avgEl && avgEff != null) {
        avgEl.innerHTML = `
          <span class="avg-label">Avg efficiency (all days)</span><br>
          <span class="avg-value">${avgEff}%</span>
        `;
      }

      const subEl = document.getElementById("weekly-sleep-subtitle");
      if (subEl) {
        subEl.textContent = `Entry ${index + 1} is last night. Future entries use real dataset values shown as predictions.`;
      }

      let showStages = true,
        showHRV = true,
        showBPM = true;

      Charts.renderWeeklySleepChart(
        "chart-weekly-sleep",
        weekDays,
        showStages,
        showHRV,
        showBPM
      );
      Charts.renderWeeklyBedtimeChart("chart-weekly-bedtime", weekDays);
      Charts.renderWeeklyEfficiencyChart("chart-weekly-efficiency", weekDays);

      const toggleState = { stages: true, hrv: true, bpm: true };
      const trackIds = {
        "wtrack-stages": "stages",
        "wtrack-hrv": "hrv",
        "wtrack-bpm": "bpm"
      };

      Object.entries(trackIds).forEach(([trackId, layerName]) => {
        const track = document.getElementById(trackId);
        if (!track) return;
        track.addEventListener("click", () => {
          toggleState[layerName] = !toggleState[layerName];
          track.classList.toggle("on", toggleState[layerName]);
          if (layerName === "stages") showStages = toggleState[layerName];
          if (layerName === "hrv") showHRV = toggleState[layerName];
          if (layerName === "bpm") showBPM = toggleState[layerName];
          Charts.renderWeeklySleepChart(
            "chart-weekly-sleep",
            weekDays,
            showStages,
            showHRV,
            showBPM
          );
        });
      });
    }
  },

  "report-monthly": {
    init() {
      this.refresh();
    },
    refresh() {
      const index = window.activeEntryIndex ?? 49;
      const monthDays = Weekly.buildMonth(index);
      if (!monthDays) return;

      const currentDate = new Date(DataLoader.getAll()[index].date);
      const monthName = currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
      });

      const subEl = document.getElementById("monthly-sleep-subtitle");
      if (subEl) {
        subEl.textContent = `${monthName} · Entry ${index + 1} is last night · Max 7 days predicted ahead`;
      }

      const allEff = monthDays
        .filter((d) => !d.isEmpty && d.efficiency != null)
        .map((d) => d.efficiency);
      const avgEff = allEff.length
        ? Math.round((allEff.reduce((s, v) => s + v, 0) / allEff.length) * 10) /
          10
        : null;

      const avgEl = document.getElementById("monthly-eff-avg");
      if (avgEl && avgEff != null) {
        avgEl.innerHTML = `
          <span class="avg-label">Avg sleep efficiency so far</span><br>
          <span class="avg-value">${avgEff}%</span>
        `;
      }

      let showStages = true,
        showHRV = true,
        showBPM = true;

      Charts.renderMonthlySleepChart(
        "chart-monthly-sleep",
        monthDays,
        showStages,
        showHRV,
        showBPM
      );
      Charts.renderMonthlyBedtimeChart("chart-monthly-bedtime", monthDays);
      Charts.renderMonthlyEfficiencyChart(
        "chart-monthly-efficiency",
        monthDays
      );

      const toggleState = { stages: true, hrv: true, bpm: true };
      const trackIds = {
        "mtrack-stages": "stages",
        "mtrack-hrv": "hrv",
        "mtrack-bpm": "bpm"
      };

      Object.entries(trackIds).forEach(([trackId, layerName]) => {
        const track = document.getElementById(trackId);
        if (!track) return;
        track.addEventListener("click", () => {
          toggleState[layerName] = !toggleState[layerName];
          track.classList.toggle("on", toggleState[layerName]);
          if (layerName === "stages") showStages = toggleState[layerName];
          if (layerName === "hrv") showHRV = toggleState[layerName];
          if (layerName === "bpm") showBPM = toggleState[layerName];
          Charts.renderMonthlySleepChart(
            "chart-monthly-sleep",
            monthDays,
            showStages,
            showHRV,
            showBPM
          );
        });
      });
    }
  }
};

const NUDGE_MESSAGES = {
  common: [
    "Drago is hungry. A better night's sleep tonight could mean better food tomorrow.",
    "Drago is waiting. Rest well tonight and the quality of his meals could improve.",
    "A quiet room and an early bedtime tonight could change what Drago gets to eat tomorrow."
  ],
  rare: [
    "Drago noticed you rested well. Sleep a little longer tonight and the rewards could be even greater.",
    "You are close to earning something better. An early night tonight could make the difference.",
    "Drago is hopeful. A consistent bedtime tonight could bring a better reward tomorrow."
  ],
  epic: [
    "Drago is thriving. Keep your sleep consistent tonight to maintain the quality of your rewards.",
    "You are on a good streak. Protect your sleep tonight and Drago will be well fed tomorrow.",
    "Drago trusts you. A calm evening and early rest could keep the rewards coming."
  ],
  legendary: [
    "Drago is at his best. Protect your sleep tonight and the finest food could be yours tomorrow.",
    "You are sleeping at your peak. One more good night could keep Drago at his happiest.",
    "Drago is grateful. Stay consistent tonight and tomorrow's reward could be exceptional."
  ]
};

function getNudgeMessage() {
  const index = window.activeEntryIndex ?? 49;
  const record = DataLoader.getAll()[index];
  const quality = getQualityFromEfficiency(record?.efficiency);
  const messages = NUDGE_MESSAGES[quality] ?? NUDGE_MESSAGES.common;
  return messages[Math.floor(Math.random() * messages.length)];
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 5000);
}

async function sendSleepNudge() {
  const message = getNudgeMessage();

  // Try browser notification first
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Drago needs you", {
        body: message,
        icon: "assets/dragon/dragon-normal.png"
      });
      return;
    }
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("Drago needs you", {
          body: message,
          icon: "assets/dragon/dragon-normal.png"
        });
        return;
      }
    }
  }

  // Fallback — in-app toast
  showToast(message);
}

function renderHome() {
  const { level, xp, stash } = Progression.getState();
  const needed = Progression.xpToNext(level);
  const pct = Math.min((xp / needed) * 100, 100);

  const levelLabel = document.getElementById("level-label");
  const xpBar = document.getElementById("xp-bar");
  const xpFraction = document.getElementById("xp-fraction");
  const xpBadgeValue = document.getElementById("xp-badge-value");
  const xpBadgeNext = document.getElementById("xp-badge-next");
  const foodGrid = document.getElementById("food-grid");
  const foodEmpty = document.getElementById("food-empty");
  const foodCount = document.getElementById("food-count");

  if (!levelLabel && !xpBar && !foodGrid) return;

  if (levelLabel) levelLabel.textContent = `Level ${level}`;
  if (xpFraction) xpFraction.textContent = `${Math.round(xp)} / ${needed} XP`;
  if (xpBadgeValue) xpBadgeValue.textContent = `${Math.round(xp)} XP`;
  if (xpBadgeNext)
    xpBadgeNext.textContent = `Next: ${needed - Math.round(xp)} XP`;
  if (xpBar) xpBar.style.width = pct + "%";
  if (foodCount)
    foodCount.textContent = `${stash.length} item${stash.length !== 1 ? "s" : ""}`;

  if (!foodGrid) return;
  foodGrid.innerHTML = "";

  if (stash.length === 0) {
    if (foodEmpty) foodEmpty.style.display = "block";
    return;
  }
  if (foodEmpty) foodEmpty.style.display = "none";

  const qualities = Progression.getQualities();

  stash.forEach((item) => {
    const q = qualities.find((q) => q.name === item.quality);
    const div = document.createElement("div");
    div.className = "food-item";
    div.draggable = true;
    div.dataset.id = item.id;

    const img = document.createElement("img");
    img.src = `assets/food/food_${item.type}.png`;
    img.style.filter = `drop-shadow(0 0 6px ${q.color})`;
    div.appendChild(img);

    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("foodId", item.id);
      const ghost = div.cloneNode(true);
      ghost.style.position = "absolute";
      ghost.style.top = "-200px";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 24, 24);
      setTimeout(() => document.body.removeChild(ghost), 0);
      Dragon.setAnimation("anticipate_food", Infinity);
    });

    div.addEventListener("dragend", () => Dragon.setIdle());

    let touchClone = null;

    div.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.touches[0];
        touchClone = div.cloneNode(true);
        touchClone.style.cssText = `
        position: fixed;
        width: 64px; height: 64px;
        pointer-events: none;
        z-index: 1000;
        left: ${touch.clientX - 32}px;
        top:  ${touch.clientY - 32}px;
        opacity: 0.9;
      `;
        document.body.appendChild(touchClone);
        Dragon.setAnimation("anticipate_food", Infinity);
      },
      { passive: true },
    );

    div.addEventListener(
      "touchmove",
      (e) => {
        if (!touchClone) return; // not dragging — let scroll happen normally
        e.preventDefault(); // only block scroll when actually dragging food
        const touch = e.touches[0];
        touchClone.style.left = `${touch.clientX - 32}px`;
        touchClone.style.top = `${touch.clientY - 32}px`;
      },
      { passive: false },
    );

    div.addEventListener("touchend", async (e) => {
      if (touchClone) {
        document.body.removeChild(touchClone);
        touchClone = null;
      }
      const touch = e.changedTouches[0];
      const canvas = document.getElementById("petCanvas");
      const rect = canvas.getBoundingClientRect();
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        const removed = await Progression.removeFoodFromStash(item.id);
        if (!removed) return;
        const q2 = qualities.find((q) => q.name === removed.quality);
        Dragon.setAnimation("chew", 2);
        const didLevelUp = await Progression.addXP(q2.xp);
        if (didLevelUp) Dragon.setAnimation("level_up", 1);
        renderHome();
      } else {
        Dragon.setIdle();
      }
    });

    foodGrid.appendChild(div);
  });
}

function renderPetVitals() {
  const { level, foodHistory } = Progression.getState();
  const qualities = Progression.getQualities();

  const statusBox = document.getElementById("vitals-status-box");
  const dragonImg = document.getElementById("vitals-dragon-img");
  if (statusBox && dragonImg) {
    const mode = Dragon.getMode();
    const messages = {
      normal: "Today Drago is feeling Normal",
      tired: "Today Drago is feeling Tired",
      energetic: "Today Drago is feeling Energetic",
    };
    statusBox.textContent = messages[mode] || messages.normal;
    dragonImg.src = `assets/dragon/dragon-${mode || "normal"}.png`;
  }

  let pct = 0;
  if (level >= 20) pct = 100;
  else if (level >= 10) pct = ((level - 10) / 10) * 100;
  else pct = ((level - 1) / 9) * 100;

  const pctLabel = document.getElementById("evo-pct-label");
  const fillRect = document.getElementById("evo-fill-rect");

  if (pctLabel)
    pctLabel.innerHTML = `${Math.round(pct)}<span style="font-size:16px;">%</span>`;
  if (fillRect) {
    const fillHeight = (pct / 100) * 160;
    fillRect.setAttribute("y", 160 - fillHeight);
    fillRect.setAttribute("height", fillHeight);
  }

  const tipEl = document.getElementById("vitals-tip");
  if (tipEl) {
    let tip = "";
    if (level >= 20) {
      tip =
        "🎉 Your dragon has fully evolved! You're a sleep champion — keep it up!";
    } else if (level >= 10) {
      const remaining = 20 - level;
      tip = `✨ Your dragon has evolved once! Just ${remaining} more level${remaining > 1 ? "s" : ""} until the final evolution. Better sleep means more food for Drago!`;
    } else if (level >= 7) {
      const remaining = 10 - level;
      tip = `🔥 So close! Only ${remaining} more level${remaining > 1 ? "s" : ""} until your dragon evolves. Keep those sleep habits strong!`;
    } else if (level >= 4) {
      tip =
        "😴 Your dragon is growing! Consistent sleep will help Drago reach the next evolution sooner than you think.";
    } else {
      tip =
        "🌙 Your dragon's journey is just beginning. Good sleep tonight could bring Drago one step closer to evolving!";
    }
    tipEl.textContent = tip;
  }

  const grid = document.getElementById("food-history-grid");
  const empty = document.getElementById("food-history-empty");
  if (!grid) return;

  grid.innerHTML = "";

  if (foodHistory.length === 0) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  foodHistory.forEach((item) => {
    const q = qualities.find((q) => q.name === item.quality);
    const div = document.createElement("div");
    div.className = "food-item";

    const img = document.createElement("img");
    img.src = `assets/food/food_${item.type}.png`;
    img.style.filter = `drop-shadow(0 0 5px ${q.color})`;
    div.appendChild(img);
    grid.appendChild(div);
  });
}

function getQualityFromEfficiency(efficiency) {
  if (efficiency == null) return "common";
  if (efficiency >= 96) return "legendary";
  if (efficiency >= 89) return "epic";
  if (efficiency >= 80) return "rare";
  return "common";
}

function updateDragonMood() {
  const index = window.activeEntryIndex ?? 49;
  const record = DataLoader.getAll()[index];
  if (record) Dragon.setMoodFromEfficiency(record.efficiency);
}

function showSleepPopup(prevEntryIndex, newEntryIndex) {
  if (window._popupOpen) return;
  window._popupOpen = true;

  const record = DataLoader.getAll()[newEntryIndex];
  if (!record) return;

  const quality = getQualityFromEfficiency(record.efficiency);
  const foodTypes = ["apple", "fish", "chicken", "steak", "pizza"];
  const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)];

  const qualityColors = {
    common: "#B0B0B0",
    rare: "#3FA7FF",
    epic: "#9B59FF",
    legendary: "#FF9C1A",
  };
  const qualityLabels = {
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
  };

  const color = qualityColors[quality];
  window._pendingFood = {
    type: foodType,
    quality,
    id: Date.now() + Math.random(),
  };

  const eff = Math.round(record.efficiency ?? 0);
  document.getElementById("popup-title").textContent =
    `Last night you slept with ${eff}% efficiency. Because of that you are getting a ${qualityLabels[quality]} food item!`;

  const icon = document.getElementById("popup-food-icon");
  icon.src = `assets/food/food_${foodType}.png`;
  icon.style.filter = `drop-shadow(0 0 10px ${color})`;

  document.getElementById("popup-rarity-label").style.color = color;
  document.getElementById("popup-rarity-label").textContent =
    qualityLabels[quality];

  const popup = document.getElementById("sleep-popup");
  popup.classList.add("open");

  document.querySelectorAll(".smiley-btn").forEach((btn) => {
    btn.style.opacity = "0.5";
    btn.style.transform = "scale(1)";
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
  });

  document.querySelectorAll(".smiley-btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      btn.style.opacity = "1";
      btn.style.transform = "scale(1.2)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.opacity = "0.5";
      btn.style.transform = "scale(1)";
    });

    btn.addEventListener("click", async () => {
      window._popupOpen = false;
      const rating = btn.dataset.rating;

      document.querySelectorAll(".smiley-btn").forEach((b) => {
        b.style.opacity = "0.2";
        b.style.transform = "scale(1)";
      });
      btn.style.opacity = "1";
      btn.style.transform = "scale(1.3)";

      await new Promise((resolve) => setTimeout(resolve, 500));

      await SleepRatings.setRating(prevEntryIndex, rating);

      popup.classList.remove("open");

      if (window._pendingFood) {
        await Progression.addFoodToStash(window._pendingFood);
        window._pendingFood = null;
      }

      const newRecord = DataLoader.getAll()[newEntryIndex];
      Dragon.setAnimation("wake_up", 1);
      setTimeout(() => {
        Dragon.setMoodFromEfficiency(newRecord?.efficiency);
      }, 1500);

      renderHome();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await DataLoader.init();
  await Progression.init();
  await SleepRatings.init();
  Dragon.init(document.getElementById("petCanvas"));
  updateDragonMood();
  Router.init();
});
