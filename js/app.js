window.PageControllers = {
  home: {
    init() {
      const canvas = document.getElementById("petCanvas");
      canvas.style.display = "block";
      document.getElementById("dragon-slot").appendChild(canvas);

      renderHome();

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
    },
  },

  "remote-control": {
    init() {
      const channel = new BroadcastChannel("dragon_control");

      document.getElementById("btnGiveFood").addEventListener("click", () => {
        const food = Progression.randomFood();
        channel.postMessage({ type: "addFood", payload: { food } });
        console.log("[RC] requested food:", food);
      });

      document.querySelectorAll("[data-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          channel.postMessage({
            type: "setMode",
            payload: { mode: btn.dataset.mode },
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
            payload: { name: btn.dataset.anim, loops, next },
          });
        });
      });
    },
  },

  report: {
    init() {
      const tabs = document.querySelectorAll(".report-tab");
      const view = document.getElementById("report-view");

      async function loadTab(tab) {
        tabs.forEach((t) =>
          t.classList.toggle("active", t.dataset.tab === tab),
        );
        const res = await fetch(`pages/report-${tab}.html`);
        view.innerHTML = await res.text();
      }

      tabs.forEach((t) =>
        t.addEventListener("click", () => loadTab(t.dataset.tab)),
      );
      loadTab("today");
    },
  },
};

function renderHome() {
  const { level, xp, stash } = Progression.getState();
  const needed = Progression.xpToNext(level);
  const pct = Math.min((xp / needed) * 100, 100);

  const levelLabel = document.getElementById("level-label");
  const xpBar = document.getElementById("xp-bar");
  const foodGrid = document.getElementById("food-grid");

  if (levelLabel)
    levelLabel.textContent = `Level ${level} — ${Math.round(pct)}% to next`;
  if (xpBar) xpBar.style.width = pct + "%";

  if (!foodGrid) return;

  const qualities = Progression.getQualities();

  // ── Remove items no longer in stash ──
  Array.from(foodGrid.children).forEach((child) => {
    const stillExists = stash.find((i) => String(i.id) === child.dataset.id);
    if (!stillExists) {
      child.style.transition = "transform 0.2s ease, opacity 0.2s ease";
      child.style.transform = "scale(0)";
      child.style.opacity = "0";
      setTimeout(() => child.remove(), 200);
    }
  });

  // ── Add new items not yet in the grid ──
  stash.forEach((item) => {
    const existing = foodGrid.querySelector(`[data-id="${item.id}"]`);
    if (existing) return; // already rendered, skip

    const q = qualities.find((q) => q.name === item.quality);
    const div = document.createElement("div");
    div.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      cursor: grab;
      width: 48px; height: 48px;
      transform: scale(0);
      opacity: 0;
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
    `;
    div.draggable = true;
    div.dataset.id = item.id;

    const img = document.createElement("img");
    img.src = `assets/food/food_${item.type}.png`;
    img.style.cssText = `
      width: 100%; height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
      filter: drop-shadow(0 0 6px ${q.color});
      pointer-events: none;
    `;
    div.appendChild(img);

    // ── Mouse drag ──
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("foodId", item.id);
      const ghost = div.cloneNode(true);
      ghost.style.position = "absolute";
      ghost.style.top = "-200px";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 24, 24);
      setTimeout(() => document.body.removeChild(ghost), 0);
    });

    // ── Touch drag ──
    let touchClone = null;

    div.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.touches[0];
        touchClone = div.cloneNode(true);
        touchClone.style.cssText = `
        position: fixed;
        width: 48px; height: 48px;
        pointer-events: none;
        z-index: 1000;
        left: ${touch.clientX - 24}px;
        top:  ${touch.clientY - 24}px;
      `;
        document.body.appendChild(touchClone);
      },
      { passive: true },
    );

    div.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touchClone) {
          touchClone.style.left = `${touch.clientX - 24}px`;
          touchClone.style.top = `${touch.clientY - 24}px`;
        }
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
      }
    });

    foodGrid.appendChild(div);

    // Trigger entrance animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        div.style.transform = "scale(1)";
        div.style.opacity = "1";
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await DataLoader.init();
  await Progression.init();
  Dragon.init(document.getElementById("petCanvas"));
  Router.init();
});
