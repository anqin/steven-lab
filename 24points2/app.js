/* ==========================================================================
   24 Points · AI Player
   Game state, interaction, countdown, exact solver presentation.
   ========================================================================== */

(function () {
  "use strict";

  const math = window.TFMath;
  if (!math) {
    console.error("TFMath solver was not loaded.");
    return;
  }

  const { Fraction, solve, renderExpression, operatorSymbol } = math;
  const TARGET = 24;
  const MIN_SECONDS = 1;
  const MAX_SECONDS = 600;
  const INITIAL_SECONDS = 30;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 56;
  const MINI_TIMER_CIRCUMFERENCE = 2 * Math.PI * 12;

  const RANK_META = Object.freeze({
    0: { face: "0", alt: "JOKER", name: "零" },
    1: { face: "A", alt: "1", name: "A" },
    2: { face: "2", alt: "", name: "2" },
    3: { face: "3", alt: "", name: "3" },
    4: { face: "4", alt: "", name: "4" },
    5: { face: "5", alt: "", name: "5" },
    6: { face: "6", alt: "", name: "6" },
    7: { face: "7", alt: "", name: "7" },
    8: { face: "8", alt: "", name: "8" },
    9: { face: "9", alt: "", name: "9" },
    10: { face: "10", alt: "", name: "10" },
    11: { face: "J", alt: "11", name: "J" },
    12: { face: "Q", alt: "12", name: "Q" },
    13: { face: "K", alt: "13", name: "K" },
  });

  const SUITS = Object.freeze([
    { symbol: "♠", color: "black", name: "黑桃" },
    { symbol: "♥", color: "red", name: "红桃" },
    { symbol: "♦", color: "red", name: "方块" },
    { symbol: "♣", color: "black", name: "梅花" },
  ]);

  const OPS = Object.freeze({
    "+": { label: "加", symbol: "+" },
    "-": { label: "减", symbol: "−" },
    "*": { label: "乘", symbol: "×" },
    "/": { label: "除", symbol: "÷" },
  });

  const els = {
    aboutBtn: byId("aboutBtn"),
    helpBtn: byId("helpBtn"),
    exitBtn: byId("exitBtn"),
    stateBadge: byId("stateBadge"),
    stateBadgeText: byId("stateBadgeText"),
    roundNumber: byId("roundNumber"),
    roundTitle: byId("roundTitle"),
    roundSub: byId("roundSub"),
    tableHint: byId("tableHint"),
    roundClockText: byId("roundClockText"),
    slotA: byId("slotA"),
    slotB: byId("slotB"),
    calcBtn: byId("calcBtn"),
    previewValue: byId("previewValue"),
    previewExpr: byId("previewExpr"),
    previewFoot: byId("previewFoot"),
    resultReadout: byId("resultReadout"),
    handShelf: byId("handShelf"),
    handCount: byId("handCount"),
    emptyHand: byId("emptyHand"),
    emptyHandText: byId("emptyHandText"),
    historyList: byId("historyList"),
    startBtn: byId("startBtn"),
    restartBtn: byId("restartBtn"),
    giveUpBtn: byId("giveUpBtn"),
    timerInput: byId("timerInput"),
    timerBtn: byId("timerBtn"),
    timerBtnText: byId("timerBtnText"),
    timerValue: byId("timerValue"),
    timerNote: byId("timerNote"),
    timerError: byId("timerError"),
    timerRing: byId("timerRing"),
    timerStateTag: byId("timerStateTag"),
    timerPanel: document.querySelector(".timer-panel"),
    miniTimer: byId("miniTimer"),
    miniTimerRing: byId("miniTimerRing"),
    topTimerValue: byId("topTimerValue"),
    topTimerLabel: byId("topTimerLabel"),
    advancedToggle: byId("advancedToggle"),
    deckModeTag: byId("deckModeTag"),
    deckPanel: document.querySelector(".deck-panel"),
    aiPanel: byId("aiPanel"),
    aiState: byId("aiState"),
    aiContent: byId("aiContent"),
    aboutDialog: byId("aboutDialog"),
    helpDialog: byId("helpDialog"),
    helpDynamic: byId("helpDynamic"),
    resultDialog: byId("resultDialog"),
    resultIcon: byId("resultIcon"),
    resultEyebrow: byId("resultEyebrow"),
    resultTitle: byId("resultTitle"),
    resultText: byId("resultText"),
    resultFormula: byId("resultFormula"),
    resultMeta: byId("resultMeta"),
    resultRestart: byId("resultRestart"),
    resultClose: byId("resultClose"),
    exitDialog: byId("exitDialog"),
    exitCancel: byId("exitCancel"),
    exitConfirm: byId("exitConfirm"),
    exitScreen: byId("exitScreen"),
    reenterBtn: byId("reenterBtn"),
    toast: byId("toast"),
    liveRegion: byId("liveRegion"),
    confetti: byId("confetti"),
  };

  const operatorButtons = Array.from(document.querySelectorAll(".operator-btn"));

  const runtime = {
    timerInterval: null,
    clockInterval: null,
    aiTimeout: null,
    resultTimeout: null,
    toastTimeout: null,
    announceTimeout: null,
    newResultId: null,
    newResultTimer: null,
    confettiFrame: null,
    roundToken: 0,
    tileSequence: 0,
    dragId: null,
    exiting: false,
  };

  let state = createInitialState();

  function byId(id) {
    return document.getElementById(id);
  }

  function createInitialState() {
    return {
      phase: "idle",
      round: 0,
      cards: [],
      tiles: [],
      slots: { A: null, B: null },
      operator: null,
      history: [],
      advanced: false,
      startedAt: 0,
      endedAt: 0,
      endReason: null,
      lastResultTile: null,
      timer: {
        duration: INITIAL_SECONDS,
        remaining: INITIAL_SECONDS,
        started: false,
        running: false,
        deadline: 0,
        endReason: null,
      },
      ai: {
        status: "idle",
        analysis: null,
        requestToken: 0,
      },
    };
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function init() {
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    els.startBtn.addEventListener("click", function () {
      startNewRound();
    });

    els.restartBtn.addEventListener("click", function () {
      startNewRound();
    });

    els.giveUpBtn.addEventListener("click", function () {
      giveUpToAI();
    });

    els.calcBtn.addEventListener("click", function () {
      combineCurrentTiles();
    });

    operatorButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        chooseOperator(button.dataset.op);
      });
    });

    els.handShelf.addEventListener("click", handleHandClick);

    els.handShelf.addEventListener("dragstart", function (event) {
      const card = event.target.closest("[data-tile-id]");
      if (!card || state.phase !== "playing") {
        event.preventDefault();
        return;
      }

      const id = card.dataset.tileId;
      runtime.dragId = id;
      card.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      }
    });

    els.handShelf.addEventListener("dragend", function () {
      runtime.dragId = null;
      const dragging = els.handShelf.querySelector(".is-dragging");
      if (dragging) dragging.classList.remove("is-dragging");
      clearDragOver();
    });

    setupSlot("A", els.slotA);
    setupSlot("B", els.slotB);

    els.timerBtn.addEventListener("click", startCountdown);

    els.timerInput.addEventListener("input", handleTimerInput);
    els.timerInput.addEventListener("blur", function () {
      const parsed = parseTimerInput();
      if (!parsed.ok) {
        els.timerError.textContent = parsed.message;
      }
    });
    els.timerInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (!els.timerBtn.disabled) startCountdown();
      }
    });

    els.advancedToggle.addEventListener("change", function () {
      state.advanced = els.advancedToggle.checked;
      renderDeck();
      const message = state.advanced
        ? "进阶牌面已开启：下一局将加入 J、Q、K 与 0。"
        : "已切回标准牌面：下一局只使用 A–10。";
      showToast(message);
      announce(message);
    });

    els.aboutBtn.addEventListener("click", function () {
      openDialog(els.aboutDialog);
    });

    els.helpBtn.addEventListener("click", function () {
      renderHelpHint();
      openDialog(els.helpDialog);
    });

    els.exitBtn.addEventListener("click", function () {
      openDialog(els.exitDialog);
    });

    els.exitCancel.addEventListener("click", function () {
      closeDialog(els.exitDialog);
    });

    els.exitConfirm.addEventListener("click", confirmExit);

    els.reenterBtn.addEventListener("click", function () {
      window.location.reload();
    });

    els.resultRestart.addEventListener("click", function () {
      startNewRound();
    });

    els.resultClose.addEventListener("click", function () {
      closeDialog(els.resultDialog);
    });

    document.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        const dialog = button.closest("dialog");
        if (dialog) closeDialog(dialog);
      });
    });

    [els.aboutDialog, els.helpDialog, els.resultDialog, els.exitDialog].forEach(
      function (dialog) {
        dialog.addEventListener("click", function (event) {
          if (event.target === dialog) closeDialog(dialog);
        });
      }
    );

    els.aiContent.addEventListener("click", function (event) {
      const action = event.target.closest("[data-ai-action]");
      if (action && action.dataset.aiAction === "restart") {
        startNewRound();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.isComposing) return;
      if (state.phase !== "playing" || !!document.querySelector("dialog[open]")) {
        return;
      }

      const target = event.target;
      const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (tag === "button" || tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      if (!els.calcBtn.disabled) {
        event.preventDefault();
        combineCurrentTiles();
      }
    });

    window.addEventListener("resize", function () {
      if (state.phase === "won") {
        // The confetti canvas is re-sized lazily on the next burst.
      }
    });
  }

  function setupSlot(name, element) {
    element.addEventListener("click", function (event) {
      const clear = event.target.closest("[data-clear-slot]");
      if (clear) {
        clearSlot(clear.dataset.clearSlot);
        return;
      }

      if (state.phase !== "playing") return;
      if (!state.slots[name]) {
        showToast("从下方拖拽一张牌到这里，或直接点击牌面。");
      }
    });

    element.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (state.phase !== "playing") return;
      event.preventDefault();
      if (state.slots[name]) {
        clearSlot(name);
      } else {
        showToast("从下方拖拽一张牌到这里，或直接点击牌面。");
      }
    });

    element.addEventListener("dragenter", function (event) {
      if (state.phase !== "playing") return;
      event.preventDefault();
      element.classList.add("is-dragover");
    });

    element.addEventListener("dragover", function (event) {
      if (state.phase !== "playing") return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      element.classList.add("is-dragover");
    });

    element.addEventListener("dragleave", function (event) {
      if (!element.contains(event.relatedTarget)) {
        element.classList.remove("is-dragover");
      }
    });

    element.addEventListener("drop", function (event) {
      event.preventDefault();
      element.classList.remove("is-dragover");
      if (state.phase !== "playing") return;

      const id =
        (event.dataTransfer && event.dataTransfer.getData("text/plain")) ||
        runtime.dragId;

      if (id) {
        placeTileInSlot(name, id);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Dealing and card construction
     ------------------------------------------------------------------------ */

  function startNewRound(options) {
    const config = options || {};
    const parsed = parseTimerInput();
    const duration = parsed.ok ? parsed.value : INITIAL_SECONDS;

    clearRuntimeForNewRound();
    closeAllDialogs();

    state.round += 1;
    state.phase = "playing";
    state.advanced = !!els.advancedToggle.checked;
    state.cards = Array.isArray(config.debugRanks)
      ? buildDebugHand(config.debugRanks)
      : drawHand(state.advanced);
    state.tiles = state.cards.slice();
    state.slots = { A: null, B: null };
    state.operator = null;
    state.history = [];
    state.startedAt = Date.now();
    state.endedAt = 0;
    state.endReason = null;
    state.lastResultTile = null;
    state.timer = {
      duration: duration,
      remaining: duration,
      started: false,
      running: false,
      deadline: 0,
      endReason: null,
    };
    state.ai = {
      status: "idle",
      analysis: null,
      requestToken: state.ai.requestToken + 1,
    };

    runtime.roundToken += 1;
    runtime.newResultId = null;
    els.timerInput.value = String(duration);
    els.timerError.textContent = "";
    closeAllDialogs();

    renderAll();
    startRoundClock();
    animateDeal();

    const message =
      state.round === 1
        ? "第 1 局开始，四张牌已经发好。"
        : "新的一局开始，四张牌已经重新发好。";
    showToast(message);
    announce(message + " 拖拽任意两张牌到运算区，凑出 24。");
  }

  function drawHand(includeAdvanced) {
    const deck = [];

    for (let rank = 1; rank <= 13; rank += 1) {
      if (!includeAdvanced && rank > 10) continue;
      for (let s = 0; s < SUITS.length; s += 1) {
        deck.push({ rank: rank, suit: SUITS[s] });
      }
    }

    if (includeAdvanced) {
      deck.push({ rank: 0, suit: null });
    }

    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }

    return deck.slice(0, 4).map(function (entry) {
      return makeCard(entry.rank, entry.suit);
    });
  }

  function buildDebugHand(ranks) {
    return ranks.slice(0, 4).map(function (rank, index) {
      const normalized = Math.max(0, Math.min(13, Number(rank) || 0));
      const suit =
        normalized === 0 ? null : SUITS[index % SUITS.length];
      return makeCard(normalized, suit);
    });
  }

  function makeCard(rank, suit) {
    runtime.tileSequence += 1;
    const meta = RANK_META[rank] || { face: String(rank), alt: "", name: String(rank) };
    const value = Fraction.integer(rank);
    const id = "tile-" + runtime.tileSequence;
    const label = meta.face;

    return {
      id: id,
      type: "card",
      rank: rank,
      value: value,
      label: label,
      alt: meta.alt,
      name: meta.name,
      suit: suit,
      usedLeaves: 1,
      exprNode: {
        type: "leaf",
        value: value,
        label: label,
        id: id,
      },
      fullExpr: label,
    };
  }

  function makeResultTile(left, right, operator) {
    const value = calculate(left.value, right.value, operator);
    if (!value) return null;

    runtime.tileSequence += 1;
    const id = "tile-" + runtime.tileSequence;
    const node = {
      type: "operation",
      operator: operator,
      value: value,
      left: left.exprNode,
      right: right.exprNode,
    };

    return {
      id: id,
      type: "result",
      rank: null,
      value: value,
      label: formatFraction(value),
      usedLeaves: left.usedLeaves + right.usedLeaves,
      exprNode: node,
      fullExpr: renderExpression(node),
    };
  }

  function calculate(left, right, operator) {
    try {
      if (operator === "+") return left.add(right);
      if (operator === "-") return left.subtract(right);
      if (operator === "*") return left.multiply(right);
      if (operator === "/") {
        if (right.isZero()) return null;
        return left.divide(right);
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  /* ------------------------------------------------------------------------
     Interaction
     ------------------------------------------------------------------------ */

  function handleHandClick(event) {
    if (state.phase !== "playing") return;
    const card = event.target.closest("[data-tile-id]");
    if (!card) return;

    const id = card.dataset.tileId;
    if (state.slots.A === id || state.slots.B === id) return;

    const emptySlot = !state.slots.A ? "A" : !state.slots.B ? "B" : null;
    if (!emptySlot) {
      showToast("运算区已经放满两张牌。点击牌面上的 ×，先取回一张。");
      announce("运算区已经放满两张牌，请先取回一张。");
      return;
    }

    placeTileInSlot(emptySlot, id);
  }

  function placeTileInSlot(slot, id) {
    if (state.phase !== "playing") return;

    const tile = state.tiles.find(function (item) {
      return item.id === id;
    });
    if (!tile) return;

    const other = slot === "A" ? "B" : "A";
    if (state.slots[other] === id) state.slots[other] = null;
    state.slots[slot] = id;

    renderAll();
    announce(
      tile.type === "result"
        ? "结果牌 " + tile.label + " 已放入 " + slot + " 位置。"
        : tile.name + " 已放入 " + slot + " 位置。"
    );
  }

  function clearSlot(slot) {
    if (state.phase !== "playing") return;
    if (!state.slots[slot]) return;
    state.slots[slot] = null;
    renderAll();
    announce("已取回 " + slot + " 位置的牌。");
  }

  function chooseOperator(operator) {
    if (state.phase !== "playing") return;
    if (!OPS[operator]) return;

    state.operator = state.operator === operator ? null : operator;
    renderAll();

    if (state.operator) {
      announce("已选择 " + OPS[operator].label + " 运算。");
    } else {
      announce("已取消运算符。");
    }
  }

  function combineCurrentTiles() {
    if (state.phase !== "playing") return;

    const left = getSlotTile("A");
    const right = getSlotTile("B");
    const operator = state.operator;

    if (!left || !right) {
      showToast("请先把两张牌放入 A / B 位置。", "error");
      return;
    }
    if (!operator) {
      showToast("请先选择 + − × ÷ 中的一个运算符。", "error");
      return;
    }

    const result = makeResultTile(left, right, operator);
    if (!result) {
      showToast("不能除以 0，请换一个运算符或牌面。", "error");
      shakeReadout();
      return;
    }

    const expression =
      left.label + " " + OPS[operator].symbol + " " + right.label + " = " + formatFraction(result.value);

    state.history.push({
      text: expression,
      value: result.value,
    });
    state.tiles = state.tiles.filter(function (tile) {
      return tile.id !== left.id && tile.id !== right.id;
    });
    state.tiles.push(result);
    state.slots = { A: null, B: null };
    state.operator = null;
    state.lastResultTile = result;

    runtime.newResultId = result.id;
    if (runtime.newResultTimer) window.clearTimeout(runtime.newResultTimer);
    runtime.newResultTimer = window.setTimeout(function () {
      runtime.newResultId = null;
      const animated = els.handShelf.querySelector(".is-new-result");
      if (animated) animated.classList.remove("is-new-result");
    }, 700);

    renderAll();
    announce("运算结果：" + expression + "。");

    if (result.value.equals(TARGET) && state.tiles.length > 1) {
      showToast("中间结果是 24！继续把剩下的牌全部用完。", "success");
    }

    checkRoundCompletion(result);
  }

  function checkRoundCompletion(finalTile) {
    if (state.tiles.length !== 1) return;
    if (finalTile.usedLeaves !== 4) return;

    if (finalTile.value.equals(TARGET)) {
      finishRoundAsWin(finalTile);
    } else {
      finishRoundAsMiss(finalTile);
    }
  }

  /* ------------------------------------------------------------------------
     Round endings
     ------------------------------------------------------------------------ */

  function finishRoundAsWin(finalTile) {
    if (state.phase !== "playing") return;

    state.phase = "won";
    state.endedAt = Date.now();
    state.endReason = "win";
    state.slots = { A: null, B: null };
    state.operator = null;
    stopCountdown("won");
    stopRoundClock();

    renderAll();
    announce("恭喜，四张牌全部用完，结果是 24！");
    launchConfetti();

    const roundToken = runtime.roundToken;
    runtime.resultTimeout = window.setTimeout(function () {
      if (runtime.roundToken !== roundToken || state.phase !== "won") return;
      presentWin(finalTile);
    }, 620);
  }

  function finishRoundAsMiss(finalTile) {
    if (state.phase !== "playing") return;

    state.phase = "lost";
    state.endedAt = Date.now();
    state.endReason = "miss";
    state.slots = { A: null, B: null };
    state.operator = null;
    stopCountdown("lost");
    stopRoundClock();

    renderAll();
    announce("四张牌已用完，但结果是 " + formatFraction(finalTile.value) + "，不是 24。");

    const roundToken = runtime.roundToken;
    runtime.resultTimeout = window.setTimeout(function () {
      if (runtime.roundToken !== roundToken || state.phase !== "lost") return;
      presentMiss(finalTile);
    }, 540);
  }

  function handleTimerExpired() {
    if (state.phase !== "playing") return;

    state.phase = "lost";
    state.endedAt = Date.now();
    state.endReason = "timeout";
    state.timer.remaining = 0;
    state.timer.running = false;
    state.timer.started = true;
    state.timer.endReason = "timeout";
    clearCountdownInterval();
    state.slots = { A: null, B: null };
    state.operator = null;
    stopRoundClock();

    renderAll();
    announce("时间到，本局失败。");
    showToast("时间到，本局挑战失败。", "error");

    const roundToken = runtime.roundToken;
    runtime.resultTimeout = window.setTimeout(function () {
      if (runtime.roundToken !== roundToken || state.phase !== "lost") return;
      presentTimeout();
    }, 360);
  }

  function presentWin(finalTile) {
    const elapsed = Math.max(1, Math.round((state.endedAt - state.startedAt) / 1000));
    const remaining = Math.max(0, Math.ceil(state.timer.remaining));
    const timerText = state.timer.started ? " · 剩余 " + remaining + " 秒" : "";

    showResultDialog({
      icon: "✓",
      iconState: "success",
      eyebrow: "ROUND COMPLETE",
      title: "漂亮，正好 24。",
      text: "四张牌全部用完，你完成了本局挑战。AI 也不用出手了。",
      formula: finalTile.fullExpr + " = 24",
      meta: "用时 " + elapsed + " 秒 · 3 步运算" + timerText,
      restartLabel: "再来一局",
      closeLabel: "回到牌桌",
    });
  }

  function presentMiss(finalTile) {
    const elapsed = Math.max(1, Math.round((state.endedAt - state.startedAt) / 1000));
    showResultDialog({
      icon: "!",
      iconState: "fail",
      eyebrow: "ROUND OVER",
      title: "结果是 " + formatFraction(finalTile.value) + "，不是 24。",
      text: "四张牌已经全部用完。差一点也没关系，换一组牌再挑战一次。",
      formula: finalTile.fullExpr + " = " + formatFraction(finalTile.value),
      meta: "用时 " + elapsed + " 秒 · 3 步运算",
      restartLabel: "再来一局",
      closeLabel: "回到牌桌",
    });
  }

  function presentTimeout() {
    showResultDialog({
      icon: "!",
      iconState: "fail",
      eyebrow: "TIME'S UP",
      title: "时间到，本局失败。",
      text: "倒计时已经归零，未能在限定时间内完成 24 点。调整节奏，再来一局。",
      formula: "",
      meta: "限时 " + state.timer.duration + " 秒 · 倒计时结束",
      restartLabel: "再来一局",
      closeLabel: "回到牌桌",
    });
  }

  /* ------------------------------------------------------------------------
     AI give-up / solve presentation
     ------------------------------------------------------------------------ */

  function giveUpToAI() {
    if (state.phase !== "playing") return;

    state.phase = "ai";
    state.endedAt = Date.now();
    state.endReason = "giveup";
    state.slots = { A: null, B: null };
    state.operator = null;
    state.ai.status = "thinking";
    state.ai.analysis = null;
    state.ai.requestToken += 1;
    stopCountdown("stopped");
    stopRoundClock();
    renderAll();
    announce("AI 开始穷举所有可能。");

    if (window.matchMedia("(max-width: 1160px)").matches) {
      window.setTimeout(function () {
        els.aiPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }

    const token = state.ai.requestToken;
    const roundToken = runtime.roundToken;

    runtime.aiTimeout = window.setTimeout(function () {
      if (token !== state.ai.requestToken || runtime.roundToken !== roundToken) {
        return;
      }

      let analysis;
      try {
        analysis = solve(
          state.cards.map(function (card) {
            return { value: card.value, label: card.label };
          }),
          TARGET
        );
      } catch (error) {
        console.error(error);
        analysis = {
          hasSolution: false,
          solutions: [],
          solutionCount: 0,
          expressionCount: 0,
          outcomeCount: 0,
          error: true,
        };
      }

      state.ai.analysis = analysis;

      if (analysis.hasSolution) {
        state.phase = "ai";
        state.ai.status = "found";
        renderAll();
        if (window.innerWidth > 1160) {
          window.setTimeout(function () {
            if (els.aiPanel.getBoundingClientRect().bottom > window.innerHeight) {
              els.aiPanel.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 120);
        }
        const count = analysis.solutionCount;
        const message =
          count > 1
            ? "AI 找到 " + count + " 种解法，已展示前两种。"
            : "AI 找到 1 种解法，已展示在推演台。";
        showToast(message, "success");
        announce(message);
      } else {
        state.phase = "nosolution";
        state.ai.status = "none";
        renderAll();
        const message = analysis.error
          ? "AI 推演出现异常，请重试。"
          : "本局无解：AI 已穷举全部可能。";
        showToast(message, "error");
        announce(message);

        runtime.resultTimeout = window.setTimeout(function () {
          if (runtime.roundToken !== roundToken || state.phase !== "nosolution") {
            return;
          }
          presentNoSolution(analysis);
        }, 420);
      }
    }, 640);
  }

  function presentNoSolution(analysis) {
    showResultDialog({
      icon: "∅",
      iconState: "neutral",
      eyebrow: "NO SOLUTION",
      title: "本局无解。",
      text: "AI 已穷举数字排列、括号结构与所有四则运算，没有任何一条路径能得到 24。换一组牌吧。",
      formula: "",
      meta:
        "遍历 " +
        formatNumber(analysis.expressionCount) +
        " 条表达式 · " +
        formatNumber(analysis.outcomeCount) +
        " 种最终结果",
      restartLabel: "重新发牌",
      closeLabel: "回到牌桌",
    });
  }

  /* ------------------------------------------------------------------------
     Timer
     ------------------------------------------------------------------------ */

  function startCountdown() {
    if (state.phase !== "playing" || state.timer.started || state.timer.running) {
      return;
    }

    const parsed = parseTimerInput();
    if (!parsed.ok) {
      els.timerError.textContent = parsed.message;
      els.timerInput.focus();
      showToast(parsed.message, "error");
      return;
    }

    state.timer.duration = parsed.value;
    state.timer.remaining = parsed.value;
    state.timer.started = true;
    state.timer.running = true;
    state.timer.deadline = performance.now() + parsed.value * 1000;
    state.timer.endReason = null;
    els.timerError.textContent = "";
    els.timerInput.value = String(parsed.value);

    clearCountdownInterval();
    runtime.timerInterval = window.setInterval(tickCountdown, 100);
    updateTimerUI();

    showToast("倒计时开始 · " + parsed.value + " 秒");
    announce("倒计时开始，共 " + parsed.value + " 秒。");
  }

  function tickCountdown() {
    if (!state.timer.running) return;

    const remainingMs = state.timer.deadline - performance.now();
    state.timer.remaining = Math.max(0, remainingMs / 1000);
    updateTimerUI();

    if (remainingMs <= 0) {
      clearCountdownInterval();
      state.timer.remaining = 0;
      state.timer.running = false;
      state.timer.started = true;
      state.timer.endReason = "timeout";
      updateTimerUI();
      handleTimerExpired();
    }
  }

  function stopCountdown(reason) {
    clearCountdownInterval();
    state.timer.running = false;
    if (reason) state.timer.endReason = reason;
    updateTimerUI();
  }

  function clearCountdownInterval() {
    if (runtime.timerInterval) {
      window.clearInterval(runtime.timerInterval);
      runtime.timerInterval = null;
    }
  }

  function handleTimerInput() {
    if (state.timer.started) return;

    const parsed = parseTimerInput();
    if (!parsed.ok) {
      els.timerError.textContent = parsed.message;
      return;
    }

    els.timerError.textContent = "";
    state.timer.duration = parsed.value;
    state.timer.remaining = parsed.value;
    updateTimerUI();
  }

  function parseTimerInput() {
    const raw = String(els.timerInput.value).trim();
    const value = Number(raw);

    if (!raw || !Number.isInteger(value) || value < MIN_SECONDS || value > MAX_SECONDS) {
      return {
        ok: false,
        value: state.timer.duration,
        message: "请输入 " + MIN_SECONDS + "–" + MAX_SECONDS + " 之间的整数秒数。",
      };
    }

    return { ok: true, value: value, message: "" };
  }

  function updateTimerUI() {
    const timer = state.timer;
    const duration = Math.max(1, timer.duration || INITIAL_SECONDS);
    const remaining = Math.max(0, timer.remaining);
    const displaySeconds =
      timer.started || timer.running ? Math.ceil(remaining) : Math.ceil(duration);
    const fraction = clamp(remaining / duration, 0, 1);
    const urgent = timer.running && remaining <= 10;
    const finished = timer.started && !timer.running;

    els.timerValue.textContent = String(displaySeconds);
    els.timerRing.style.strokeDashoffset = String(
      TIMER_CIRCUMFERENCE * (1 - fraction)
    );

    els.miniTimerRing.style.strokeDashoffset = String(
      MINI_TIMER_CIRCUMFERENCE * (1 - fraction)
    );
    els.topTimerValue.textContent = displaySeconds + "s";

    els.timerPanel.classList.toggle("is-running", timer.running);
    els.timerPanel.classList.toggle("is-urgent", urgent);
    els.timerPanel.classList.toggle("is-finished", finished);
    els.miniTimer.classList.toggle("is-running", timer.running);
    els.miniTimer.classList.toggle("is-urgent", urgent);

    let tagText = "未开始";
    let tagClass = "panel-tag";

    if (timer.running) {
      tagText = "计时中";
      tagClass += " is-live";
      els.topTimerLabel.textContent = "计时中";
    } else if (timer.started) {
      if (timer.endReason === "timeout") {
        tagText = "已超时";
        tagClass += " is-danger";
      } else if (timer.endReason === "won") {
        tagText = "已完成";
        tagClass += " is-gold";
      } else {
        tagText = "已停止";
      }
      els.topTimerLabel.textContent = "已结束";
    } else {
      els.topTimerLabel.textContent = "未计时";
    }

    els.timerStateTag.textContent = tagText;
    els.timerStateTag.className = tagClass;

    if (timer.running) {
      els.timerNote.textContent = urgent
        ? "最后 10 秒，快！时间归零则本局失败。"
        : "倒计时进行中，专注牌面。时间归零则本局失败。";
    } else if (timer.started) {
      if (timer.endReason === "timeout") {
        els.timerNote.textContent = "时间归零，本局挑战失败。";
      } else if (timer.endReason === "won") {
        els.timerNote.textContent = "提前完成，倒计时已停止。";
      } else {
        els.timerNote.textContent = "本局已经结束，倒计时已停止。";
      }
    } else if (state.phase === "idle") {
      els.timerNote.textContent =
        "设置倒计时（当前 " +
        Math.ceil(duration) +
        " 秒），点击开始。时间归零则本局失败。";
    } else if (state.phase === "playing") {
      els.timerNote.textContent =
        "准备好后点击开始计时；也可以不开启计时，慢慢思考。";
    } else {
      els.timerNote.textContent = "本局已经结束。";
    }

    const canStart =
      state.phase === "playing" && !timer.started && !timer.running;
    els.timerBtn.disabled = !canStart;
    els.timerBtnText.textContent = timer.running
      ? "计时中…"
      : timer.started
        ? "本局已计时"
        : "开始计时";

    els.timerInput.disabled =
      timer.started ||
      !(state.phase === "playing" || state.phase === "idle");
  }

  /* ------------------------------------------------------------------------
     Renderers
     ------------------------------------------------------------------------ */

  function renderAll() {
    renderStatus();
    renderSlots();
    renderHand();
    renderOperatorState();
    renderPreview();
    renderHistory();
    renderActions();
    renderTableHint();
    renderAI();
    renderDeck();
    updateTimerUI();
    updateRoundClock();
  }

  function renderStatus() {
    const roundNumberText =
      state.round > 0 ? String(state.round).padStart(2, "0") : "—";
    els.roundNumber.textContent = roundNumberText;

    let badgeText = "准备开局";
    let badgeClass = "status-badge is-ready";
    let title = "等待开局";
    let subtitle = "点击「开始游戏」，发下四张牌，开始你的 24 点挑战。";

    if (state.phase === "playing") {
      badgeText = "进行中";
      badgeClass = "status-badge is-playing";
      title = "第 " + roundNumberText + " 局 · 目标 24";
      subtitle = "把四张牌全部用完，让最后的结果正好等于 24。";
    } else if (state.phase === "won") {
      badgeText = "挑战成功";
      badgeClass = "status-badge is-won";
      title = "漂亮！正好 24";
      subtitle = "四张牌全部用完，最终结果正好是 24。";
    } else if (state.phase === "lost") {
      if (state.endReason === "timeout") {
        badgeText = "时间到";
        title = "时间到 · 本局失败";
        subtitle = "倒计时已归零，本局挑战失败。点击「重新开始」再来一局。";
      } else {
        badgeText = "未达成";
        title = "本局结束 · 差一点";
        subtitle = "最终结果不是 24。点击「重新开始」换一组牌。";
      }
      badgeClass = "status-badge is-lost";
    } else if (state.phase === "ai") {
      badgeText = "AI 求解";
      badgeClass = "status-badge is-ai";
      if (state.ai.status === "thinking") {
        title = "AI 正在推演";
        subtitle = "AI 正在穷举所有数字排列、括号与四则运算……";
      } else {
        title = "AI 已接管牌桌";
        subtitle = "AI 已从本局原始四张牌中找到可行解法，见右侧推演台。";
      }
    } else if (state.phase === "nosolution") {
      badgeText = "本局无解";
      badgeClass = "status-badge is-lost";
      title = "本局无解";
      subtitle = "AI 已穷举所有可能，没有找到结果为 24 的解法。";
    }

    els.stateBadge.className = badgeClass;
    els.stateBadgeText.textContent = badgeText;
    els.roundTitle.textContent = title;
    els.roundSub.textContent = subtitle;
  }

  function renderSlots() {
    renderSlot("A", els.slotA);
    renderSlot("B", els.slotB);
  }

  function renderSlot(name, element) {
    const tile = getSlotTile(name);
    const disabled = state.phase !== "playing";

    element.classList.toggle("is-filled", !!tile);
    element.classList.toggle("is-disabled", disabled);
    element.setAttribute("aria-disabled", disabled ? "true" : "false");
    element.tabIndex = disabled ? -1 : 0;

    if (!tile) {
      element.setAttribute(
        "aria-label",
        "第 " + (name === "A" ? "一" : "二") + " 张牌的放置位置，当前为空"
      );
      element.innerHTML =
        '<span class="slot-empty">' +
        '<span class="slot-plus" aria-hidden="true">+</span>' +
        "<span>拖入一张牌</span>" +
        "</span>";
      return;
    }

    element.setAttribute(
      "aria-label",
      "第 " +
        (name === "A" ? "一" : "二") +
        " 张牌：" +
        describeTile(tile) +
        "。点击右上角 × 取回。"
    );

    element.innerHTML =
      '<div class="slot-card-wrap">' +
      renderCardMarkup(tile, { interactive: false, inSlot: true }) +
      '<button class="slot-clear" type="button" data-clear-slot="' +
      name +
      '" aria-label="取回 ' +
      name +
      ' 位置的牌">×</button>' +
      "</div>";
  }

  function renderHand() {
    const available = state.tiles.filter(function (tile) {
      return state.slots.A !== tile.id && state.slots.B !== tile.id;
    });

    els.handCount.textContent = String(available.length);
    els.handShelf.hidden = false;
    els.emptyHand.hidden = true;

    if (state.cards.length === 0) {
      els.handCount.textContent = "0";
      els.handShelf.innerHTML = Array.from({ length: 4 })
        .map(function () {
          return '<span class="card-back" aria-hidden="true"></span>';
        })
        .join("");
      return;
    }

    if (available.length === 0) {
      els.handShelf.innerHTML = "";
      els.handShelf.hidden = true;
      els.emptyHand.hidden = false;
      if (state.slots.A && state.slots.B) {
        els.emptyHandText.textContent =
          "两张牌正在运算区，选好运算符后点击「计算合并」。";
      } else {
        els.emptyHandText.textContent = "牌面都在运算区里了。";
      }
      return;
    }

    const interactive = state.phase === "playing";
    els.handShelf.innerHTML = available
      .map(function (tile) {
        return renderCardMarkup(tile, { interactive: interactive });
      })
      .join("");
  }

  function renderCardMarkup(tile, options) {
    const config = options || {};
    const interactive = !!config.interactive;
    const inSlot = !!config.inSlot;
    const isResult = tile.type === "result";
    const classes = ["playing-card"];
    let ariaLabel;
    let title = "";

    if (!interactive && !inSlot) classes.push("is-locked");

    if (isResult) {
      classes.push("result-card");
      const valueText = formatFraction(tile.value);
      const valueClass =
        valueText.length > 7
          ? " is-tiny"
          : valueText.length > 4
            ? " is-compact"
            : "";
      if (runtime.newResultId === tile.id) classes.push("is-new-result");

      ariaLabel =
        "结果牌 " +
        valueText +
        "，由 " +
        tile.usedLeaves +
        " 张牌合并" +
        (interactive ? "，可拖拽或点击" : "");
      title = tile.fullExpr + " = " + valueText;

      return buildCardElement(
        "playing-card " + classes.join(" "),
        interactive,
        tile,
        ariaLabel,
        title,
        '<span class="card-face">' +
          '<span class="result-tag">RESULT</span>' +
          '<span class="result-spark" aria-hidden="true">✦</span>' +
          '<span class="result-value' +
          valueClass +
          '">' +
          escapeHtml(valueText) +
          "</span>" +
          '<span class="result-sub"><span>' +
          tile.usedLeaves +
          ' 张牌</span><b>24?</b></span>' +
          '<span class="result-decoration" aria-hidden="true"></span>' +
          "</span>"
      );
    }

    const meta = RANK_META[tile.rank] || {
      face: String(tile.rank),
      alt: "",
      name: String(tile.rank),
    };
    const suitSymbol = tile.suit ? tile.suit.symbol : "✦";
    const suitName = tile.suit ? tile.suit.name : "万能牌";
    const color = tile.suit ? tile.suit.color : "joker";

    classes.push(
      color === "red" ? "is-red" : color === "black" ? "is-black" : "is-joker"
    );
    if (meta.face.length > 1) classes.push("is-long-rank");
    if (tile.rank === 1 || tile.rank >= 11) classes.push("is-face");

    ariaLabel =
      suitName +
      " " +
      meta.name +
      (meta.alt && meta.alt !== "JOKER" ? "，" + meta.alt + " 点" : "") +
      (interactive ? "，可拖拽或点击" : "");
    title = meta.face + (tile.suit ? " " + suitSymbol : "") + " · 目标 24";

    const cardFace =
      '<span class="card-face">' +
      '<span class="card-corner"><span class="corner-rank">' +
      escapeHtml(meta.face) +
      '</span><span class="corner-suit">' +
      suitSymbol +
      "</span></span>" +
      '<span class="card-center">' +
      '<span class="card-center-suit" aria-hidden="true">' +
      suitSymbol +
      "</span>" +
      '<span class="card-center-rank">' +
      escapeHtml(meta.face) +
      "</span>" +
      "</span>" +
      '<span class="card-corner is-bottom"><span class="corner-rank">' +
      escapeHtml(meta.face) +
      '</span><span class="corner-suit">' +
      suitSymbol +
      "</span></span>" +
      (meta.alt
        ? '<span class="card-alt">' + escapeHtml(meta.alt) + "</span>"
        : "") +
      (tile.rank === 0
        ? '<span class="card-joker-caption">JOKER</span>'
        : "") +
      "</span>";

    return buildCardElement(
      classes.join(" "),
      interactive,
      tile,
      ariaLabel,
      title,
      cardFace
    );
  }

  function buildCardElement(className, interactive, tile, ariaLabel, title, inner) {
    const tag = interactive ? "button" : "div";
    const attributes = [
      'class="' + className + '"',
      'aria-label="' + escapeAttribute(ariaLabel) + '"',
    ];

    if (title) attributes.push('title="' + escapeAttribute(title) + '"');

    if (interactive) {
      attributes.push('type="button"');
      attributes.push('draggable="true"');
      attributes.push('data-tile-id="' + escapeAttribute(tile.id) + '"');
    } else {
      attributes.push('role="img"');
    }

    return "<" + tag + " " + attributes.join(" ") + ">" + inner + "</" + tag + ">";
  }

  function renderOperatorState() {
    const disabled = state.phase !== "playing";

    operatorButtons.forEach(function (button) {
      const selected = state.operator === button.dataset.op;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.disabled = disabled;
    });

    const ready =
      state.phase === "playing" &&
      !!state.slots.A &&
      !!state.slots.B &&
      !!state.operator;

    els.calcBtn.disabled = !ready;
    els.calcBtn.classList.toggle("is-ready", ready);
  }

  function renderPreview() {
    const left = getSlotTile("A");
    const right = getSlotTile("B");
    const operator = state.operator;

    els.resultReadout.classList.remove("is-target", "is-error");
    els.previewValue.textContent = "?";
    els.previewExpr.textContent = "等待选择两张牌";
    els.previewFoot.textContent = "目标值 24";

    if (!left && !right) return;

    if (left && right && operator) {
      const value = calculate(left.value, right.value, operator);
      const expression =
        left.label + " " + OPS[operator].symbol + " " + right.label;

      els.previewExpr.textContent = expression;

      if (!value) {
        els.resultReadout.classList.add("is-error");
        els.previewValue.textContent = "∞";
        els.previewFoot.textContent = "除以 0 不合法，请更换运算符";
        return;
      }

      els.previewValue.textContent = formatFraction(value);

      if (value.equals(TARGET)) {
        els.resultReadout.classList.add("is-target");
        els.previewFoot.textContent =
          state.tiles.length > 2
            ? "中间结果 24 · 继续用完剩余牌面"
            : "命中 24 · 点击「计算合并」完成";
      } else {
        els.previewFoot.textContent = "点击「计算合并」生成结果牌";
      }
      return;
    }

    if (left && right) {
      els.previewExpr.textContent = "已选两张牌，请选择运算符";
      els.previewFoot.textContent = "运算符位于两张牌之间";
      return;
    }

    els.previewExpr.textContent = "再放入一张牌";
    els.previewFoot.textContent = left || right ? "还差一张牌" : "目标值 24";
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyList.innerHTML =
        '<span class="history-empty">还没有进行运算</span>';
      return;
    }

    els.historyList.innerHTML = state.history
      .map(function (entry) {
        return '<span class="history-chip">' + escapeHtml(entry.text) + "</span>";
      })
      .join("");

    window.requestAnimationFrame(function () {
      els.historyList.scrollLeft = els.historyList.scrollWidth;
    });
  }

  function renderActions() {
    els.startBtn.hidden = state.phase !== "idle";
    els.restartBtn.disabled = state.phase === "idle";
    els.giveUpBtn.disabled = state.phase !== "playing";
  }

  function renderTableHint() {
    let hint = "拖拽任意两张牌到运算区，并选择运算符";

    if (state.phase === "idle") {
      hint = "点击「开始游戏」发下四张牌";
    } else if (state.phase === "playing") {
      const filled = (state.slots.A ? 1 : 0) + (state.slots.B ? 1 : 0);
      if (filled === 2 && state.operator) {
        hint = "点击「计算合并」，把两张牌变成一个结果";
      } else if (filled === 2) {
        hint = "选择 + − × ÷ 中的一个运算符";
      } else if (filled === 1) {
        hint = "再选一张牌，放入另一个空位";
      } else {
        hint = "拖拽任意两张牌到 A / B 位置，并选择运算符";
      }
    } else if (state.phase === "won") {
      hint = "24 点达成！点击「重新开始」再来一局";
    } else if (state.phase === "lost") {
      hint = "本局结束，点击「重新开始」换四张牌";
    } else if (state.phase === "ai") {
      hint =
        state.ai.status === "thinking"
          ? "AI 正在枚举所有数字排列、括号与运算"
          : "AI 已接管，解法展示在右侧推演台";
    } else if (state.phase === "nosolution") {
      hint = "AI 已穷举所有可能，本局无解";
    }

    els.tableHint.textContent = hint;
  }

  function renderDeck() {
    els.advancedToggle.checked = state.advanced;
    els.deckModeTag.textContent = state.advanced ? "进阶 0–13" : "标准 A–10";
    els.deckPanel.classList.toggle("is-advanced", state.advanced);
  }

  /* ------------------------------------------------------------------------
     AI renderer
     ------------------------------------------------------------------------ */

  function renderAI() {
    const ai = state.ai;
    const thinking = ai.status === "thinking";
    els.aiPanel.classList.toggle("is-thinking", thinking);

    if (thinking) {
      els.aiState.textContent = "推演中";
      els.aiState.className = "ai-state is-live";
    } else if (ai.status === "found") {
      els.aiState.textContent = "已求解";
      els.aiState.className = "ai-state is-gold";
    } else if (ai.status === "none") {
      els.aiState.textContent = "无解";
      els.aiState.className = "ai-state is-danger";
    } else {
      els.aiState.textContent = "待命";
      els.aiState.className = "ai-state";
    }

    if (thinking) {
      els.aiContent.innerHTML = renderAIThinking();
      return;
    }

    if (ai.status === "found" && ai.analysis) {
      els.aiContent.innerHTML = renderAISolutions(ai.analysis);
      return;
    }

    if (ai.status === "none" && ai.analysis) {
      els.aiContent.innerHTML = renderAINoSolutions(ai.analysis);
      return;
    }

    els.aiContent.innerHTML = renderAIWelcome();
  }

  function renderAIWelcome() {
    return (
      '<div class="ai-welcome">' +
      '<p class="ai-welcome-title">卡住了？交给我。</p>' +
      '<p class="ai-welcome-copy">点击「放弃 · 让 AI 来」，我会穷举数字排列、括号结构与所有四则运算，' +
      "找出前两种解法；如果无解，也会明确告诉你。</p>" +
      '<div class="ai-capabilities"><span>精确分数</span><span>全排列</span><span>双解法</span></div>' +
      "</div>"
    );
  }

  function renderAIThinking() {
    return (
      '<div class="ai-thinking">' +
      renderAIHandStrip("原始牌面") +
      '<div class="ai-thinking-text"><span>正在穷举所有运算路径</span><strong>请稍候…</strong></div>' +
      '<div class="ai-scan">' +
      Array.from({ length: 10 })
        .map(function () {
          return "<span></span>";
        })
        .join("") +
      "</div>" +
      '<div class="ai-scan-meta"><span>数字排列 × 括号结构 × 四则运算</span><span>EXACT</span></div>' +
      "</div>"
    );
  }

  function renderAISolutions(analysis) {
    const solutions = analysis.solutions.slice(0, 2);
    const count = analysis.solutionCount;

    const cards = solutions
      .map(function (solution, index) {
        const steps = solution.steps
          .map(function (step, stepIndex) {
            return (
              '<li class="solution-step">' +
              '<span class="step-num">' +
              (stepIndex + 1) +
              "</span>" +
              '<span class="step-expr">' +
              escapeHtml(step.expression) +
              "</span>" +
              '<span class="step-value">= ' +
              escapeHtml(step.value) +
              "</span>" +
              "</li>"
            );
          })
          .join("");

        return (
          '<article class="solution-card">' +
          '<div class="solution-head">' +
          '<span class="solution-index">' +
          String(index + 1).padStart(2, "0") +
          "</span>" +
          '<span class="solution-tag">' +
          (index === 0 ? "推荐 · 已验证" : "备选 · 已验证") +
          "</span>" +
          "</div>" +
          '<p class="solution-formula">' +
          escapeHtml(solution.formula) +
          "</p>" +
          '<ol class="solution-steps">' +
          steps +
          "</ol>" +
          "</article>"
        );
      })
      .join("");

    return (
      '<div class="ai-summary">' +
      '<span class="ai-summary-icon" aria-hidden="true">✓</span>' +
      "<span>已穷举 <strong>" +
      formatNumber(analysis.expressionCount) +
      "</strong> 条表达式，找到 <strong>" +
      formatNumber(count) +
      "</strong> 种不同解法。</span>" +
      "</div>" +
      renderAIHandStrip("本局原始牌面") +
      '<div class="solutions">' +
      cards +
      "</div>" +
      '<p class="ai-footnote">' +
      (count > 2 ? "展示前 2 种，按中间值整数优先排序。" : "已展示全部不同解法。") +
      " A=1 · J=11 · Q=12 · K=13，分数按精确值计算。</p>"
    );
  }

  function renderAINoSolutions(analysis) {
    const copy = analysis.error
      ? "推演过程中出现异常，请重新开始后再试一次。"
      : "AI 已穷举数字排列、括号结构与所有四则运算，没有任何一条路径能得到 24。";

    return (
      renderAIHandStrip("本局原始牌面") +
      '<div class="ai-empty">' +
      '<span class="ai-empty-icon" aria-hidden="true">∅</span>' +
      "<h3>本局无解</h3>" +
      "<p>" +
      copy +
      "</p>" +
      '<div class="ai-stats"><span>' +
      formatNumber(analysis.expressionCount) +
      " 条表达式</span><span>" +
      formatNumber(analysis.outcomeCount) +
      " 种最终结果</span></div>" +
      "</div>" +
      '<p class="ai-footnote">换一组牌，或者点击「重新开始」再来一局。</p>'
    );
  }

  function renderAIHandStrip(label) {
    if (!state.cards.length) return "";
    return (
      '<div class="ai-hand-strip">' +
      state.cards
        .map(function (card) {
          return "<span>" + escapeHtml(card.label) + "</span>";
        })
        .join("") +
      "<small>" +
      escapeHtml(label) +
      "</small>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
     Help
     ------------------------------------------------------------------------ */

  function renderHelpHint() {
    if (state.phase === "idle") {
      els.helpDynamic.innerHTML =
        '<div class="help-hint is-muted"><span class="hint-kicker">本局第一步提示</span>' +
        "<p>开始一局后，这里会根据你当前的牌面给出可行的第一步。</p></div>";
      return;
    }

    if (state.phase === "won") {
      els.helpDynamic.innerHTML =
        '<div class="help-hint"><span class="hint-kicker">本局提示</span>' +
        "<p>本局已经完成，最终结果正好是 <strong>24</strong>。再来一局，看看能否更快。</p></div>";
      return;
    }

    if (state.phase === "timeout" || state.endReason === "timeout") {
      els.helpDynamic.innerHTML =
        '<div class="help-hint is-muted"><span class="hint-kicker">本局提示</span>' +
        "<p>本局倒计时已经结束。重新开始后会得到新的牌面与第一步提示。</p></div>";
      return;
    }

    if (state.phase === "lost" || state.phase === "nosolution") {
      els.helpDynamic.innerHTML =
        '<div class="help-hint is-muted"><span class="hint-kicker">本局提示</span>' +
        "<p>本局已经结束，重新开始后这里会给出基于新牌面的第一步。</p></div>";
      return;
    }

    const availableTiles = state.tiles.slice();
    if (!availableTiles.length) {
      els.helpDynamic.innerHTML =
        '<div class="help-hint is-muted"><span class="hint-kicker">本局第一步提示</span>' +
        "<p>当前没有可用牌面，请重新开始一局。</p></div>";
      return;
    }

    let analysis;
    try {
      analysis = solve(
        availableTiles.map(function (tile) {
          return {
            value: tile.value,
            label: tile.type === "result" ? formatFraction(tile.value) : tile.label,
          };
        }),
        TARGET
      );
    } catch (error) {
      analysis = null;
    }

    if (analysis && analysis.hasSolution) {
      const firstStep =
        analysis.solutions[0].steps.length > 0
          ? analysis.solutions[0].steps[0]
          : null;

      if (!firstStep) {
        els.helpDynamic.innerHTML =
          '<div class="help-hint"><span class="hint-kicker">本局第一步提示</span>' +
          "<p>当前只剩一张牌，数值为 <strong>" +
          escapeHtml(formatFraction(availableTiles[0].value)) +
          "</strong>。</p></div>";
        return;
      }

      els.helpDynamic.innerHTML =
        '<div class="help-hint">' +
        '<span class="hint-kicker">本局第一步提示</span>' +
        "<p>根据当前 <strong>" +
        availableTiles.length +
        "</strong> 张可用牌面，一个可行的开口是：</p>" +
        '<p class="hint-step">' +
        escapeHtml(firstStep.expression) +
        " = " +
        escapeHtml(firstStep.value) +
        "</p>" +
        "<p>先完成这一步，再把得到的新结果与剩余牌面继续合并，朝 24 推进。</p>" +
        "</div>";
      return;
    }

    els.helpDynamic.innerHTML =
      '<div class="help-hint is-muted"><span class="hint-kicker">本局第一步提示</span>' +
      "<p>按当前剩余的 <strong>" +
      availableTiles.length +
      "</strong> 张牌，继续合并已经无法得到 24。可以点击「重新开始」换一组牌。</p></div>";
  }

  /* ------------------------------------------------------------------------
     Result dialog
     ------------------------------------------------------------------------ */

  function showResultDialog(config) {
    [els.aboutDialog, els.helpDialog, els.exitDialog].forEach(function (dialog) {
      if (dialog.open) dialog.close();
    });

    els.resultIcon.textContent = config.icon || "✓";
    els.resultIcon.className = "result-symbol";
    if (config.iconState === "fail") els.resultIcon.classList.add("is-fail");
    if (config.iconState === "neutral") els.resultIcon.classList.add("is-neutral");

    els.resultEyebrow.textContent = config.eyebrow || "ROUND COMPLETE";
    els.resultTitle.textContent = config.title || "本局结束";
    els.resultText.textContent = config.text || "";
    els.resultFormula.textContent = config.formula || "";
    els.resultMeta.textContent = config.meta || "";
    els.resultRestart.textContent = config.restartLabel || "再来一局";
    els.resultClose.textContent = config.closeLabel || "回到牌桌";

    if (els.resultDialog.open) els.resultDialog.close();
    els.resultDialog.showModal();
  }

  /* ------------------------------------------------------------------------
     Exit
     ------------------------------------------------------------------------ */

  function confirmExit() {
    closeDialog(els.exitDialog);
    clearCountdownInterval();
    stopRoundClock();
    if (runtime.aiTimeout) window.clearTimeout(runtime.aiTimeout);
    if (runtime.resultTimeout) window.clearTimeout(runtime.resultTimeout);
    runtime.exiting = true;
    state.phase = "exited";

    try {
      window.open("", "_self");
      window.close();
    } catch (error) {
      // Browsers usually block window.close() for tabs the script did not open.
    }

    window.setTimeout(function () {
      if (runtime.exiting && !document.hidden) {
        document.title = "游戏已退出 · 二十四点";
        els.exitScreen.hidden = false;
      }
    }, 300);
  }

  /* ------------------------------------------------------------------------
     Dialogs, toast, misc
     ------------------------------------------------------------------------ */

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  function closeAllDialogs() {
    [els.aboutDialog, els.helpDialog, els.resultDialog, els.exitDialog].forEach(
      function (dialog) {
        if (dialog.open) dialog.close();
      }
    );
  }

  function showToast(message, type) {
    if (!els.toast) return;
    if (runtime.toastTimeout) window.clearTimeout(runtime.toastTimeout);

    els.toast.textContent = message;
    els.toast.className = "toast is-visible";
    if (type === "error") els.toast.classList.add("is-error");
    if (type === "success") els.toast.classList.add("is-success");

    runtime.toastTimeout = window.setTimeout(
      function () {
        els.toast.classList.remove("is-visible");
      },
      type === "error" ? 3600 : 2800
    );
  }

  function announce(message) {
    if (!els.liveRegion) return;
    if (runtime.announceTimeout) window.clearTimeout(runtime.announceTimeout);
    els.liveRegion.textContent = "";
    runtime.announceTimeout = window.setTimeout(function () {
      els.liveRegion.textContent = message;
    }, 40);
  }

  function clearDragOver() {
    els.slotA.classList.remove("is-dragover");
    els.slotB.classList.remove("is-dragover");
  }

  function clearRuntimeForNewRound() {
    clearCountdownInterval();
    stopRoundClock();
    if (runtime.aiTimeout) window.clearTimeout(runtime.aiTimeout);
    if (runtime.resultTimeout) window.clearTimeout(runtime.resultTimeout);
    if (runtime.newResultTimer) window.clearTimeout(runtime.newResultTimer);
    if (runtime.clockInterval) window.clearInterval(runtime.clockInterval);
    runtime.aiTimeout = null;
    runtime.resultTimeout = null;
    runtime.newResultTimer = null;
    runtime.clockInterval = null;
    runtime.newResultId = null;
    state.ai.requestToken += 1;
  }

  function animateDeal() {
    els.handShelf.classList.remove("is-dealing");
    // Force a reflow so the animation can restart between deals.
    void els.handShelf.offsetWidth;
    els.handShelf.classList.add("is-dealing");
    window.setTimeout(function () {
      els.handShelf.classList.remove("is-dealing");
    }, 900);
  }

  function startRoundClock() {
    stopRoundClock();
    runtime.clockInterval = window.setInterval(updateRoundClock, 500);
    updateRoundClock();
  }

  function stopRoundClock() {
    if (runtime.clockInterval) {
      window.clearInterval(runtime.clockInterval);
      runtime.clockInterval = null;
    }
    updateRoundClock();
  }

  function updateRoundClock() {
    if (state.phase === "idle") {
      els.roundClockText.textContent = "等待开局";
      return;
    }

    if (!state.startedAt) {
      els.roundClockText.textContent = "—";
      return;
    }

    const end = state.endedAt || Date.now();
    const seconds = Math.max(0, Math.floor((end - state.startedAt) / 1000));
    const prefix = state.phase === "playing" ? "本局用时 " : "本局结束 · ";
    els.roundClockText.textContent = prefix + formatClock(seconds);
  }

  function getSlotTile(slot) {
    const id = state.slots[slot];
    if (!id) return null;
    return (
      state.tiles.find(function (tile) {
        return tile.id === id;
      }) || null
    );
  }

  function describeTile(tile) {
    if (tile.type === "result") {
      return "结果牌 " + formatFraction(tile.value);
    }
    const meta = RANK_META[tile.rank] || { name: String(tile.rank) };
    return (tile.suit ? tile.suit.name + " " : "") + meta.name;
  }

  function shakeReadout() {
    const element = els.resultReadout;
    element.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 280, easing: "ease-out" }
    );
  }

  function formatFraction(value) {
    return value.toString();
  }

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) return "0";
    return Number(value).toLocaleString("zh-CN");
  }

  function formatClock(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  /* ------------------------------------------------------------------------
     Confetti
     ------------------------------------------------------------------------ */

  function launchConfetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = els.confetti;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    if (runtime.confettiFrame) {
      window.cancelAnimationFrame(runtime.confettiFrame);
      runtime.confettiFrame = null;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ["#f5d99a", "#e2bd79", "#7be3b6", "#f5eddc", "#ee836c", "#ffffff"];
    const particles = [];

    for (let i = 0; i < 150; i += 1) {
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * width * 0.7,
        y: -20 - Math.random() * height * 0.25,
        vx: (Math.random() - 0.5) * 2.8,
        vy: 1.6 + Math.random() * 3.7,
        gravity: 0.045 + Math.random() * 0.025,
        drag: 0.995,
        width: 3 + Math.random() * 6,
        height: 5 + Math.random() * 9,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.18,
        delay: Math.random() * 180,
      });
    }

    const startedAt = performance.now();
    const life = 3000;

    function frame(now) {
      const elapsed = now - startedAt;
      context.clearRect(0, 0, width, height);

      particles.forEach(function (particle) {
        if (elapsed < particle.delay) return;

        particle.vx *= particle.drag;
        particle.vy += particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.spin;

        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.globalAlpha = clamp(1 - Math.max(0, elapsed - 2100) / 900, 0, 1);
        context.fillStyle = particle.color;
        context.fillRect(
          -particle.width / 2,
          -particle.height / 2,
          particle.width,
          particle.height
        );
        context.restore();
      });

      if (elapsed < life) {
        runtime.confettiFrame = window.requestAnimationFrame(frame);
      } else {
        context.clearRect(0, 0, width, height);
        runtime.confettiFrame = null;
      }
    }

    runtime.confettiFrame = window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     Debug / QA hook (non-enumerable, read-mostly)
     ------------------------------------------------------------------------ */

  function snapshot() {
    return {
      phase: state.phase,
      round: state.round,
      advanced: state.advanced,
      cards: state.cards.map(function (card) {
        return {
          id: card.id,
          label: card.label,
          value: card.value.toString(),
          suit: card.suit ? card.suit.symbol : null,
        };
      }),
      tiles: state.tiles.map(function (tile) {
        return {
          id: tile.id,
          type: tile.type,
          label: tile.label,
          value: tile.value.toString(),
          usedLeaves: tile.usedLeaves,
          fullExpr: tile.fullExpr,
        };
      }),
      slots: { A: state.slots.A, B: state.slots.B },
      operator: state.operator,
      history: state.history.map(function (entry) {
        return entry.text;
      }),
      timer: {
        duration: state.timer.duration,
        remaining: state.timer.remaining,
        started: state.timer.started,
        running: state.timer.running,
        endReason: state.timer.endReason,
      },
      ai: {
        status: state.ai.status,
        solutionCount: state.ai.analysis ? state.ai.analysis.solutionCount : 0,
        formulas: state.ai.analysis
          ? state.ai.analysis.solutions.slice(0, 2).map(function (solution) {
              return solution.formula;
            })
          : [],
      },
    };
  }

  Object.defineProperty(window, "__tfGame", {
    value: Object.freeze({
      snapshot: snapshot,
      deal: function (ranks) {
        if (!Array.isArray(ranks) || ranks.length !== 4) return false;
        startNewRound({ debugRanks: ranks });
        return true;
      },
      solve: solve,
    }),
    enumerable: false,
    configurable: true,
  });

  init();
})();
