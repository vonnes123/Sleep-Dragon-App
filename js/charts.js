const Charts = (() => {
  const instances = {};

  function destroyChart(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  const STAGE = { wake: 0, rem: 1, light: 2, deep: 3 };

  function simulateStages(record) {
    const totalSleepMin = record.asleep;
    const totalAwakeMin = record.awake;
    const deepMin = record.deep;
    const remMin = Math.round(totalSleepMin * 0.25);
    const numCycles = Math.max(3, Math.round(totalSleepMin / 95));

    const cycles = [];
    for (let c = 0; c < numCycles; c++) {
      const p = c / Math.max(1, numCycles - 1);
      cycles.push({
        deepWeight: Math.max(0, 1 - p * 1.4),
        remWeight: 0.2 + p * 0.8,
      });
    }

    const totalDeepW = cycles.reduce((s, c) => s + c.deepWeight, 0);
    const totalRemW = cycles.reduce((s, c) => s + c.remWeight, 0);

    cycles.forEach((c) => {
      c.deepMin = Math.round((c.deepWeight / totalDeepW) * deepMin);
      c.remMin = Math.round((c.remWeight / totalRemW) * remMin);
      c.lightMin = Math.max(
        5,
        Math.round(totalSleepMin / numCycles) - c.deepMin - c.remMin,
      );
    });

    const awakeBursts = [];
    let remainingAwake = totalAwakeMin;
    if (remainingAwake > 0) {
      const numBursts = Math.max(1, Math.round(remainingAwake / 3));
      for (let i = 0; i < numBursts; i++) {
        const burstMin = Math.round(remainingAwake / numBursts);
        const burstStart = Math.round(
          totalSleepMin * (0.4 + Math.random() * 0.55),
        );
        awakeBursts.push({ start: burstStart, duration: burstMin });
        remainingAwake -= burstMin;
      }
    }

    function isAwakeAt(m) {
      return awakeBursts.some((b) => m >= b.start && m < b.start + b.duration);
    }

    const timeline = [];
    let minute = 0;

    for (let c = 0; c < numCycles; c++) {
      const cy = cycles[c];
      for (let i = 0; i < 2 && minute < totalSleepMin; i++, minute++)
        timeline.push({
          minute,
          stage: isAwakeAt(minute) ? STAGE.wake : STAGE.light,
        });
      for (let i = 0; i < cy.deepMin && minute < totalSleepMin; i++, minute++)
        timeline.push({
          minute,
          stage: isAwakeAt(minute) ? STAGE.wake : STAGE.deep,
        });
      const lightBefore = Math.round(cy.lightMin * 0.6);
      for (let i = 0; i < lightBefore && minute < totalSleepMin; i++, minute++)
        timeline.push({
          minute,
          stage: isAwakeAt(minute) ? STAGE.wake : STAGE.light,
        });
      for (let i = 0; i < cy.remMin && minute < totalSleepMin; i++, minute++)
        timeline.push({
          minute,
          stage: isAwakeAt(minute) ? STAGE.wake : STAGE.rem,
        });
      const lightAfter = cy.lightMin - lightBefore;
      for (let i = 0; i < lightAfter && minute < totalSleepMin; i++, minute++)
        timeline.push({
          minute,
          stage: isAwakeAt(minute) ? STAGE.wake : STAGE.light,
        });
    }

    while (minute < totalSleepMin) {
      timeline.push({ minute, stage: STAGE.light });
      minute++;
    }

    return timeline;
  }

  function generateTimeLabels(record, step = 10) {
    const bedtime = new Date(record.bedtime);
    const labels = [];
    for (let m = 0; m <= record.asleep; m += step) {
      const t = new Date(bedtime.getTime() + m * 60000);
      labels.push(
        `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      );
    }
    return labels;
  }

  function downsample(timeline, step = 10) {
    const result = [];
    for (let m = 0; m < timeline.length; m += step) result.push(timeline[m]);
    return result;
  }

  function simulateHRV(timeline, avgHRV, step = 10) {
    return downsample(timeline, step).map((p) => {
      let base = avgHRV;
      if (p.stage === STAGE.deep) base = avgHRV * 1.3;
      if (p.stage === STAGE.light) base = avgHRV * 1.1;
      if (p.stage === STAGE.rem) base = avgHRV * 0.82;
      if (p.stage === STAGE.wake) base = avgHRV * 0.75;
      return (
        Math.round((base + (Math.random() - 0.5) * avgHRV * 0.08) * 10) / 10
      );
    });
  }

  function simulateBPM(timeline, avgBPM, step = 10) {
    return downsample(timeline, step).map((p) => {
      let base = avgBPM;
      if (p.stage === STAGE.deep) base = avgBPM * 0.78;
      if (p.stage === STAGE.light) base = avgBPM * 0.92;
      if (p.stage === STAGE.rem) base = avgBPM * 1.08;
      if (p.stage === STAGE.wake) base = avgBPM * 1.12;
      return (
        Math.round((base + (Math.random() - 0.5) * avgBPM * 0.04) * 10) / 10
      );
    });
  }

  const hypnoFillPlugin = {
    id: "hypnoFill",
    beforeDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (meta.hidden) return;

      const { ctx, scales } = chart;
      const yScale = scales["yStage"];
      const xScale = scales["x"];
      if (!yScale || !xScale) return;

      const stageColors = {
        0: "rgba(208, 223, 245, 0.5)",
        1: "rgba(109, 168, 224, 0.6)",
        2: "rgba(168, 196, 245, 0.5)",
        3: "rgba(26,  58,  110, 0.7)",
      };

      const bottom = yScale.getPixelForValue(3.5);
      const data = chart.data.datasets[0].data;

      meta.data.forEach((point, i) => {
        if (i === meta.data.length - 1) return;
        const x1 = point.x;
        const x2 = meta.data[i + 1].x;
        const stage = data[i];
        const top = point.y;

        ctx.save();
        ctx.fillStyle = stageColors[stage] ?? "rgba(109,168,224,0.3)";
        ctx.fillRect(x1, top, x2 - x1, bottom - top);
        ctx.restore();
      });
    },
  };

  function renderCombinedChart(canvasId, record) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const timeline = simulateStages(record);
    const labels = generateTimeLabels(record, 10);
    const stageData = downsample(timeline, 10).map((p) => p.stage);
    const hrvData = simulateHRV(timeline, record.sleepHRV, 10);
    const bpmData = simulateBPM(timeline, record.sleepBPM, 10);

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sleep Stages",
            data: stageData,
            stepped: "before",
            tension: 0,
            fill: false,
            borderColor: "rgba(109, 168, 224, 0.8)",
            borderWidth: 1.5,
            pointRadius: 0,
            yAxisID: "yStage",
            order: 3,
          },
          {
            label: "HRV",
            data: hrvData,
            borderColor: "#2ecc71",
            backgroundColor: "transparent",
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            yAxisID: "yRight",
            order: 1,
          },
          {
            label: "BPM",
            data: bpmData,
            borderColor: "#e05c7a",
            backgroundColor: "transparent",
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            yAxisID: "yRight",
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "Sleep Stages") {
                  return ` Stage: ${["Wake", "REM", "Light", "Deep"][ctx.raw] ?? "?"}`;
                }
                return ` ${ctx.dataset.label}: ${ctx.raw}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, color: "#888", font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          yStage: {
            position: "left",
            min: -0.5,
            max: 3.5,
            reverse: true,
            ticks: {
              stepSize: 1,
              font: { size: 10, weight: "600" },
              callback: (v) =>
                ["Wake", "REM", "Light", "Deep"][Math.round(v)] ?? "",
              color: "#888",
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          yRight: {
            position: "right",
            title: {
              display: true,
              text: "HRV (ms) / BPM",
              color: "#aaa",
              font: { size: 10 },
            },
            ticks: {
              font: { size: 10 },
              color: "#888",
              callback: (v) => v,
            },
            grid: { drawOnChartArea: false },
          },
        },
      },
      plugins: [hypnoFillPlugin],
    });

    instances[canvasId] = chart;
    return chart;
  }

  function toggleLayer(canvasId, layerName, visible) {
    const chart = instances[canvasId];
    if (!chart) return;

    const labelMap = {
      stages: "Sleep Stages",
      hrv: "HRV",
      bpm: "BPM",
    };

    const idx = chart.data.datasets.findIndex(
      (d) => d.label === labelMap[layerName],
    );
    if (idx === -1) return;

    const meta = chart.getDatasetMeta(idx);
    meta.hidden = !visible;

    const hrvIdx = chart.data.datasets.findIndex((d) => d.label === "HRV");
    const bpmIdx = chart.data.datasets.findIndex((d) => d.label === "BPM");
    const hrvHidden = chart.getDatasetMeta(hrvIdx).hidden;
    const bpmHidden = chart.getDatasetMeta(bpmIdx).hidden;
    chart.options.scales.yRight.display = !hrvHidden || !bpmHidden;

    chart.update("none");
  }

  function renderDonutChart(canvasId, record) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const totalSleep = record.asleep;
    const deep = record.deep ?? 0;
    const rem = Math.round(totalSleep * 0.25);
    const awake = record.awake ?? 0;
    const light = Math.max(0, totalSleep - deep - rem);

    function fmtMin(m) {
      const h = Math.floor(m / 60);
      const n = Math.round(m % 60);
      return h > 0 ? `${h}h ${n}m` : `${n}m`;
    }

    instances[canvasId] = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: [
          `Deep — ${fmtMin(deep)}`,
          `REM — ${fmtMin(rem)}`,
          `Light — ${fmtMin(light)}`,
          `Awake — ${fmtMin(awake)}`,
        ],
        datasets: [
          {
            data: [deep, rem, light, awake],
            backgroundColor: ["#1a3a6e", "#6da8e0", "#a8c4f5", "#d0dff5"],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        animation: { duration: 600, easing: "easeInOutQuart" },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#555",
              font: { size: 11 },
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.label}` },
          },
        },
      },
      plugins: [
        {
          id: "centerText",
          beforeDraw(chart) {
            const { width, height, ctx } = chart;
            ctx.save();
            const h = Math.floor(totalSleep / 60);
            const m = Math.round(totalSleep % 60);
            ctx.fillStyle = "#111";
            ctx.font = `bold ${Math.round(height / 8)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${h}h ${m}m`, width / 2, height / 2 - 10);
            ctx.fillStyle = "#888";
            ctx.font = `${Math.round(height / 14)}px sans-serif`;
            ctx.fillText("total sleep", width / 2, height / 2 + 14);
            ctx.restore();
          },
        },
      ],
    });
  }

  // ── Weekly Sleep Stages + HRV + BPM ──
  function renderWeeklySleepChart(
    canvasId,
    weekDays,
    showStages,
    showHRV,
    showBPM,
  ) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = weekDays.map((d) => d.date);

    function stageDataset(field, color, predColor, label) {
      return {
        label,
        data: weekDays.map((d) =>
          d[field] != null ? Math.round(d[field]) : 0,
        ),
        backgroundColor: weekDays.map((d) =>
          d.isPrediction ? predColor : color,
        ),
        borderRadius: 3,
        stack: "sleep",
        type: "bar",
      };
    }

    const lightData = weekDays.map((d) => {
      if (d.asleep == null) return 0;
      return Math.round(Math.max(0, d.asleep - (d.deep ?? 0) - (d.rem ?? 0)));
    });

    const datasets = [];

    if (showStages) {
      datasets.push(
        { ...stageDataset("deep", "#1a3a6e", "#8B5A00", "Deep"), order: 2 },
        { ...stageDataset("rem", "#6da8e0", "#FFB347", "REM"), order: 2 },
        {
          label: "Light",
          type: "bar",
          data: lightData,
          backgroundColor: weekDays.map((d) =>
            d.isPrediction ? "#FFD580" : "#a8c4f5",
          ),
          borderRadius: 3,
          stack: "sleep",
        },
      );
    }

    if (showHRV) {
      datasets.push({
        label: "HRV",
        type: "line",
        data: weekDays.map((d) =>
          d.sleepHRV != null ? Math.round(d.sleepHRV * 10) / 10 : null,
        ),
        borderColor: "#2ecc71",
        pointBackgroundColor: weekDays.map((d) =>
          d.isPrediction ? "white" : "#2ecc71",
        ),
        pointBorderColor: "#2ecc71",
        pointRadius: 5,
        pointBorderWidth: weekDays.map((d) => (d.isPrediction ? 2 : 0)),
        tension: 0.4,
        fill: false,
        yAxisID: "yRight",
        spanGaps: true,
        order: 0,
        segment: {
          borderDash: (ctx) =>
            weekDays[ctx.p1DataIndex]?.isPrediction ? [4, 4] : [],
        },
      });
    }

    if (showBPM) {
      datasets.push({
        label: "BPM",
        type: "line",
        data: weekDays.map((d) =>
          d.sleepBPM != null ? Math.round(d.sleepBPM * 10) / 10 : null,
        ),
        borderColor: "#e05c7a",
        pointBackgroundColor: weekDays.map((d) =>
          d.isPrediction ? "white" : "#e05c7a",
        ),
        pointBorderColor: "#e05c7a",
        pointRadius: 5,
        pointBorderWidth: weekDays.map((d) => (d.isPrediction ? 2 : 0)),
        tension: 0.4,
        fill: false,
        yAxisID: "yRight",
        spanGaps: true,
        order: 0,
        segment: {
          borderDash: (ctx) =>
            weekDays[ctx.p1DataIndex]?.isPrediction ? [4, 4] : [],
        },
      });
    }

    const chart = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "HRV") return ` HRV: ${ctx.raw}ms`;
                if (ctx.dataset.label === "BPM") return ` BPM: ${ctx.raw}`;
                const h = Math.floor(ctx.raw / 60);
                const m = ctx.raw % 60;
                return ` ${ctx.dataset.label}: ${h}h ${m}m`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#888", font: { size: 10 } },
            grid: { display: false },
          },
          y: {
            stacked: true,
            ticks: {
              color: "#888",
              font: { size: 10 },
              callback: (v) => `${Math.floor(v / 60)}h`,
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          yRight: {
            display: showHRV || showBPM,
            position: "right",
            ticks: { color: "#888", font: { size: 10 } },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    instances[canvasId] = chart;
    return chart;
  }

  // ── Weekly Bedtime Chart ──
function renderWeeklyBedtimeChart(canvasId, weekDays) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = weekDays.map((d) => d.date);

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Bedtime",
          data: weekDays.map((d) =>
            d.bedtimeHour != null
              ? Math.round(d.bedtimeHour * 100) / 100
              : null,
          ),
          borderColor: weekDays.map((d) =>
            d.isPrediction ? "#8B4513" : "#1a3a6e",
          ),
          pointBackgroundColor: weekDays.map((d) =>
            d.isPrediction ? "#8B4513" : "#1a3a6e",
          ),
          pointBorderColor: weekDays.map((d) =>
            d.isPrediction ? "#8B4513" : "#1a3a6e",
          ),
          pointRadius: 5,
          pointBorderWidth: 0,
          tension: 0.4,
          fill: false,
          spanGaps: true,
          segment: {
            borderColor: (ctx) =>
              weekDays[ctx.p1DataIndex]?.isPrediction ? "#8B4513" : "#1a3a6e",
          },
        },
        {
          label: "Fall Asleep",
          data: weekDays.map((d) => {
            if (d.bedtimeHour == null || d.fellAsleepIn == null) return null;
            return (
              Math.round((d.bedtimeHour + d.fellAsleepIn / 60) * 100) / 100
            );
          }),
          borderColor: weekDays.map((d) =>
            d.isPrediction ? "#FFB347" : "#a8c4f5",
          ),
          pointBackgroundColor: weekDays.map((d) =>
            d.isPrediction ? "#FFB347" : "#a8c4f5",
          ),
          pointBorderColor: weekDays.map((d) =>
            d.isPrediction ? "#FFB347" : "#a8c4f5",
          ),
          pointRadius: 5,
          pointBorderWidth: 0,
          tension: 0.4,
          fill: false,
          spanGaps: true,
          segment: {
            borderColor: (ctx) =>
              weekDays[ctx.p1DataIndex]?.isPrediction ? "#FFB347" : "#a8c4f5",
          },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const h = ctx.raw;
              if (h == null) return null;
              const norm = h >= 24 ? h - 24 : h;
              const hh = Math.floor(norm);
              const mm = Math.round((norm - hh) * 60);
              return ` ${ctx.dataset.label}: ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#888", font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#888",
            font: { size: 10 },
            callback: (v) => {
              const norm = v >= 24 ? v - 24 : v;
              const hh = Math.floor(norm);
              const mm = Math.round((norm - hh) * 60);
              return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
            },
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    },
  });

  instances[canvasId] = chart;
  return chart;
}

  // ── Weekly Efficiency Histogram ──
function renderWeeklyEfficiencyChart(canvasId, weekDays) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = weekDays.map((d) => d.date);
  const effData = weekDays.map((d) =>
    d.efficiency != null ? Math.round(d.efficiency * 10) / 10 : null,
  );

  // Average includes all days with data (actual + predicted)
  const allVals = effData.filter((v) => v != null);
  const avg = allVals.length
    ? Math.round((allVals.reduce((s, v) => s + v, 0) / allVals.length) * 10) /
      10
    : null;

  instances[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Efficiency",
          data: effData,
          backgroundColor: weekDays.map((d) =>
            d.isPrediction ? "#FFB347" : "#4f7cff",
          ),
          borderRadius: 3,
          order: 1,
        },
        {
          label: "Average",
          data: weekDays.map(() => avg),
          type: "line",
          borderColor: "#e05c7a",
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === "Average") return ` Avg: ${ctx.raw}%`;
              return ` Efficiency: ${ctx.raw}%`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#888", font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          min: 70,
          max: 100,
          ticks: {
            color: "#888",
            font: { size: 10 },
            callback: (v) => `${v}%`,
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    },
  });
}

  return {
    renderCombinedChart,
    toggleLayer,
    renderDonutChart,
    renderWeeklySleepChart,
    renderWeeklyBedtimeChart,
    renderWeeklyEfficiencyChart,
  };
})();
