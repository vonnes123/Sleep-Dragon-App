const Weekly = (() => {
  function getMondayOf(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function toDateKey(date) {
    return date.toISOString().split("T")[0];
  }

  function parseBedtimeHour(bedtimeStr) {
    if (!bedtimeStr) return null;
    const parts = bedtimeStr.split(" ");
    const timeParts = parts[1]?.split(":");
    if (!timeParts) return null;
    let h = parseInt(timeParts[0]);
    const m = parseInt(timeParts[1]);
    if (h < 12) h += 24;
    return h + m / 60;
  }

  function calcFellAsleepIn(record) {
    if (record.inBed != null && record.asleep != null) {
      return Math.max(0, record.inBed - record.asleep);
    }
    return null;
  }

  function findSameWeekdayEntries(records, weekday, beforeIndex, count = 3) {
    const results = [];
    for (let i = beforeIndex - 1; i >= 0 && results.length < count; i--) {
      const r = records[i];
      if (!r.date) continue;
      const d = new Date(r.date);
      const recordWeekday = d.toLocaleDateString("en-US", { weekday: "long" });
      if (recordWeekday === weekday) results.push(r);
    }
    return results;
  }

  function avgField(records, field) {
    const vals = records
      .map((r) => r[field])
      .filter((v) => v != null && !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  function buildPrediction(records, targetDate, currentIndex) {
    const weekday = targetDate.toLocaleDateString("en-US", { weekday: "long" });
    const similar = findSameWeekdayEntries(records, weekday, currentIndex, 3);
    if (!similar.length) return null;

    const fellAsleepVals = similar
      .map((r) => calcFellAsleepIn(r))
      .filter((v) => v != null);
    const avgFellAsleep = fellAsleepVals.length
      ? fellAsleepVals.reduce((s, v) => s + v, 0) / fellAsleepVals.length
      : null;

    return {
      date: targetDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      dateKey: toDateKey(targetDate),
      weekday,
      isPrediction: true,
      asleep: avgField(similar, "asleep"),
      deep: avgField(similar, "deep"),
      rem: similar.reduce((s, r) => s + r.asleep * 0.25, 0) / similar.length,
      sleepHRV: avgField(similar, "sleepHRV"),
      sleepBPM: avgField(similar, "sleepBPM"),
      efficiency: avgField(similar, "efficiency"),
      bedtimeHour: (() => {
        const vals = similar
          .map((r) => parseBedtimeHour(r.bedtime))
          .filter((v) => v != null);
        return vals.length
          ? vals.reduce((s, v) => s + v, 0) / vals.length
          : null;
      })(),
      fellAsleepIn: avgFellAsleep,
    };
  }

  function buildWeek(activeIndex) {
    const records = DataLoader.getAll();
    const current = records[activeIndex];
    if (!current) return null;

    const currentDate = new Date(current.date);
    const monday = getMondayOf(currentDate);

    const byDateKey = {};
    records.forEach((r, i) => {
      if (!r.date) return;
      const key = toDateKey(new Date(r.date));
      byDateKey[key] = { record: r, index: i };
    });

    const todayKey = toDateKey(currentDate);
    const weekDays = [];

    for (let d = 0; d < 7; d++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + d);
      const key = toDateKey(day);
      const isToday = key === todayKey;
      const isPast = key <= todayKey;

      if (isPast && byDateKey[key]) {
        const { record } = byDateKey[key];
        weekDays.push({
          date: day.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          dateKey: key,
          weekday: day.toLocaleDateString("en-US", { weekday: "long" }),
          isPrediction: false,
          isToday,
          asleep: record.asleep,
          deep: record.deep,
          rem: Math.round(record.asleep * 0.25),
          sleepHRV: record.sleepHRV,
          sleepBPM: record.sleepBPM,
          efficiency: record.efficiency,
          bedtimeHour: parseBedtimeHour(record.bedtime),
          fellAsleepIn: calcFellAsleepIn(record),
        });
      } else {
        const pred = buildPrediction(records, day, activeIndex);
        if (pred) {
          pred.isToday = isToday;
          weekDays.push(pred);
        } else {
          weekDays.push({
            date: day.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            dateKey: key,
            weekday: day.toLocaleDateString("en-US", { weekday: "long" }),
            isPrediction: true,
            isToday,
            asleep: null,
            deep: null,
            rem: null,
            sleepHRV: null,
            sleepBPM: null,
            efficiency: null,
            bedtimeHour: null,
            fellAsleepIn: null,
          });
        }
      }
    }

    // Build up to 7 days ahead predictions — stored for later use
    const futurePredictions = [];
    for (let d = 1; d <= 7; d++) {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() + d);
      const key = toDateKey(day);

      if (!byDateKey[key]) {
        const pred = buildPrediction(records, day, activeIndex);
        if (pred) futurePredictions.push(pred);
      } else {
        const { record } = byDateKey[key];
        futurePredictions.push({
          date: day.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          dateKey: key,
          weekday: day.toLocaleDateString("en-US", { weekday: "long" }),
          isPrediction: false,
          asleep: record.asleep,
          deep: record.deep,
          rem: Math.round(record.asleep * 0.25),
          sleepHRV: record.sleepHRV,
          sleepBPM: record.sleepBPM,
          efficiency: record.efficiency,
          bedtimeHour: parseBedtimeHour(record.bedtime),
          fellAsleepIn: calcFellAsleepIn(record),
        });
      }
    }

    window.futurePredictions = futurePredictions;
    return weekDays;
  }

  function formatHour(h) {
    if (h == null) return "--";
    const norm = h >= 24 ? h - 24 : h;
    const hh = Math.floor(norm);
    const mm = Math.round((norm - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }


  
  return { buildWeek, formatHour };
})();
