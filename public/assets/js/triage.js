// triage.js · Triage-0 single-prompt streaming render, English only.
// Ported from /Users/MAC/triage-0/public/assets/js/triage.js.
// Removed: I18N dictionaries, t()/setUiLang()/langName(), STT/record block (#rec,
//   blobTo16kWav, encodeWav16, /transcribe), TTS block (prepareGuidanceAudio,
//   planToSpeech, /tts, #audioWrap, #ttsStatus), non-English reasoning suppression.
// Kept: /health chrome + proof chips + setup banner, seed chip fill, renderStage /
//   renderCitation / renderCard / renderPlan / doseTable / citeMini, reason wait-timer,
//   runAssess (POST /triage SSE + AbortController + Stop toggle), Ctrl/Cmd+Enter submit,
//   handleEvent for stage/citation/first_token/card/plan/abstain/error, module.exports hook.
// Plain vanilla JS, no build step.
(function () {
  var $ = function (id) { return document.getElementById(id); };

  // Inline SVG icons (no emoji in a clinical tool). Decorative: aria-hidden so screen
  // readers skip the path noise; the surrounding text carries the meaning.
  var ICON = {
    guide: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>',
    alert: '<svg aria-hidden="true" class="sev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/></svg>',
    check: '<svg aria-hidden="true" class="sev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    stop: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    checkSm: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    shield: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    chip: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/></svg>'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- /health: egress badge + on-device proof chips + setup banner ----
  fetch("/health").then(function (r) { return r.json(); }).then(function (h) {
    if ($("hChunks")) $("hChunks").textContent = h.chunks != null ? h.chunks : "·";

    // Drive the badge from the server's egress guard, not navigator.onLine.
    var eg = h.egress || {};
    var net = $("net");
    if (net && eg.armed) {
      var btxt = net.querySelector(".badge-txt");
      if (btxt) btxt.textContent = "On-device";
      net.classList.add("is-offline");
      net.classList.remove("is-online");
      net.dataset.egress = "1";
      net.title = "On-device only. Egress guard armed" + (eg.strict ? " (strict)" : "") +
        " — network calls this session: " + (eg.violations || 0) + " blocked.";
    }

    // On-device proof chips: egress guarantee + resident model, both from /health.
    var proof = $("odProof");
    if (proof) {
      var chips = [];
      if (eg.armed) {
        chips.push(
          '<span class="od-chip od-chip--seal">' + ICON.shield +
          "Network calls this session: " + (eg.violations || 0) +
          (eg.strict ? " &middot; egress blocked (strict)" : "") + "</span>"
        );
      }
      if (eg.armed && h.medpsy) {
        chips.push('<span class="od-chip">' + ICON.chip + "MedPsy " + esc(String(h.medpsy).toUpperCase()) + " &middot; runs on this Mac</span>");
      }
      if (chips.length) { proof.innerHTML = chips.join(""); proof.hidden = false; }
    }

    // Show setup banner when the WHO guideline store is empty.
    var banner = $("setupBanner");
    if (banner && (h.chunks === 0 || h.ragLive === false)) {
      banner.innerHTML =
        "<strong>Setup needed.</strong> The WHO guideline store is empty, so every case will abstain. " +
        "Run <code>npm run ingest</code> in the project folder, then restart the server.";
      banner.classList.remove("hidden");
    }
  }).catch(function () {});

  // ---- seed chip fill ----
  var seedRow = $("seeds");
  if (seedRow) {
    seedRow.querySelectorAll(".seed").forEach(function (b) {
      b.addEventListener("click", function () {
        var fill = b.getAttribute("data-fill") || "";
        var ta = $("case");
        if (ta) { ta.value = fill; ta.focus(); }
        if ($("status")) $("status").textContent = "";
      });
    });
  }

  // ---- render ----
  function renderCitation(c) {
    var box = $("citationBox");
    box.classList.remove("hidden");
    // If a citation is already shown, update in-place to avoid re-triggering the entrance animation.
    var cite = box.querySelector(".cite");
    if (cite) {
      var q = cite.querySelector(".q");
      if (q) q.textContent = '"' + c.section + '"';
      cite.querySelector(".src").textContent = esc(c.doc) + ", page " + esc(String(c.page)) + ". Found in the guidelines on this device.";
      return;
    }
    var fromTxt = c.protocol
      ? "From the WHO " + esc(c.protocol) + " guideline"
      : "From the WHO guideline";
    box.innerHTML =
      '<div class="cite">' +
        '<span class="from">' + ICON.guide + fromTxt + "</span>" +
        (c.section ? '<span class="q">"' + esc(c.section) + '"</span>' : "") +
        '<span class="src">' + esc(c.doc) + ", page " + esc(String(c.page)) + ". Found in the guidelines on this device.</span>" +
      "</div>";
  }

  function renderCard(card, classification) {
    finishStages();
    if ($("reasoningWrap")) $("reasoningWrap").classList.add("hidden");
    $("card").classList.remove("hidden");
    var sev = card.severity;
    var ico = (sev === "ROUTINE" || sev === "SELF_CARE") ? ICON.check : ICON.alert;
    var flags = (card.red_flags || []).map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("");
    // Confidence chip (neutral styling; severity remains the only loud colour).
    var conf = card.confidence;
    var confLabels = { high: "high confidence", medium: "medium confidence", low: "low confidence" };
    var confChip = (conf && sev !== "UNKNOWN")
      ? '<span class="conf conf--' + esc(conf) + '" title="The model\'s self-reported confidence in this classification">' + esc(confLabels[conf] || conf) + "</span>"
      : "";
    var dx = (classification && sev !== "UNKNOWN")
      ? '<div class="dx"><span class="dx-label">Classification</span><span class="dx-name">' + esc(classification) + "</span>" + confChip + '<span class="dx-hint">1 of 27 WHO classes</span></div>'
      : "";
    // Severity action labels.
    var sevLabels = {
      EMERGENCY: "Refer now", URGENT: "Treat now and follow up",
      ROUTINE: "Home care", SELF_CARE: "Self-care advice", UNKNOWN: "No matching guideline"
    };
    var abstainMsg = "This didn't match a WHO protocol. Triage-0 covers under-5 childhood illness and mental health for any age — check the description fits (the person's age and the signs you see), then rephrase or tap Speak again. If it is a real case outside this scope, escalate to a clinician.";
    $("card").innerHTML =
      '<div class="verdict">' +
        '<div class="sev ' + sev + '">' + ico + sev + "</div>" +
        '<div class="sev-note">' + esc(sevLabels[sev] || sev) + "</div>" +
      "</div>" +
      dx +
      (sev !== "UNKNOWN" && card.reasoning ? '<div class="why">' + esc(card.reasoning) + "</div>" : "") +
      '<div class="action">' + (sev === "UNKNOWN" ? abstainMsg : esc(card.action)) + "</div>" +
      (flags ? '<ul class="flags">' + flags + "</ul>" : "") +
      (sev !== "UNKNOWN" ? '<div id="planWrap" class="plan-pending" role="status" aria-live="polite">Preparing the full management plan</div>' : "");
    lastCard = card;
    // Scroll the card into view on small screens so severity is the first thing the worker sees.
    if (window.matchMedia && window.matchMedia("(max-width:560px)").matches) {
      $("card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ---- management plan ----
  function shortDoc(doc) {
    // "WHO IMCI Chart Booklet (2014)" -> "WHO IMCI"; "WHO mhGAP Intervention Guide v2.0" -> "WHO mhGAP".
    return String(doc).split(/\s+/).slice(0, 2).join(" ");
  }
  function citeMini(c) {
    if (!c) return "";
    return '<span class="cmini">' + esc(shortDoc(c.doc)) + " p." + esc(String(c.page)) + "</span>";
  }
  function pgroup(title, inner) {
    return '<div class="pgroup"><h4>' + esc(title) + "</h4>" + inner + "</div>";
  }
  function prow(text, c) {
    return '<div class="prow"><span class="ptext">' + esc(text) + "</span>" + citeMini(c) + "</div>";
  }
  function listGroup(title, arr, field) {
    if (!arr || !arr.length) return "";
    return pgroup(title, arr.map(function (x) { return prow(x[field], x.citation); }).join(""));
  }
  function doseTable(bands) {
    if (!bands || !bands.length) return "";
    return '<table class="dose"><thead><tr><th>Age / weight</th><th>Dose</th></tr></thead><tbody>' +
      bands.map(function (b) {
        return '<tr><td class="dose-band">' + esc(b.band) + '</td><td class="dose-amt">' + esc(b.dose) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  function renderPlan(plan) {
    var wrap = $("planWrap");
    if (!wrap) return;
    var parts = [];
    if (plan && plan.medicines && plan.medicines.length) {
      var meds = plan.medicines.map(function (m) {
        var head = '<div class="med-top"><span class="med-name">' + esc(m.name) + "</span>" + citeMini(m.citation) + "</div>";
        var sub = [];
        if (m.strength) sub.push(esc(m.strength));
        if (m.frequency) sub.push(esc(m.frequency));
        if (m.duration) sub.push(esc(m.duration));
        var subHtml = sub.length ? '<div class="med-sub">' + sub.join(" &middot; ") + "</div>" : "";
        var detail = (m.bands && m.bands.length) ? doseTable(m.bands) : (m.dose ? '<div class="med-sub">Dose: ' + esc(m.dose) + "</div>" : "");
        return '<div class="med">' + head + subHtml + detail + "</div>";
      }).join("");
      parts.push(pgroup("Medicines", meds));
    }
    parts.push(listGroup("Supportive care", plan && plan.supportive, "item"));
    parts.push(listGroup("Home care", plan && plan.home_care, "advice"));
    parts.push(listGroup("Return immediately if", plan && plan.return_now, "sign"));
    if (plan && plan.follow_up) {
      var fuInner = '<div class="prow"><span class="ptext">' + esc(plan.follow_up.when) + "</span>" + citeMini(plan.follow_up.citation) + "</div>";
      if (plan.follow_up.detail) fuInner += '<div class="prow-detail">At the visit: ' + esc(plan.follow_up.detail) + "</div>";
      parts.push(pgroup("Follow-up", fuInner));
    }
    if (plan && plan.referral) parts.push(pgroup("Referral", prow(plan.referral.criterion, plan.referral.citation)));
    parts = parts.filter(Boolean);
    if (!parts.length) { wrap.innerHTML = ""; wrap.className = ""; return; }
    wrap.className = "";
    wrap.innerHTML =
      '<div class="plan">' +
        '<div class="plan-head">' + ICON.guide + "Management plan" + "</div>" +
        parts.join("") +
        '<div class="plan-foot">Every line is taken verbatim from the WHO guidelines on this device. Doses are the WHO weight-band amounts; confirm the child\'s weight.</div>' +
      "</div>";
  }

  // ---- on-device pipeline readout ----
  function markActiveDone() {
    var box = $("plSteps");
    if (!box) return;
    var active = box.querySelector(".pl-step.is-active");
    if (active) {
      active.className = "pl-step is-done";
      var ic = active.querySelector(".pl-ic");
      if (ic) ic.innerHTML = ICON.checkSm;
    }
  }
  // English stage labels (no i18n lookup).
  function stageLabel(d) {
    switch (d.key) {
      case "detect": return "Detected " + (d.lang || "");
      case "translate_in": return "Translated case → English";
      case "retrieve": return "Searched " + (d.count != null ? d.count : "") + " WHO passages";
      case "reason": return "Reasoning on-device";
      case "classify": return "Classified: " + (d.cls || "");
      case "translate_out": return "Translated output → " + (d.lang || "");
      case "plan": return "Built WHO management plan";
      default: return d.label || d.key;
    }
  }
  var STAGE_DETAIL = {
    detect: "on-device langdetect",
    translate_in: "on-device Bergamot NMT",
    retrieve: "semantic retrieval",
    reason: "MedPsy 1.7B · on-device",
    classify: "1 of 27 WHO classes",
    translate_out: "on-device NMT",
    plan: "grounded in the cited protocol"
  };
  function renderStage(d) {
    var box = $("plSteps");
    if (!box || !d || !d.key) return;
    markActiveDone();
    var li = document.createElement("li");
    li.className = "pl-step is-active";
    li.setAttribute("data-key", String(d.key));
    var detail = STAGE_DETAIL[d.key] || (d.detail || "");
    li.innerHTML =
      '<span class="pl-ic" aria-hidden="true"></span>' +
      '<span class="pl-label">' + esc(stageLabel(d)) + "</span>" +
      (detail ? '<span class="pl-detail">' + esc(detail) + "</span>" : "");
    box.appendChild(li);
  }
  function finishStages() { markActiveDone(); }

  function handleEvent(block) {
    // SSE comment frames (keep-alives) start with ":". Ignore them.
    if (block.charAt(0) === ":") return;
    var ev = (block.match(/^event: (.*)$/m) || [])[1];
    var dataLine = (block.match(/^data: (.*)$/m) || [])[1];
    if (!ev || !dataLine) return;
    var d;
    try { d = JSON.parse(dataLine); } catch (e) { return; }
    if (ev === "stage") {
      if (d.key === "detect") {
        var h2 = $("h-guideline"); if (h2) h2.textContent = "What the guideline says";
        if ($("reasonLabel")) $("reasonLabel").textContent = "Searching the guidelines";
      }
      renderStage(d);
    } else if (ev === "citation") {
      renderCitation(d);
      if ($("reasonLabel")) $("reasonLabel").textContent = "Reading the matched guideline";
    } else if (ev === "first_token") {
      if ($("hTtft")) $("hTtft").textContent = (d.ttftMs / 1000).toFixed(1) + " s";
      if ($("reasonLabel")) $("reasonLabel").textContent = "Reasoning through the protocol";
    } else if (ev === "card") {
      gotTerminal = true;
      renderCard(d.card, d.classification);
      // Replace the early citation with the card's classification-correct citation.
      if (d.card && d.card.protocol_citation && d.card.protocol_citation.section) renderCitation({
        section: d.card.protocol_citation.section,
        doc: d.card.protocol_citation.doc,
        page: d.card.protocol_citation.page,
      });
      if (d.perf) {
        if (d.perf.ttftMs != null && $("hTtft")) $("hTtft").textContent = (d.perf.ttftMs / 1000).toFixed(1) + " s";
        if ($("hTps")) $("hTps").textContent = d.perf.tokensPerSec != null ? Number(d.perf.tokensPerSec).toFixed(1) : "·";
        if ($("hDev")) $("hDev").textContent = (d.perf.backendDevice || "·").toUpperCase();
      }
    } else if (ev === "plan") {
      renderPlan(d.plan);
    } else if (ev === "abstain") {
      gotTerminal = true;
      finishStages();
      renderCard(d.card);
    } else if (ev === "error") {
      gotTerminal = true;
      if ($("err")) $("err").textContent = d.reason || d.error || "The guidance could not be completed. Try again.";
      if ($("reasoningWrap")) $("reasoningWrap").classList.add("hidden");
    }
  }
  // Set true when a terminal frame (card/abstain/error) arrives.
  var gotTerminal = false;

  // ---- H-1: reasoning wait-timer ----
  var _rtInt = null, _rtT0 = 0;
  function startReasonTimer() {
    _rtT0 = Date.now();
    var t = $("reasonTimer");
    if (t) t.textContent = "";
    if (_rtInt) clearInterval(_rtInt);
    _rtInt = setInterval(function () {
      if (t) t.textContent = "· " + Math.floor((Date.now() - _rtT0) / 1000) + "s";
    }, 250);
  }
  function stopReasonTimer() {
    if (_rtInt) { clearInterval(_rtInt); _rtInt = null; }
    var t = $("reasonTimer");
    if (t) t.textContent = "";
  }

  // ---- assess -> /triage (SSE) ----
  var assessCtl = null;
  var lastCard = null;
  async function runAssess() {
    var caseText = $("case").value.trim();
    if (!caseText) { $("status").textContent = "Describe or record a case first."; $("case").focus(); return; }
    // Re-entrancy guard.
    if (assessCtl) return;
    gotTerminal = false;
    assessCtl = new AbortController();
    var assessLabel = $("assess").innerHTML;
    $("assess").innerHTML = ICON.stop + "Stop";
    $("assess").classList.add("is-stopping");
    $("assess").onclick = function () { if (assessCtl) assessCtl.abort(); };
    $("status").textContent = "";
    $("result").classList.remove("hidden");
    $("result").setAttribute("aria-busy", "true");
    $("citationBox").classList.add("hidden");
    $("card").classList.add("hidden");
    $("err").textContent = "";
    if ($("reasoningWrap")) $("reasoningWrap").classList.remove("hidden");
    if ($("reasoning")) $("reasoning").textContent = "";
    if ($("plSteps")) $("plSteps").innerHTML = "";
    lastCard = null;
    if ($("reasonLabel")) $("reasonLabel").textContent = "Searching the guidelines";
    if ($("hTtft")) $("hTtft").textContent = "·";
    if ($("hTps")) $("hTps").textContent = "·";
    if ($("hDev")) $("hDev").textContent = "·";
    startReasonTimer();
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    var buf = "";
    try {
      var r = await fetch("/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseText: caseText }),
        signal: assessCtl.signal
      });
      if (!r.ok || !r.body) {
        var msg = "Could not get guidance (" + r.status + ").";
        try { var j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      var reader = r.body.getReader();
      var dec = new TextDecoder();
      for (;;) {
        var res = await reader.read();
        if (res.done) break;
        buf += dec.decode(res.value, { stream: true });
        var i;
        while ((i = buf.indexOf("\n\n")) >= 0) { handleEvent(buf.slice(0, i)); buf = buf.slice(i + 2); }
      }
      if (!gotTerminal) {
        $("err").textContent = "The guidance did not finish. Try again.";
        if ($("reasoningWrap")) $("reasoningWrap").classList.add("hidden");
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        $("status").textContent = "Stopped.";
        $("err").textContent = "";
        var pw = $("planWrap");
        if (pw && /plan-pending/.test(pw.className)) { pw.textContent = ""; pw.className = ""; }
      } else {
        $("err").textContent = "Could not get guidance. " + e.message;
      }
      if ($("reasoningWrap")) $("reasoningWrap").classList.add("hidden");
    } finally {
      stopReasonTimer();
      $("assess").disabled = false;
      $("assess").innerHTML = assessLabel;
      $("assess").classList.remove("is-stopping");
      $("assess").onclick = runAssess;
      assessCtl = null;
      $("result").removeAttribute("aria-busy");
    }
  }
  if ($("assess")) $("assess").onclick = runAssess;
  // Ctrl/Cmd+Enter from the case box submits.
  if ($("case")) $("case").addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if ($("assess").classList.contains("is-stopping")) return; $("assess").click(); }
  });

  // Test hook (browser-safe: `module` is undefined in the browser, so this is a no-op there).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      esc: esc,
      renderCitation: renderCitation,
      renderCard: renderCard,
      renderPlan: renderPlan,
      renderStage: renderStage,
      handleEvent: handleEvent,
      runAssess: runAssess,
      startReasonTimer: startReasonTimer,
      stopReasonTimer: stopReasonTimer,
    };
  }
})();
