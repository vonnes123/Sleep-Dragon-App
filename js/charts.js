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
        0: "rgba(208, 223, 245, 0.5)", // wake   — very pale blue
        1: "rgba(109, 168, 224, 0.6)", // rem    — medium blue
        2: "rgba(168, 196, 245, 0.5)", // light  — light blue
        3: "rgba(26,  58,  110, 0.7)", // deep   — dark navy
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

  return { renderCombinedChart, toggleLayer, renderDonutChart };
})();
