const SleepRatings = (() => {
  let ratings = {};

  async function init() {
    const res = await fetch("data/sleep-ratings.json?t=" + Date.now());
    ratings = await res.json();
  }

  async function save() {
    await fetch("/save-ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ratings),
    });
  }

  async function setRating(entryIndex, rating) {
    ratings[entryIndex] = {
      entryIndex,
      rating,
      ratedAt: new Date().toISOString(),
    };
    await save();
  }

  function getRating(entryIndex) {
    return ratings[entryIndex] ?? null;
  }

  return { init, setRating, getRating };
})();
