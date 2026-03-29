const DataLoader = (() => {
  let records = [];

  // ── Parse "HH:MM:SS" or "HH:MM" string to total minutes ──
  function timeToMinutes(str) {
    if (!str) return null;
    const parts = str.trim().split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  // ── Parse a single CSV row into a clean object ──
function parseRow(row) {
  return {
    date: row.toDate?.trim() || null,
    iso8601: row.ISO8601?.trim() || null,
    fromDate: row.fromDate?.trim() || null,
    bedtime: row.bedtime?.trim() || null,
    waketime: row.waketime?.trim() || null,
    inBed: timeToMinutes(row.inBed),
    awake: timeToMinutes(row.awake),
    fellAsleepIn: timeToMinutes(row.fellAsleepIn),
    sessions: parseInt(row.sessions) || null,
    asleep: timeToMinutes(row.asleep),
    asleepAvg7: timeToMinutes(row.asleepAvg7),
    efficiency: parseFloat(row.efficiency) || null,
    efficiencyAvg7: parseFloat(row.efficiencyAvg7) || null,
    quality: timeToMinutes(row.quality),
    qualityAvg7: timeToMinutes(row.qualityAvg7),
    deep: timeToMinutes(row.deep),
    deepAvg7: timeToMinutes(row.deepAvg7),
    sleepBPM: parseFloat(row.sleepBPM) || null,
    sleepBPMAvg7: parseFloat(row.sleepBPMAvg7) || null,
    dayBPM: parseFloat(row.dayBPM) || null,
    dayBPMAvg7: parseFloat(row.dayBPMAvg7) || null,
    wakingBPM: parseFloat(row.wakingBPM) || null,
    wakingBPMAvg7: parseFloat(row.wakingBPMAvg7) || null,
    hrv: parseFloat(row.hrv) || null,
    hrvAvg7: parseFloat(row.hrvAvg7) || null,
    sleepHRV: parseFloat(row.sleepHRV) || null,
    sleepHRVAvg7: parseFloat(row.sleepHRVAvg7) || null,
    spO2Avg: parseFloat(row.SpO2Avg) || null,
    spO2Min: parseFloat(row.SpO2Min) || null,
    spO2Max: parseFloat(row.SpO2Max) || null,
    respAvg: parseFloat(row.respAvg) || null,
    respMin: parseFloat(row.respMin) || null,
    respMax: parseFloat(row.respMax) || null,
    tags: row.tags?.trim() || null,
    notes: row.notes?.trim() || null,
  };
}

  // ── Load and parse the CSV ──
  async function init() {
    const res = await fetch("data/Sleep_data_2022.csv");
    const text = await res.text();

    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    records = lines
      .slice(1)
      .map((line) => {
        // Handle quoted fields (e.g. "Friday, Dec 31, 2021")
        const cols = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            cols.push(current);
            current = "";
          } else {
            current += char;
          }
        }
        cols.push(current);

        const row = {};
        headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
        return parseRow(row);
      })
      .filter((r) => r.date); // drop any empty rows
  }

  // ── Getters ──

  function getAll() {
    return records;
  }

  function getByDate(dateStr) {
    // dateStr e.g. "Sunday, Jan 2, 2022"
    return records.find((r) => r.date === dateStr) || null;
  }

  function getLast(n) {
    return records.slice(-n);
  }

  return { init, getAll, getByDate, getLast };
})();
