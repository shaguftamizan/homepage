// Navbar: transparent at the top, solid once the page scrolls (keeps the light links readable).
// This runs first so an error in the game code below can never stop it.
(function () {
  var nav = document.querySelector("nav");
  if (!nav) return;
  function update() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    nav.classList.toggle("scrolled", y > 40);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("load", update);
})();

// Close buttons: one delegated click handler, so they keep working even if the game code has a problem.
//  - X on the game-over popup: closes the popup (and, on phones, the game popup behind it too)
//  - X on the phone game popup, or a tap on the dark backdrop: closes the game popup
(function () {
  var dlg = document.getElementById("over");
  var phone = window.matchMedia("(max-width: 640px)");
  function closeDialog() {
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  }
  function closeGamePopup() {
    var g = document.querySelector(".game"), sc = document.getElementById("scrim");
    if (g) g.classList.remove("open");
    if (sc) sc.classList.remove("open");
    document.dispatchEvent(new Event("game-stop")); // tells the game to reset
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#close")) { closeDialog(); if (phone.matches) closeGamePopup(); }
    else if (t.closest("#gclose") || t.id === "scrim") closeGamePopup();
    else if (t === dlg) closeDialog(); // click on the dialog's backdrop
  });
})();

(function () {
  // Timezones in the southern hemisphere (seasons are flipped)
  var SOUTH = /^(Australia\/|Antarctica\/|Pacific\/(Auckland|Fiji|Tongatapu|Apia|Norfolk|Chatham)|America\/(Sao_Paulo|Argentina\/|Buenos_Aires|Santiago|Lima|La_Paz|Asuncion|Montevideo|Bahia|Fortaleza|Recife|Manaus|Cuiaba|Campo_Grande|Belem)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Luanda|Lubumbashi)|Indian\/(Mauritius|Reunion|Antananarivo))/;

  // Monsoon-climate regions (South and Southeast Asia)
  var MONSOON = /^Asia\/(Kolkata|Calcutta|Dhaka|Dacca|Karachi|Colombo|Kathmandu|Katmandu|Thimphu|Yangon|Rangoon|Bangkok|Ho_Chi_Minh|Saigon|Phnom_Penh|Vientiane|Manila)/;

  function detectSeason() {
    var tz = "", m = new Date().getMonth(); // 0 = Jan
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}

    if (MONSOON.test(tz)) {
      if (m === 11 || m <= 0) return "winter";   // Dec-Jan
      if (m <= 2) return "spring";               // Feb-Mar
      if (m <= 4) return "summer";               // Apr-May
      if (m <= 8) return "monsoon";              // Jun-Sep
      return "fall";                             // Oct-Nov
    }
    if (SOUTH.test(tz)) m = (m + 6) % 12;        // flip the calendar

    if (m >= 2 && m <= 4) return "spring";       // Mar-May
    if (m >= 5 && m <= 7) return "summer";       // Jun-Aug
    if (m >= 8 && m <= 10) return "fall";        // Sep-Nov
    return "winter";                             // Dec-Feb
  }

  document.documentElement.setAttribute("data-season", detectSeason());
})();

// "How many ∞ can you find in 30 seconds?"
(function () {
  var DUR = 30000, LIFE = 3000, MAX_UP = 7, SIZE = 81,
      HARD_AT = 15000, FAST_LIFE = 1500, MAX_HARD = 13, // after 15s: more ∞, shown for less time
      mq = window.matchMedia("(max-width: 640px)");
  var gridEl = document.getElementById("grid"), scoreEl = document.getElementById("score"),
      timeEl = document.getElementById("time"), barEl = document.getElementById("bar"),
      playBtn = document.getElementById("play"), dlg = document.getElementById("over"),
      finalEl = document.getElementById("final"), againBtn = document.getElementById("again");
  var cells = [], playing = false, score = 0, endAt = 0, nextSpawn = 0, up = 0, raf = 0;

  function rnd(n) { return Math.floor(Math.random() * n); }
  function newDigit(old) { var d; do { d = rnd(10); } while (d === old); return d; }

  function build() {
    SIZE = mq.matches ? 16 : 81; MAX_UP = mq.matches ? 3 : 7; MAX_HARD = mq.matches ? 6 : 13; // 4x4 on phones
    gridEl.innerHTML = ""; cells = []; up = 0;
    gridEl.style.setProperty("--cols", mq.matches ? 4 : 9);
    for (var i = 0; i < SIZE; i++) {
      var el = document.createElement("button");
      el.type = "button"; el.className = "cell"; el.tabIndex = -1;
      el.innerHTML = '<span class="inner"><span class="face front"></span><span class="face back">∞</span></span>';
      var cell = { el: el, front: el.querySelector(".front"), digit: rnd(10), inf: false, until: 0, change: 0 };
      cell.front.textContent = cell.digit;
      el.addEventListener("click", onClick.bind(null, cell));
      gridEl.appendChild(el); cells.push(cell);
    }
  }
  function unflip(cell, now) {
    if (cell.inf) up--;
    cell.inf = false; cell.el.classList.remove("flipped");
    cell.digit = newDigit(cell.digit); cell.front.textContent = cell.digit;
    cell.change = now + LIFE;
  }
  function pulse(cell, cls) {
    cell.el.classList.remove("hit", "miss"); void cell.el.offsetWidth; cell.el.classList.add(cls);
  }
  function onClick(cell) {
    if (!playing) return;
    if (cell.inf) {
      score++; scoreEl.textContent = score;
      unflip(cell, performance.now()); pulse(cell, "hit");
    } else pulse(cell, "miss");
  }
  function tick(now) {
    if (now >= endAt) return end();
    var left = endAt - now;
    timeEl.textContent = Math.ceil(left / 1000);
    barEl.style.transform = "scaleX(" + (left / DUR).toFixed(3) + ")";
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.inf) { if (now >= c.until) unflip(c, now); }
      else if (now >= c.change) { c.digit = newDigit(c.digit); c.front.textContent = c.digit; c.change = now + LIFE; }
    }
    if (now >= nextSpawn) {
      var hard = now >= endAt - DUR + HARD_AT; // second half of the round
      if (up < (hard ? MAX_HARD : MAX_UP)) {
        var c2 = cells[rnd(cells.length)], tries = 0;
        while (c2.inf && tries++ < 20) c2 = cells[rnd(cells.length)];
        if (!c2.inf) { c2.inf = true; c2.until = now + (hard ? FAST_LIFE : LIFE); c2.el.classList.add("flipped"); up++; }
      }
      nextSpawn = now + (hard ? 120 + Math.random() * 380 : 250 + Math.random() * 850); // random rhythm, faster later
    }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    var now = performance.now();
    score = 0; up = 0; scoreEl.textContent = "0"; timeEl.textContent = "30";
    cells.forEach(function (c) {
      c.inf = false; c.el.classList.remove("flipped", "hit", "miss");
      c.digit = rnd(10); c.front.textContent = c.digit; c.change = now + Math.random() * LIFE; // staggered
    });
    endAt = now + DUR; nextSpawn = now + 400; playing = true;
    gridEl.classList.remove("idle"); playBtn.disabled = true; playBtn.textContent = "Go!";
    if (dlg.open) dlg.close();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function end() {
    playing = false; cancelAnimationFrame(raf);
    cells.forEach(function (c) { c.inf = false; c.el.classList.remove("flipped"); });
    up = 0; timeEl.textContent = "0"; barEl.style.transform = "scaleX(0)";
    gridEl.classList.add("idle"); playBtn.disabled = false; playBtn.textContent = "Play again";
    finalEl.textContent = score;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }

  function stop() { // reset without showing the popup
    playing = false; cancelAnimationFrame(raf); up = 0;
    scoreEl.textContent = "0"; timeEl.textContent = "30"; barEl.style.transform = "scaleX(1)";
    cells.forEach(function (c) { c.inf = false; c.el.classList.remove("flipped"); });
    gridEl.classList.add("idle"); playBtn.disabled = false; playBtn.textContent = "Play";
  }
  var game = document.querySelector(".game"), scrim = document.getElementById("scrim");
  function openGame() { game.classList.add("open"); scrim.classList.add("open"); }
  function closeGame() { stop(); game.classList.remove("open"); scrim.classList.remove("open"); }

  build();
  var onMq = function () { closeGame(); build(); };
  if (mq.addEventListener) mq.addEventListener("change", onMq); else mq.addListener(onMq);
  playBtn.addEventListener("click", start);
  againBtn.addEventListener("click", start);
  document.getElementById("cta").addEventListener("click", openGame);
  document.addEventListener("game-stop", stop);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && game.classList.contains("open") && !dlg.open) closeGame();
  });
})();