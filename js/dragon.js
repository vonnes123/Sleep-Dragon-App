const Dragon = (() => {
  let canvas, ctx, sprite;
  let frame = 0,
    lastFrameTime = 0,
    loopCount = 0;
  let currentAnim = 0,
    nextAnim = null;
  let idleMode = "normal";
  let running = false;

  const FRAME_SIZE = 150;
  const FRAME_COUNT = 8;
  const FRAME_TIME = 1000 / 8;

  const ANIMS = {
    normal_idle: 0,
    scratch: 1,
    tired_idle: 2,
    yawn: 3,
    energetic_idle: 4,
    wiggle: 5,
    anticipate_food: 6,
    chew: 7,
    fall_asleep: 8,
    sleep: 9,
    wake_up: 10,
    level_up: 11,
  };

  const IDLE_ROWS = {
    normal: "normal_idle",
    tired: "tired_idle",
    energetic: "energetic_idle",
  };

  function setAnimation(name, loops = Infinity, returnAnim = null) {
    currentAnim = ANIMS[name];
    frame = 0;
    loopCount = 0;
    nextAnim = { loops, returnAnim };
  }

  function setIdle() {
    currentAnim = ANIMS[IDLE_ROWS[idleMode]];
    frame = 0;
    loopCount = 0;
    nextAnim = null;
  }

  function setMode(mode) {
    idleMode = mode;
    setIdle();
  }

  function handleIdleRandom() {
    if (nextAnim) return;
    const chance = Math.random();
    if (idleMode === "normal" && chance < 0.1)
      setAnimation("scratch", 1, IDLE_ROWS[idleMode]);
    if (idleMode === "tired" && chance < 0.1)
      setAnimation("yawn", 1, IDLE_ROWS[idleMode]);
    if (idleMode === "energetic" && chance < 0.1)
      setAnimation("wiggle", 1, IDLE_ROWS[idleMode]);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = frame * FRAME_SIZE;
    const sy = currentAnim * FRAME_SIZE;
    const dx = (canvas.width - FRAME_SIZE) / 2;
    const dy = (canvas.height - FRAME_SIZE) / 2;
    ctx.drawImage(
      sprite,
      sx,
      sy,
      FRAME_SIZE,
      FRAME_SIZE,
      dx,
      dy,
      FRAME_SIZE,
      FRAME_SIZE,
    );
  }

  function update(time) {
    if (!running) return;
    if (time - lastFrameTime > FRAME_TIME) {
      frame++;
      if (frame >= FRAME_COUNT) {
        frame = 0;
        loopCount++;
        if (nextAnim && loopCount >= nextAnim.loops) {
          nextAnim.returnAnim ? setAnimation(nextAnim.returnAnim) : setIdle();
        }
        handleIdleRandom();
      }
      lastFrameTime = time;
    }
    draw();
    requestAnimationFrame(update);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    sprite = new Image();
    sprite.src = "assets/dragon/dragon.png";
    sprite.onload = () => {
      running = true;
      setIdle();
      requestAnimationFrame(update);
    };
  }

  function stop() {
    running = false;
  }

  // Listen for commands from other tabs (remote control)
  const channel = new BroadcastChannel("dragon_control");
  channel.onmessage = async (e) => {
    const { type, payload } = e.data;
    if (type === "setMode") setMode(payload.mode);
    if (type === "setAnimation")
      setAnimation(payload.name, payload.loops, payload.next);
    if (type === "addFood") {
      await Progression.addFoodToStash(payload.food);
      renderHome();
    }
    if (type === "refreshHome") {
      await Progression.reload();
      renderHome();
    }
    if (type === "setEntry") {
      window.activeEntryIndex = payload.index;
      if (window.PageControllers?.["report-today"]?.refresh)
        window.PageControllers["report-today"].refresh();
      if (window.PageControllers?.["report-weekly"]?.refresh)
        window.PageControllers["report-weekly"].refresh();
      if (window.PageControllers?.["report-monthly"]?.refresh)
        window.PageControllers["report-monthly"].refresh();
    }
  };

  function getMode() {
    return idleMode;
  }

  // in the return:
  return { init, stop, setMode, getMode, setAnimation, setIdle, ANIMS };
})();
