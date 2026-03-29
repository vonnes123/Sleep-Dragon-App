const Progression = (() => {
  const FOOD_TYPES = ["apple", "fish", "chicken", "steak", "pizza"];

  const QUALITIES = [
    { name: "common", xp: 10, color: "#B0B0B0" },
    { name: "rare", xp: 25, color: "#3FA7FF" },
    { name: "epic", xp: 60, color: "#9B59FF" },
    { name: "legendary", xp: 150, color: "#FF9C1A" },
  ];

  let state = {
    level: 1,
    xp: 0,
    stash: [],
    foodHistory: [],
  };

  async function init() {
    const res = await fetch("data/dragon-state.json?t=" + Date.now());
    const data = await res.json();
    state.level = data.level ?? 1;
    state.xp = data.xp ?? 0;
    state.stash = data.stash ?? [];
    state.foodHistory = data.foodHistory ?? [];
  }

  async function reload() {
    const res = await fetch("data/dragon-state.json?t=" + Date.now());
    const data = await res.json();
    state.level = data.level ?? 1;
    state.xp = data.xp ?? 0;
    state.stash = data.stash ?? [];
    state.foodHistory = data.foodHistory ?? [];
  }

  async function save() {
    await fetch("/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  }

  function xpToNext(level) {
    return 25 * level * level;
  }

  async function addXP(amount) {
    state.xp += amount;
    let didLevelUp = false;
    while (state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level);
      state.level++;
      didLevelUp = true;
    }
    await save();
    return didLevelUp;
  }

  function randomFood() {
    const type = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    const quality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)];
    return { id: Date.now() + Math.random(), type, quality: quality.name };
  }

  async function addFoodToStash(food) {
    state.stash.push(food);
    await save();
  }

  async function removeFoodFromStash(id) {
    const item = state.stash.find((f) => f.id === id);
    if (!item) return null;
    state.stash = state.stash.filter((f) => f.id !== id);

    // Log to history, keep last 12
    state.foodHistory.unshift({ ...item, eatenAt: Date.now() });
    if (state.foodHistory.length > 12)
      state.foodHistory = state.foodHistory.slice(0, 12);

    await save();
    return item;
  }

  function getState() {
    return state;
  }
  function getQualities() {
    return QUALITIES;
  }

  return {
    init,
    reload,
    save,
    addXP,
    xpToNext,
    randomFood,
    addFoodToStash,
    removeFoodFromStash,
    getState,
    getQualities,
  };
})();
