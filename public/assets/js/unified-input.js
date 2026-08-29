(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TriageUnifiedInput = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // routeInput: pure text classifier.
  // Returns "CLINICAL", "GENERAL", or "AMBIGUOUS".
  // No special-casing of exact submitted-prompt bytes.
  // ---------------------------------------------------------------------------

  var GENERAL_KEYWORDS = /\b(?:explain|summari[sz]e|compare|why|what|how|define|list|describe|outline)\b|\?/i;

  var AGE_TOKEN = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?\s*(?:months?|years?|weeks?|days?)\s+old\b/i;

  var SYMPTOM_CUES = [
    /\bcough\b/i,
    /\bfever\b/i,
    /\bbreath(?:ing|less)\b/i,
    /\bdiarrho?ea\b/i,
    /\bvomit(?:ing|s)?\b/i,
    /\bconvulsion\b/i,
    /\brash\b/i,
    /\bdrinking\b/i,
    /\blethargic\b/i,
    /\bchest indrawing\b/i,
    /\bstridor\b/i,
    /\bcyanosis\b/i,
    /\bunconscious\b/i,
  ];

  function hasObservationEvidence(text) {
    // Returns true if the assertedText contains any structured observation or respiratory evidence.
    var input = assertedText(text);
    if (allObservationsAbsent(input)) return true;
    var authoritySegments = observationSegments(input)
      .filter(function (clause) { return !clauseNonAuthority(clause); });
    var authorityInput = authoritySegments.join(" ");
    return OBSERVATIONS.some(function (spec) {
      var ev = observationEvidence(authorityInput, spec);
      return ev.present || ev.absent;
    }) || (function () {
      var rv = respiratoryEvidence(authorityInput);
      return rv.present || rv.absent;
    })();
  }

  function routeInput(text) {
    var t = String(text || "").trim();
    if (!t) return "AMBIGUOUS";
    if (GENERAL_KEYWORDS.test(t)) return "GENERAL";
    if (AGE_TOKEN.test(t)) return "CLINICAL";
    var symptomCount = SYMPTOM_CUES.reduce(function (n, re) { return n + (re.test(t) ? 1 : 0); }, 0);
    if (symptomCount >= 2) return "CLINICAL";
    // Fall through to structured observation detection.
    if (hasObservationEvidence(t)) return "CLINICAL";
    return "AMBIGUOUS";
  }

  // ---------------------------------------------------------------------------
  // Structured extraction — kept for backward-compatibility with tests.
  // ---------------------------------------------------------------------------

  var OBSERVATIONS = [
    ["cannotDrinkOrBreastfeed", /\b(?:can|able to|still)\s+(?:drink|breastfeed)|\bdrinking well\b/i, /\b(?:cannot|can't|unable to)\s+(?:drink(?:\s+or\s+breastfeed)?|breastfeed)\b/i, true],
    ["vomitsEverything", /\b(?:does not|doesn't|not) vomit everything\b|\bno vomiting\b/i, /\bvomits? everything\b/i, true],
    ["convulsions", /\bno convulsions?\b/i, /\bconvulsions?\b/i, false],
    ["lethargicOrUnconscious", /\b(?:not lethargic|conscious and alert|alert and responsive)\b/i, /\b(?:letharg(?:ic|y)(?:\s+or\s+unconscious(?:ness)?)?|unconscious(?:ness)?)\b/i, false],
    ["chestIndrawing", /\b(?:no|without)\s+chest indrawing\b/i, /\bchest indrawing\b/i, false],
    ["stridorWhenCalm", /\bno stridor\s+(?:when|while)\s+calm\b/i, /\bstridor\s+(?:when|while)\s+calm\b/i, false],
    ["lowOxygenOrCentralCyanosis", /\b(?:no low oxygen|no central cyanosis|oxygen (?:is )?normal)\b/i, /\b(?:low oxygen(?:\s+or\s+central cyanosis)?|central cyanosis)\b/i, false],
  ];
  var RESPIRATORY = [
    "respiratoryConcern",
    /\b(?:no|without)\s+(?:cough\s+or\s+difficult breathing|difficult breathing|cough)\b/i,
    /\b(?:cough\s+or\s+difficult breathing|difficult breathing|cough)\b/i,
    false,
  ];
  var NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

  function numericToken(token) {
    var normalized = String(token).toLowerCase();
    return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, normalized) ? NUMBER_WORDS[normalized] : Number(normalized);
  }

  function uniqueValues(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }

  function ageCandidates(text) {
    var pattern = /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?\s*(months?|years?)(?:\s+old)?\b/gi;
    var ages = [];
    var match;
    while ((match = pattern.exec(text))) ages.push({ value: numericToken(match[1]), unit: match[2].toLowerCase().startsWith("year") ? "years" : "months" });
    return ages;
  }

  function rateCandidates(text) {
    var pattern = /\b(?:breath(?:ing)?|respiratory\s+rate)(?:\s+(?:is|was|counted\s+at))?\s+(\d{1,3})(?:\s+breaths?)?\s*(?:per|\/)\s*min(?:ute)?\b/gi;
    var rates = [];
    var match;
    while ((match = pattern.exec(text))) rates.push(Number(match[1]));
    return uniqueValues(rates);
  }

  function assertedText(text) {
    var asserted = maskQuotedSpans(String(text || ""));
    asserted = asserted.replace(/(?:^|[.!;])[^.!;?]*\?/g, " ");
    asserted = asserted.replace(/\b(?:asked|asks?|wondered|wonders?)\s+whether\b[^.!?;]*/gi, " ");
    asserted = asserted.replace(/\b(?:if|whether|assuming|suppose(?:\s+that)?)\b[^.!?;]*/gi, " ");
    return asserted;
  }

  function letter(character) {
    return Boolean(character && /[A-Za-z]/.test(character));
  }

  function quoteEnd(text, start, close) {
    for (var index = start + 1; index < text.length; index += 1) {
      if (text[index] !== close) continue;
      if ((close === "'" || close === "’") && letter(text[index - 1]) && letter(text[index + 1])) continue;
      return index;
    }
    return -1;
  }

  function maskQuotedSpans(text) {
    var closes = { "‘": "’", "'": "'", "\"": "\"", "“": "”" };
    var output = "";
    for (var index = 0; index < text.length;) {
      var close = closes[text[index]];
      var boundary = index === 0 || !/[A-Za-z0-9]/.test(text[index - 1]);
      var end = close && boundary ? quoteEnd(text, index, close) : -1;
      if (end < 0) { output += text[index]; index += 1; continue; }
      output += " ".repeat(end - index + 1);
      index = end + 1;
    }
    return output;
  }

  function patternMatches(text, pattern) {
    var flags = pattern.flags.replace("g", "") + "g";
    var matcher = new RegExp(pattern.source, flags);
    var matches = [];
    var match;
    while ((match = matcher.exec(text))) matches.push({ start: match.index, end: match.index + match[0].length });
    return matches;
  }

  function rangesOverlap(left, right) {
    return left.start < right.end && right.start < left.end;
  }

  function observationCount(clause) {
    return OBSERVATIONS.reduce(function (count, spec) {
      return count + patternMatches(clause, spec[2]).length;
    }, 0);
  }

  function observationKeys(text) {
    return OBSERVATIONS.filter(function (spec) { return patternMatches(text, spec[2]).length; })
      .map(function (spec) { return spec[0]; });
  }

  function differentObservation(left, right) {
    var leftKeys = observationKeys(left);
    var rightKeys = observationKeys(right);
    return leftKeys.some(function (key) { return rightKeys.some(function (other) { return other !== key; }); });
  }

  function splitObservationClause(clause) {
    var parts = clause.split(/(\s*,\s*|\s+\b(?:and|or)\b\s+)/i);
    var segments = [];
    var current = parts[0] || "";
    for (var index = 1; index < parts.length; index += 2) {
      var next = parts[index + 1] || "";
      if (differentObservation(current, next)) { segments.push(current); current = next; }
      else current += parts[index] + next;
    }
    segments.push(current);
    return segments;
  }

  function observationSegments(text) {
    return text.split(/[.!?;]+|\bbut\b|\bhowever\b/gi).reduce(function (segments, clause) {
      return segments.concat(splitObservationClause(clause));
    }, []);
  }

  function splitPatternClause(clause, pattern) {
    var parts = clause.split(/(\s*,\s*|\s+\b(?:and|or)\b\s+)/i);
    var segments = [];
    var current = parts[0] || "";
    for (var index = 1; index < parts.length; index += 2) {
      var next = parts[index + 1] || "";
      var joined = current + parts[index] + next;
      var crossesBoundary = patternMatches(joined, pattern).some(function (range) {
        return range.start < current.length + parts[index].length && range.end > current.length;
      });
      if (!crossesBoundary && patternMatches(current, pattern).length && patternMatches(next, pattern).length) {
        segments.push(current); current = next;
      } else current += parts[index] + next;
    }
    segments.push(current);
    return segments;
  }

  function localPolarity(clause, occurrence, negativeRanges, inherentPresent) {
    var suffixText = clause.slice(occurrence.end);
    var prefix = clause.slice(0, occurrence.start);
    if (/^\s+(?:(?:is|was|were|are)\s+)?(?:documented|recorded)\s+(?:as\s+)?present\b/i.test(suffixText)) return "PRESENT";
    if (/^\s+(?:(?:is|was|were|are)\s+)?(?:documented|recorded)\s+(?:as\s+)?absent\b/i.test(suffixText)) return "ABSENT";
    if (/^\s+(?:(?:is|was|were|are)\s+)?(?:not\s+(?:assessed|recorded|provided|established)|unknown|documented|possible|suspected|uncertain|absent-minded)(?![-\w])/i.test(suffixText) ||
        /^\s+(?:may|might|could)\b/i.test(suffixText)) return "NONE";
    if (/\b(?:check|screen)(?:ed|ing)?\s+for\s+(?:no\s+)?$/i.test(prefix) ||
        /\b(?:used\s+the\s+)?(?:word|phrase)\s+(?:no\s+)?$/i.test(prefix)) return "NONE";
    if (/\b(?:may|might|possible|possibly|suspected|uncertain|cannot\s+rule\s+out)\s+$/i.test(prefix)) return "NONE";
    if (negativeRanges.some(function (range) { return rangesOverlap(range, occurrence); })) return "ABSENT";
    if (/^\s+(?:(?:is|was|were|are)\s+)?not\s+(?:present|observed|documented)\b/i.test(suffixText) || /^\s+denied\b/i.test(suffixText)) return "ABSENT";
    if (/^\s+(?:(?:is|was|were|are)\s+)?(?:absent(?![-\w])|ruled\s+out\b)/i.test(suffixText)) return "ABSENT";
    if (/^\s+(?:(?:is|was|were|are)\s+)?(?:present|observed|noted|reported)\b/i.test(suffixText)) return "PRESENT";
    if (/\b(?:denied|no\s+history\s+of|no\s+evidence\s+of|no\s+clear(?:\s+evidence\s+of)?)\s+$/i.test(prefix)) return "ABSENT";
    if (/\b(?:has\s+(?:never|not)\s+(?:had|been)|never\s+had|(?:has|had)\s+not\s+shown|no\s+(?:reported|observed|noted|documented|recorded)|(?:does|did)\s+not\s+(?:have|show))\s+(?:a\s+)?$/i.test(prefix)) return "ABSENT";
    if (/\b(?:(?:does|did)\s+not\s+have|(?:is|was|are)\s+without|ruled\s+out)\s+(?:a\s+)?$/i.test(prefix)) return "ABSENT";
    if (/\b(?:has|had|with|shows?|is|was|are|observed|noted|reports?|reported)\s+(?:a\s+)?$/i.test(prefix)) return "PRESENT";
    if (/\b(?:documented|recorded)\s+$/i.test(prefix) && /^\s+(?:as\s+)?present\b/i.test(suffixText)) return "PRESENT";
    if (/\b(?:documented|recorded)\s+$/i.test(prefix) && /^\s+(?:as\s+)?absent\b/i.test(suffixText)) return "ABSENT";
    if (/\b(?:documented|recorded)\s+$/i.test(prefix)) return "NONE";
    return inherentPresent ? "INHERENT" : null;
  }

  function clauseNonAuthority(clause) {
    return /\b(?:training\s+example|for\s+example|this\s+example|(?:an\s+)?example\s+shows?|example\s+patient|hypothetical|the\s+(?:word|phrase)|says)\b|\bexample\s*:/i.test(clause) ||
      /^\s*(?:check|screen)\b/i.test(clause) ||
      /\b(?:may|might|possible|possibly|suspected|uncertain|cannot\s+rule\s+out)\b/i.test(clause);
  }

  function observationEvidence(text, spec) {
    var evidence = { present: false, absent: false };
    text.split(/[.!?;]+|\bbut\b|\bhowever\b/gi).forEach(function (fullClause) {
      var sharedAbsent = observationCount(fullClause) > 1 &&
        !/^\s*not\b/i.test(fullClause) &&
        /\b(?:(?:is|was|were|are)\s+)?absent(?![-\w])\s*$/i.test(fullClause);
      splitObservationClause(fullClause).forEach(function (clause) {
        var negativeRanges = patternMatches(clause, spec[1]);
        var occurrences = patternMatches(clause, spec[2]);
        if (clauseNonAuthority(clause)) return;
        var standaloneNegative = negativeRanges.some(function (range) {
          return !occurrences.some(function (occurrence) { return rangesOverlap(range, occurrence); });
        });
        if (standaloneNegative) evidence.absent = true;
        occurrences.forEach(function (occurrence) {
          var polarity = localPolarity(clause, occurrence, negativeRanges, spec[3]);
          if (polarity === "NONE") return;
          if (polarity === "PRESENT") evidence.present = true;
          else if (polarity === "ABSENT" || sharedAbsent) evidence.absent = true;
          else if (polarity === "INHERENT") evidence.present = true;
        });
      });
    });
    return evidence;
  }

  function respiratoryEvidence(text) {
    var evidence = { present: false, absent: false };
    text.split(/[.!?;]+|\bbut\b|\bhowever\b/gi).forEach(function (fullClause) {
      var sharedAbsent = patternMatches(fullClause, RESPIRATORY[2]).length > 1 &&
        /\b(?:(?:is|was|were|are)\s+)?absent(?![-\w])\s*$/i.test(fullClause);
      splitPatternClause(fullClause, RESPIRATORY[2]).forEach(function (clause) {
        if (clauseNonAuthority(clause)) return;
        var negativeRanges = patternMatches(clause, RESPIRATORY[1]);
        var occurrences = patternMatches(clause, RESPIRATORY[2]);
        if (negativeRanges.length && !occurrences.length) evidence.absent = true;
        occurrences.forEach(function (occurrence) {
          var polarity = localPolarity(clause, occurrence, negativeRanges, false);
          if (polarity === "PRESENT") evidence.present = true;
          else if (polarity === "ABSENT" || (sharedAbsent && polarity !== "PRESENT")) evidence.absent = true;
        });
      });
    });
    return evidence;
  }

  function allObservationsAbsent(text) {
    return text.split(/[.!;]+/).some(function (clause) {
      return /^\s*all\s+(?:seven|7)\s+(?:structured\s+)?(?:danger and breathing\s+)?observations?\s+(?:were\s+|are\s+)?(?:recorded\s+)?absent\s*$/i.test(clause);
    });
  }

  // ---------------------------------------------------------------------------
  // DOM wiring — capture-phase interceptor on #assess.
  // Lazy: all getElementById calls are guarded so this module loads safely in
  // a test environment where document.getElementById returns null.
  // ---------------------------------------------------------------------------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showResult() {
    var result = typeof document !== "undefined" && document.getElementById("result");
    if (result) result.classList.remove("hidden");
  }

  function renderAssistAnswer(data) {
    // Render /assist `answer` event into #card region.
    var card = typeof document !== "undefined" && document.getElementById("card");
    var err = typeof document !== "undefined" && document.getElementById("err");
    if (!card) return;
    if (err) err.textContent = "";
    card.classList.remove("hidden");
    var text = (data && data.answer) ? esc(data.answer) : "";
    var uncertainty = (data && data.uncertainty && data.uncertainty.length)
      ? "<ul class=\"flags\">" + data.uncertainty.map(function (u) { return "<li>" + esc(u) + "</li>"; }).join("") + "</ul>"
      : "";
    card.innerHTML = "<div class=\"action\">" + text + "</div>" + uncertainty;
    showResult();
  }

  function renderAssistRejected(data) {
    var err = typeof document !== "undefined" && document.getElementById("err");
    if (err) err.textContent = (data && data.reason) || "This question could not be answered.";
    showResult();
  }

  function renderClarification(caseText) {
    // Render inline AMBIGUOUS clarification into #card.
    var card = typeof document !== "undefined" && document.getElementById("card");
    var err = typeof document !== "undefined" && document.getElementById("err");
    if (!card) return;
    if (err) err.textContent = "";
    card.classList.remove("hidden");
    card.innerHTML =
      "<div class=\"action\">Assess this as a patient case, or answer it as a general question?" +
      "</div><div style=\"margin-top:12px;display:flex;gap:10px\">" +
      "<button id=\"_clarify_clinical\" class=\"btn btn--primary\" type=\"button\">Patient case</button>" +
      "<button id=\"_clarify_general\" class=\"btn\" type=\"button\">General question</button>" +
      "</div>";
    showResult();
    var btnClinical = card && card.querySelector("#_clarify_clinical");
    var btnGeneral = card && card.querySelector("#_clarify_general");
    if (btnClinical) btnClinical.addEventListener("click", function () { dispatchClinical(); });
    if (btnGeneral) btnGeneral.addEventListener("click", function () { runAssist(caseText); });
  }

  function dispatchClinical() {
    // Fire a new click that bypasses the capture interceptor (assessEl.onclick = runAssess in triage.js).
    var assessEl = typeof document !== "undefined" && document.getElementById("assess");
    if (!assessEl) return;
    // Remove our interceptor, dispatch a synthetic click, then re-attach.
    assessEl.removeEventListener("click", captureInterceptor, true);
    assessEl.click();
    assessEl.addEventListener("click", captureInterceptor, true);
  }

  async function runAssist(text) {
    var card = typeof document !== "undefined" && document.getElementById("card");
    var err = typeof document !== "undefined" && document.getElementById("err");
    if (card) { card.classList.remove("hidden"); card.innerHTML = "<div class=\"action muted\">Thinking…</div>"; }
    if (err) err.textContent = "";
    showResult();
    var buf = "";
    try {
      var r = await fetch("/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!r.ok || !r.body) {
        var msg = "Could not get an answer (" + r.status + ").";
        try { var j = await r.json(); if (j && j.error) msg = j.error; } catch (e2) {}
        if (err) err.textContent = msg;
        if (card) card.classList.add("hidden");
        return;
      }
      var reader = r.body.getReader();
      var dec = new TextDecoder();
      for (;;) {
        var res = await reader.read();
        if (res.done) break;
        buf += dec.decode(res.value, { stream: true });
        var i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          var block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (block.charAt(0) === ":") continue;
          var evMatch = block.match(/^event: (.*)$/m);
          var dataLine = block.match(/^data: (.*)$/m);
          if (!evMatch || !dataLine) continue;
          var ev = evMatch[1];
          var d;
          try { d = JSON.parse(dataLine[1]); } catch (e3) { continue; }
          if (ev === "answer") renderAssistAnswer(d);
          else if (ev === "rejected") renderAssistRejected(d);
        }
      }
    } catch (e) {
      if (err) err.textContent = "Could not get an answer. " + (e && e.message ? e.message : "");
      if (card) card.classList.add("hidden");
    }
  }

  function captureInterceptor(e) {
    var ta = typeof document !== "undefined" && document.getElementById("case");
    var text = ta ? ta.value.trim() : "";
    if (!text) return; // empty — let triage.js handle the "describe a case first" message
    var route = routeInput(text);
    if (route === "CLINICAL") return; // proceed to triage.js runAssess
    e.preventDefault();
    e.stopImmediatePropagation();
    if (route === "GENERAL") {
      runAssist(text);
    } else {
      renderClarification(text);
    }
  }

  // Attach the capture-phase interceptor once the DOM is available.
  // Guard: only run DOM wiring when document exists (not in test/node environments).
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function () {
      var assessEl = document.getElementById("assess");
      if (assessEl) assessEl.addEventListener("click", captureInterceptor, true);
    });
    // If DOMContentLoaded already fired (script loaded after DOM is ready):
    if (document.readyState === "interactive" || document.readyState === "complete") {
      var assessEl = document.getElementById("assess");
      if (assessEl) assessEl.addEventListener("click", captureInterceptor, true);
    }
  }

  return { routeInput: routeInput };
});
