// triage.js · the Triage-0 tool logic, extracted from the original inline script.
// The active English text workflow uses /health and /triage SSE, with citation-first metadata and a
// narrowed assessment renderer. Removed speech and management events cannot recreate public capability.
// Plain vanilla JS, no build step.
(function () {
  var $ = function (id) { return document.getElementById(id); };

  // Inline SVG icons (no emoji in a clinical tool). Decorative: aria-hidden so screen
  // readers skip the path noise; the surrounding text carries the meaning.
  var ICON = {
    speaker: '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>',
    guide: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>',
    alert: '<svg aria-hidden="true" class="sev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/></svg>',
    check: '<svg aria-hidden="true" class="sev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    rec: '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/></svg>',
    stop: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    checkSm: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    shield: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    chip: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/></svg>'
  };

  // English-only public assessment copy. Templates use {placeholder} substitution.
  var I18N = {
    en: {
      langName: { en: "English" },
      reason_search: "Checking supporting references", reason_read: "Supporting reference found", reason_think: "Preparing the assessment summary",
      st_detect: "Recorded assessment received", st_retrieve: "Checked {n} local reference passages",
      st_reason: "Local model-assisted review", st_summarize: "Prepared assessment summary",
      d_langdetect: "structured observations", d_retrieval: "local reference lookup", d_medpsy: "QVAC SDK 0.13.3 · on-device", d_summary: "bounded local review",
      cite_from: "Supporting reference", cite_from_generic: "Supporting reference", cite_fixed: "Fixed policy reference", cite_retrieved: "Retrieved WHO reference", cite_src: "{doc}, page {page}.",
      outcome: "Assessment outcome", observations: "Recorded observations", uncertainty: "Uncertainty", reference: "Supporting reference",
      model_summary: "Model-assisted summary", source_excerpt: "Retrieved WHO excerpt", input_authority: "How this result was produced",
      abstain_msg: "This assessment is outside the supported scope. Escalate to a qualified clinician.",
      step2: "Assessment outcome",
    },
  };
  var uiLang = "en";
  function t(key, params) {
    var dict = I18N[uiLang] || I18N.en;
    var s = dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (params) for (var k in params) s = s.split("{" + k + "}").join(params[k]);
    return s;
  }
  function langName(code) { return (I18N[uiLang] && I18N[uiLang].langName[code]) || code; }
  function setUiLang(code) { if (I18N[code]) uiLang = code; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var DANGER_SIGNS = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed"],
    ["vomitsEverything", "Vomits everything"],
    ["convulsions", "Convulsions"],
    ["lethargicOrUnconscious", "Lethargic or unconscious"],
    ["chestIndrawing", "Chest indrawing"],
    ["stridorWhenCalm", "Stridor when calm"],
    ["lowOxygenOrCentralCyanosis", "Low oxygen or central cyanosis"],
  ];
  var clinicalState = {
    phase: "RECORD",
    requestFingerprint: null,
    confirmationToken: null,
    continuationToken: null,
    abortController: null,
    terminal: false,
    recordChangedDuringRun: false,
    generation: 0,
    confirmationPending: false,
    continuationPending: false,
  };

  var unifiedInput = typeof window !== "undefined" ? window.TriageUnifiedInput : null;
  var unifiedState = {
    candidate: null, route: "AMBIGUOUS", revision: 0, choiceRevision: null, routeOverride: null,
    reviewPresentedRevision: null, reviewedRevision: null,
  };

  function clinicalInput() { return $("case"); }

  function setChoice(name, value) {
    var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }

  function clearCandidateFields() {
    if ($("patientAgeValue")) $("patientAgeValue").value = "";
    if ($("patientWeightKg")) $("patientWeightKg").value = "";
    if ($("respiratoryRatePerMinute")) $("respiratoryRatePerMinute").value = "";
    if ($("rateCountQuality")) $("rateCountQuality").value = "NOT_CONFIRMED";
    setChoice("respiratory-concern", "NOT_ASSESSED");
    DANGER_SIGNS.forEach(function (sign) { setChoice("danger-" + sign[0], "NOT_ASSESSED"); });
  }

  function applyClinicalCandidate(candidate) {
    clearCandidateFields();
    if (!candidate) return;
    if (candidate.patientAge) {
      $("patientAgeValue").value = String(candidate.patientAge.value);
      $("patientAgeUnit").value = candidate.patientAge.unit;
    }
    if (candidate.patientWeightKg != null) $("patientWeightKg").value = String(candidate.patientWeightKg);
    if (candidate.respiratoryRatePerMinute != null) $("respiratoryRatePerMinute").value = String(candidate.respiratoryRatePerMinute);
    if (candidate.rateCountQuality) $("rateCountQuality").value = candidate.rateCountQuality;
    setChoice("respiratory-concern", candidate.respiratoryConcern);
    DANGER_SIGNS.forEach(function (sign) { setChoice("danger-" + sign[0], candidate.dangerObservations[sign[0]]); });
  }

  function selectedDangerValue(key) {
    var selected = document.querySelector('input[name="danger-' + key + '"]:checked');
    return selected ? selected.value : "NOT_ASSESSED";
  }

  function selectedRespiratoryConcern() {
    var selected = document.querySelector('input[name="respiratory-concern"]:checked');
    return selected ? selected.value : "NOT_ASSESSED";
  }

  function readStructuredDanger() {
    var observations = {};
    DANGER_SIGNS.forEach(function (sign) { observations[sign[0]] = selectedDangerValue(sign[0]); });
    var rateText = $("respiratoryRatePerMinute") ? $("respiratoryRatePerMinute").value.trim() : "";
    var structured = { dangerObservations: observations };
    var ageText = $("patientAgeValue") ? $("patientAgeValue").value.trim() : "";
    if (ageText !== "") structured.patientAge = { value: Number(ageText), unit: $("patientAgeUnit").value };
    var respiratoryConcern = selectedRespiratoryConcern();
    var broaderFocus = $("assessmentFocus") && $("assessmentFocus").value === "BROADER_WHO";
    if (!broaderFocus && respiratoryConcern !== "NOT_ASSESSED") {
      structured.respiratoryAssessment = {
        coughOrDifficultBreathing: respiratoryConcern,
        rateCountQuality: $("rateCountQuality") ? $("rateCountQuality").value : "NOT_CONFIRMED",
      };
      if (rateText !== "") structured.respiratoryAssessment.respiratoryRatePerMinute = Number(rateText);
    }
    if ($("patientWeightKg") && $("patientWeightKg").value.trim() !== "") {
      structured.patientWeightKg = Number($("patientWeightKg").value);
    }
    if ($("allergiesReviewed")) {
      structured.medicationSafety = {
        allergiesReviewed: $("allergiesReviewed").value,
        contraindicationsReviewed: $("contraindicationsReviewed").value,
        allergyDetails: [],
        contraindicationDetails: [],
      };
      structured.protocolApplicability = { status: $("protocolApplicability").value, details: [] };
    }
    return structured;
  }

  function ageBand(age) {
    if (!age) return "unsupported";
    if (age.unit !== "months" && age.unit !== "years") return "unsupported";
    var months = age.unit === "years" ? age.value * 12 : age.value;
    if (!Number.isFinite(months) || months < 0 || months > 1560) return "unsupported";
    if (months >= 2 && months < 60) return "young-child";
    if (months >= 18 * 12) return "adult";
    return "unsupported";
  }

  function updateDangerChecklist() {
    var structured = readStructuredDanger();
    var values = structured.dangerObservations;
    var assessed = DANGER_SIGNS.filter(function (sign) { return values[sign[0]] !== "NOT_ASSESSED"; }).length;
    var band = ageBand(structured.patientAge);
    var ageReady = band !== "unsupported";
    var emergency = DANGER_SIGNS.some(function (sign) {
      return sign[0] !== "chestIndrawing" && values[sign[0]] === "PRESENT";
    });
    var respiratory = structured.respiratoryAssessment || { coughOrDifficultBreathing: "NOT_ASSESSED", rateCountQuality: "NOT_CONFIRMED" };
    var broaderFocus = $("assessmentFocus") && $("assessmentFocus").value === "BROADER_WHO";
    var rateReady = Number.isInteger(respiratory.respiratoryRatePerMinute) &&
      respiratory.respiratoryRatePerMinute >= 1 && respiratory.respiratoryRatePerMinute <= 200;
    var chestReview = values.chestIndrawing === "PRESENT" && respiratory.coughOrDifficultBreathing === "PRESENT";
    var respiratoryReady = respiratory.coughOrDifficultBreathing === "ABSENT" || chestReview ||
      (respiratory.coughOrDifficultBreathing === "PRESENT" && rateReady &&
        respiratory.rateCountQuality === "ONE_MINUTE_WHILE_CALM");
    var adultReady = band === "adult";
    var childReady = band === "young-child" && assessed === DANGER_SIGNS.length && (broaderFocus || respiratoryReady);
    var policyReady = emergency || adultReady || childReady;
    var narrativeReady = Boolean(clinicalInput() && clinicalInput().value.trim());
    var weightText = $("patientWeightKg") ? $("patientWeightKg").value.trim() : "";
    var weightReady = !weightText || (Number(weightText) >= 0.5 && Number(weightText) <= 300);
    var ready = policyReady && narrativeReady && weightReady;
    if ($("patientAgeValue")) $("patientAgeValue").setAttribute("aria-invalid", String(Boolean($("patientAgeValue").value) && !ageReady));
    if ($("patientWeightKg")) $("patientWeightKg").setAttribute("aria-invalid", String(!weightReady));
    document.querySelectorAll("[data-danger-key]").forEach(function (fieldset) {
      var missing = values[fieldset.dataset.dangerKey] === "NOT_ASSESSED";
      fieldset.setAttribute("aria-invalid", String(band === "young-child" && !emergency && missing));
    });
    var breathingIncomplete = band === "young-child" && !broaderFocus && !emergency && !respiratoryReady;
    if ($("respiratoryAssessment")) $("respiratoryAssessment").setAttribute("aria-invalid", String(breathingIncomplete));
    var rateRequired = breathingIncomplete && respiratory.coughOrDifficultBreathing === "PRESENT" && !chestReview;
    if ($("respiratoryRatePerMinute")) $("respiratoryRatePerMinute").setAttribute("aria-invalid", String(rateRequired && !rateReady));
    if ($("rateCountQuality")) $("rateCountQuality").setAttribute("aria-invalid", String(rateRequired && respiratory.rateCountQuality !== "ONE_MINUTE_WHILE_CALM"));
    var status = assessed + " of " + DANGER_SIGNS.length + " signs assessed.";
    if (emergency) status += " Emergency observation ready for assessment.";
    else if (policyReady && !narrativeReady) status += " Describe the recorded case to continue.";
    else if (policyReady && !weightReady) status += " Weight must be between 0.5 and 300 kg, or left blank.";
    else if (adultReady) status += " Ready for adult WHO assessment.";
    else if (ready && broaderFocus) status += " Ready for broader WHO assessment.";
    else if (ready) status += " Ready for respiratory assessment.";
    else if (!ageReady) status += " Supported age required: 2 months to under 5 years, or 18 years and older.";
    else if (assessed === DANGER_SIGNS.length) status += " Complete the breathing assessment.";
    if ($("dangerStatus")) $("dangerStatus").textContent = status;
    if ($("dangerSummary")) {
      $("dangerSummary").textContent = "Recorded checklist: " + DANGER_SIGNS.map(function (sign) {
        var value = values[sign[0]].toLowerCase().replace("_", " ");
        return sign[1] + ": " + value.charAt(0).toUpperCase() + value.slice(1);
      }).join("; ") + ".";
    }
    if ($("assess") && !assessCtl) $("assess").disabled = !Boolean(clinicalInput() && clinicalInput().value.trim());
    return ready;
  }

  function updateUnifiedReadiness() {
    var text = clinicalInput() ? clinicalInput().value.trim() : "";
    unifiedState.route = unifiedInput && unifiedInput.routeInput ? unifiedInput.routeInput(text) : "AMBIGUOUS";
    if ($("assess") && !assessCtl && !(promptState && promptState.abortController)) $("assess").disabled = !text;
    return { ready: Boolean(text), route: unifiedState.route };
  }

  function missingClinicalFields() {
    var structured = readStructuredDanger();
    var missing = [];
    if (ageBand(structured.patientAge) === "unsupported") missing.push("patientAge");
    DANGER_SIGNS.forEach(function (sign) {
      if (structured.dangerObservations[sign[0]] === "NOT_ASSESSED") missing.push(sign[0]);
    });
    var breathing = structured.respiratoryAssessment;
    if (!breathing) missing.push("respiratoryConcern");
    else if (breathing.coughOrDifficultBreathing === "PRESENT") {
      if (!Number.isInteger(breathing.respiratoryRatePerMinute)) missing.push("respiratoryRatePerMinute");
      if (breathing.rateCountQuality !== "ONE_MINUTE_WHILE_CALM") missing.push("rateCountQuality");
    }
    return missing.concat(unifiedState.candidate ? unifiedState.candidate.conflicts : []);
  }

  function focusMissingField(field) {
    field = field.replace(/^dangerObservations\./, "").replace(/^respiratoryAssessment\./, "");
    var danger = DANGER_SIGNS.some(function (sign) { return sign[0] === field; });
    var target = danger ? document.querySelector('input[name="danger-' + field + '"]') :
      field === "respiratoryConcern" ? document.querySelector('input[name="respiratory-concern"]') : $(field);
    if (target) target.focus();
  }

  function renderMissingReview(fields) {
    var labels = Object.fromEntries(DANGER_SIGNS);
    labels.patientAge = "Patient age";
    labels.respiratoryConcern = "Cough or difficult breathing";
    labels.respiratoryRatePerMinute = "Breaths per minute";
    labels.rateCountQuality = "Count quality";
    if ($("dangerDisclosure")) { $("dangerDisclosure").hidden = false; $("dangerDisclosure").open = true; }
    if ($("missingReview")) {
      $("missingReview").textContent = "Review required: " + fields.map(function (field) {
        var key = field.replace(/^dangerObservations\./, "").replace(/^respiratoryAssessment\./, "");
        return labels[key] || field;
      }).join(", ") + ".";
      $("missingReview").classList.remove("hidden");
    }
    if (fields.length) focusMissingField(fields[0]);
  }

  function invalidatePromptRun() {
    if (!promptState || !promptState.abortController) return;
    var controller = promptState.abortController;
    promptState.runId += 1;
    promptState.abortController = null;
    promptState.jobId = null;
    promptState.terminal = true;
    controller.abort();
    if ($("cancelPrompt")) $("cancelPrompt").hidden = true;
    if ($("retryPrompt")) $("retryPrompt").hidden = true;
    if ($("sharedAnswer")) { $("sharedAnswer").textContent = ""; $("sharedAnswer").classList.add("hidden"); }
  }

  function handleUnifiedInput() {
    unifiedState.revision += 1;
    unifiedState.choiceRevision = null;
    unifiedState.routeOverride = null;
    unifiedState.reviewPresentedRevision = null;
    unifiedState.reviewedRevision = null;
    invalidatePromptRun();
    invalidateClinicalResult();
    unifiedState.candidate = unifiedInput && unifiedInput.extractClinicalCandidate
      ? unifiedInput.extractClinicalCandidate(clinicalInput().value) : null;
    applyClinicalCandidate(unifiedState.candidate);
    if ($("dangerDisclosure")) { $("dangerDisclosure").hidden = true; $("dangerDisclosure").open = false; }
    if ($("missingReview")) $("missingReview").classList.add("hidden");
    if ($("intentChoice")) { $("intentChoice").textContent = ""; $("intentChoice").classList.add("hidden"); }
    updateDangerChecklist();
    updateUnifiedReadiness();
  }

  function chooseRoute(route, revision) {
    if (revision !== unifiedState.revision) return;
    unifiedState.choiceRevision = revision;
    unifiedState.routeOverride = route;
    $("intentChoice").classList.add("hidden");
    runUnified();
  }

  function renderIntentChoice() {
    var region = $("intentChoice");
    var revision = unifiedState.revision;
    region.textContent = "";
    var clinical = document.createElement("button");
    clinical.type = "button";
    clinical.className = "btn";
    clinical.textContent = "Assess as a patient case";
    clinical.onclick = function () { chooseRoute("CLINICAL", revision); };
    var general = document.createElement("button");
    general.type = "button";
    general.className = "btn";
    general.textContent = "Answer as a general question";
    general.onclick = function () { chooseRoute("GENERAL", revision); };
    region.append(clinical, general);
    region.classList.remove("hidden");
    $("result").classList.remove("hidden");
    clinical.focus();
  }

  async function runUnified() {
    if (promptState && promptState.abortController) return;
    var readiness = updateUnifiedReadiness();
    if (!readiness.ready) { clinicalInput().focus(); return; }
    var route = unifiedState.choiceRevision === unifiedState.revision ? unifiedState.routeOverride : readiness.route;
    if (route === "AMBIGUOUS") { renderIntentChoice(); return; }
    if (route === "GENERAL") { await runPrompt(); return; }
    var complete = updateDangerChecklist();
    if (unifiedState.reviewPresentedRevision !== unifiedState.revision) {
      unifiedState.reviewPresentedRevision = unifiedState.revision;
      var missing = complete ? [] : missingClinicalFields();
      if (missing.length) renderMissingReview(missing);
      else {
        if ($("dangerDisclosure")) { $("dangerDisclosure").hidden = false; $("dangerDisclosure").open = true; }
        if ($("missingReview")) {
          $("missingReview").textContent = "Review the extracted observations, then select Get guidance again to submit this record.";
          $("missingReview").classList.remove("hidden");
        }
      }
      return;
    }
    if (!complete) { renderMissingReview(missingClinicalFields()); return; }
    unifiedState.reviewedRevision = unifiedState.revision;
    await runAssess();
  }

  function handleStructuredEdit() {
    unifiedState.reviewedRevision = null;
    invalidateClinicalResult();
    updateDangerChecklist();
  }

  function handleTriStateKey(event) {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      event.currentTarget.click();
      return;
    }
    var offset = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 :
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    var radios = Array.from(document.querySelectorAll('input[name="' + event.currentTarget.name + '"]'));
    var next = radios[(radios.indexOf(event.currentTarget) + offset + radios.length) % radios.length];
    next.focus();
    next.click();
  }

  // ---- guidelines loaded count (for the live readout) + empty-store setup banner (H-7) ----
  function refreshHealth() {
  fetch("/health").then(function (r) { return r.json(); }).then(function (h) {
    if ($("hChunks")) $("hChunks").textContent = h.chunks != null ? h.chunks : "·";

    // Header badge: drive it from the SERVER's egress guard, not navigator.onLine. `navigator.onLine`
    // reports network REACHABILITY (a judge on wifi sees "Online", which wrongly implies cloud use); the
    // real guarantee is that the server's egress guard is armed + strict with 0 violations this session.
    var eg = h.egress || {};
    var net = $("net");
    if (net && eg.armed) {
      var btxt = net.querySelector(".badge-txt");
      if (btxt) btxt.textContent = "On-device";
      net.classList.add("is-offline");   // accent styling = the confident, guaranteed state
      net.classList.remove("is-online");
      net.dataset.egress = "1";           // claim the badge so net.js won't repaint it (see net.js)
      net.title = "On-device only. Egress guard armed" + (eg.strict ? " (strict)" : "") +
        " — network calls this session: " + (eg.violations || 0) + " blocked.";
    }

    // On-device proof chips: the egress guarantee + the resident model, both read from /health.
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
      var residents = Array.isArray(h.residentModels) ? h.residentModels : [];
      if (h.medpsy && residents.indexOf("medpsy") !== -1) {
        chips.push('<span class="od-chip">' + ICON.chip + "MedPsy " + esc(String(h.medpsy).toUpperCase()) + " &middot; runs on this Mac</span>");
      }
      if (chips.length) { proof.innerHTML = chips.join(""); proof.hidden = false; }
    }

    // The RAG store is not ready if no chunks are loaded (citation map missing) OR the native vector store
    // returned no hits on the startup self-test (ragLive===false — store wiped). Either way every triage
    // would abstain, so surface a loud, actionable banner instead of letting it look like intended behavior.
    var banner = $("setupBanner");
    if (banner && h.ready === false) {
      if (h.inference && h.inference.recoveryRequired) {
        banner.innerHTML = "<strong>Local inference restart required.</strong> Stop and restart the supported app server before retrying.";
      } else if (h.chunks === 0 || h.citationMapHealthy === false || h.ragLive === false) {
        banner.innerHTML = "<strong>WHO reference store not ready.</strong> Restore the verified protocol files, run <code>npm run ingest</code>, then restart the supported app server.";
      } else {
        banner.innerHTML = "<strong>Runtime loading.</strong> Keep this page open while the local model and WHO reference engine finish loading.";
      }
      banner.classList.remove("hidden");
      setTimeout(refreshHealth, 2000);
    } else if (banner && h.ready === true) {
      banner.classList.add("hidden");
    }
  }).catch(function () {
    var banner = $("setupBanner");
    if (banner) {
      banner.innerHTML = "<strong>Local runtime unreachable.</strong> Confirm the supported server is running, then retry this page.";
      banner.classList.remove("hidden");
    }
    if ($("hChunks")) $("hChunks").textContent = "Unavailable";
    setTimeout(refreshHealth, 2000);
  });
  }
  refreshHealth();

  // ---- dormant baseline audio helpers: unreachable in the English text workflow ----
  // Whisper (the STT model) expects 16 kHz mono; browsers capture at 44.1/48 kHz and the @qvac SDK does
  // NOT resample, so a raw recording transcribes to garbage (or empty for webm/opus). Decode the blob with
  // the browser's own audio stack and re-render at 16 kHz mono, then hand /transcribe a clean WAV it reads
  // correctly. Portable: decodeAudioData handles Chrome's webm/opus AND Safari's mp4/aac, so this also
  // normalises the container across browsers. No server dependency (no ffmpeg needed on the host).
  function encodeWav16(float32, sampleRate) {
    var len = float32.length;
    var buf = new ArrayBuffer(44 + len * 2);
    var view = new DataView(buf);
    var ws = function (o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); ws(8, "WAVE");
    ws(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ws(36, "data"); view.setUint32(40, len * 2, true);
    var o = 44;
    for (var i = 0; i < len; i++) { var s = Math.max(-1, Math.min(1, float32[i])); view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return new Blob([view], { type: "audio/wav" });
  }
  async function blobTo16kWav(blob) {
    var AC = window.AudioContext || window["webkitAudioContext"];
    var ctx = new AC();
    try {
      var decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      var rate = 16000;
      var frames = Math.max(1, Math.ceil(decoded.duration * rate));
      var off = new OfflineAudioContext(1, frames, rate);
      var src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      var rendered = await off.startRendering();
      return encodeWav16(rendered.getChannelData(0), rate);
    } finally {
      try { ctx.close(); } catch (e) {}
    }
  }

  // ---- language example chips: one tap fills a real case (advertises the multilingual pipeline) ----
  var seedRow = $("seeds");
  if (seedRow) {
    seedRow.querySelectorAll(".seed").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-fill") || "";
        var ta = clinicalInput();
        if (ta) { ta.value = t; ta.focus(); }
        if (b.dataset.ageValue && $("patientAgeValue")) $("patientAgeValue").value = b.dataset.ageValue;
        if (b.dataset.ageUnit && $("patientAgeUnit")) $("patientAgeUnit").value = b.dataset.ageUnit;
        if (b.dataset.observations === "absent") {
          DANGER_SIGNS.forEach(function (sign) {
            var absent = document.querySelector('input[name="danger-' + sign[0] + '"][value="ABSENT"]');
            if (absent) absent.checked = true;
          });
        }
        if (b.dataset.respiratoryConcern) {
          var concern = document.querySelector('input[name="respiratory-concern"][value="' + b.dataset.respiratoryConcern + '"]');
          if (concern) concern.checked = true;
        }
        if (b.dataset.respiratoryRate && $("respiratoryRatePerMinute")) {
          $("respiratoryRatePerMinute").value = b.dataset.respiratoryRate;
        }
        if ($("rateCountQuality")) $("rateCountQuality").value = "ONE_MINUTE_WHILE_CALM";
        updateDangerChecklist();
        if ($("status")) $("status").textContent = "";
      });
    });
  }

  // ---- render ----
  function renderCitation(c) {
    var box = $("citationBox");
    box.classList.remove("hidden");
    // The card pass (SSE "card") calls this a SECOND time to refine the early raw-chunk citation to the
    // stable reference metadata. If a citation is already shown, update its text IN PLACE — replacing the
    // whole innerHTML would recreate the .cite node and replay its cite-in entrance animation ~20s later,
    // a visible flicker (Phase-7 rehearsal). Keeping the node stable swaps the text with no re-animation.
    var cite = box.querySelector(".cite");
    if (cite) {
      cite.querySelector(".src").textContent = t("cite_src", { doc: c.doc, page: c.page });
      return;
    }
    var fromTxt = c.provenance === "fixed-policy" ? t("cite_fixed")
      : c.provenance === "retrieved-reference" ? t("cite_retrieved")
      : c.protocol ? t("cite_from", { protocol: esc(c.protocol) }) : t("cite_from_generic");
    box.innerHTML =
      '<div class="cite">' +
        '<span class="from">' + ICON.guide + fromTxt + "</span>" +
        '<span class="src">' + t("cite_src", { doc: esc(c.doc), page: esc(String(c.page)) }) + "</span>" +
      "</div>";
  }

  function observationLabel(key) {
    var match = DANGER_SIGNS.find(function (sign) { return sign[0] === key; });
    return match ? match[1] : key;
  }

  function formatEnum(value) {
    return String(value == null ? "Not recorded" : value).toLowerCase().replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function renderThreshold(comparison) {
    if (!comparison) return "";
    var rate = comparison.respiratoryRatePerMinute;
    var relation = comparison.relation === "AT_OR_ABOVE" ? "at or above" : "below";
    return '<div class="threshold-comparison"><span>Threshold comparison</span><strong>' +
      esc(rate) + "/min is " + relation + " " + esc(comparison.thresholdPerMinute) + "/min</strong></div>";
  }

  function renderRecorded(recorded) {
    if (!recorded) return "";
    var rows = [
      ["Age", recorded.ageMonths == null ? "Not recorded" : recorded.ageMonths + " months"],
      ["Cough or difficult breathing", formatEnum(recorded.coughOrDifficultBreathing)],
      ["Breathing rate", recorded.respiratoryRatePerMinute == null ? "Not recorded" : recorded.respiratoryRatePerMinute + "/min"],
      ["Count quality", formatEnum(recorded.rateCountQuality)],
    ];
    Object.keys(recorded.observations || {}).forEach(function (key) {
      rows.push([observationLabel(key), formatEnum(recorded.observations[key])]);
    });
    return '<div class="recorded"><h3>' + t("observations") + '</h3><ul>' + rows.map(function (row) {
      return '<li><span>' + esc(row[0]) + '</span><strong>' + esc(row[1]) + '</strong></li>';
    }).join("") + "</ul></div>";
  }

  function renderAssistance(assistance) {
    if (!assistance) return "";
    var details = assistance.status === "COMPLETED"
      ? [assistance.runtime, assistance.model, assistance.retrievalMode + " retrieval"].filter(Boolean).join(" | ")
      : assistance.status === "UNAVAILABLE" ? "Local assistance was unavailable; the deterministic result is unchanged."
      : "No model or retrieval assistance ran for this deterministic route.";
    return '<div class="assistance"><span>Model and retrieval assistance</span><strong>' +
      esc(formatEnum(assistance.status)) + '</strong><p>' + esc(details) + "</p></div>";
  }

  function outcomeTone(outcome) {
    if (outcome === "EMERGENCY") return "EMERGENCY";
    if (outcome === "PROMPT_SUPERVISED_REVIEW") return "URGENT";
    if (outcome === "NO_ESCALATION_CRITERION_RECORDED") return "ROUTINE";
    return "UNKNOWN";
  }

  function renderBroadRecorded(facts) {
    if (!facts || !facts.length) return "";
    return '<div class="recorded"><h3>' + t("observations") + '</h3><ul>' + facts.map(function (fact) {
      return '<li><span>' + esc(fact) + "</span></li>";
    }).join("") + "</ul></div>";
  }

  function renderBroadCard(card) {
    var provisional = card.reviewState === "PROVISIONAL";
    var label = provisional ? "Supervised Review Required" : "Assistance Unavailable";
    var finding = provisional
      ? "A provisional WHO protocol classification is ready for trained-worker review."
      : card.uncertainty || "No supported WHO review result was available.";
    var next = provisional
      ? "Confirm, correct, or reject the provisional class before any reference action is shown."
      : "Review the recorded case and use an appropriate clinical pathway outside this tool.";
    var basis = card.basis ? '<div class="basis"><span>Basis</span><p>' + esc(card.basis) + "</p></div>" : "";
    $("card").innerHTML = '<div class="verdict"><div class="outcome-banner tone-' + (provisional ? "URGENT" : "UNKNOWN") + '">' +
      ICON.alert + esc(label) + '</div></div><h3>Finding</h3><p class="finding">' + esc(finding) + "</p>" + basis +
      '<div class="next-step"><span>Next assessment step</span><p>' + esc(next) + "</p></div>" +
      renderBroadRecorded(card.recordedFacts) + renderAssistance(card.assistance) +
      (provisional ? '<div class="uncertainty"><span>' + t("uncertainty") + "</span><p>" + esc(card.uncertainty) + "</p></div>" : "");
  }

  function renderCard(card) {
    restoreConfirmationPlanHost();
    finishStages();
    $("reasoningWrap").classList.add("hidden");
    $("card").classList.remove("hidden");
    if (card.reviewState && !card.outcome) {
      renderBroadCard(card);
      lastCard = card;
      return;
    }
    var tone = outcomeTone(card.outcome);
    var ico = tone === "ROUTINE" ? ICON.check : ICON.alert;
    var source = card.sourceRule ? '<div class="supporting-reference"><span>Authoritative source rule</span><strong>' +
      esc(card.sourceRule.doc) + ", page " + esc(String(card.sourceRule.page)) + '</strong><p>' +
      esc(card.sourceRule.section) + "</p></div>" : "";
    var missing = card.missingFields && card.missingFields.length
      ? '<div class="missing-fields"><span>Missing recorded fields</span><p>' + esc(card.missingFields.join(", ")) + "</p></div>" : "";
    $("card").innerHTML =
      '<div class="verdict">' +
        '<div class="outcome-banner tone-' + tone + '">' + ico + esc(formatEnum(card.outcome)) + "</div>" +
      "</div>" +
      '<h3>Finding</h3><p class="finding">' + esc(card.finding) + "</p>" +
      renderThreshold(card.thresholdComparison) +
      '<div class="basis"><span>Basis</span><p>' + esc(card.basis) + "</p></div>" +
      '<div class="next-step"><span>Next assessment step</span><p>' + esc(card.nextAssessmentStep) + "</p></div>" +
      missing + renderRecorded(card.recorded) + source + renderAssistance(card.assistance) +
      '<div class="uncertainty"><span>' + t("uncertainty") + "</span><p>" + esc(card.uncertainty) + "</p></div>" +
      "";
    lastCard = card;
    // On a small screen the verdict can land below the fold once the reasoning box has grown;
    // bring the card into view so the severity is the first thing the worker sees.
    if (window.matchMedia && window.matchMedia("(max-width:560px)").matches) {
      $("card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderProvisional(data) {
    transitionToProvisional(data);
    var card = $("card");
    if (card && !card.querySelector(".provisional-summary")) {
      var summary = document.createElement("section");
      summary.className = "provisional-summary";
      var label = document.createElement("span");
      label.textContent = "Provisional WHO protocol classification";
      var value = document.createElement("strong");
      value.textContent = data.classification + " · " + data.protocol;
      var boundary = document.createElement("p");
      boundary.textContent = "Human confirmation is required. This is not a diagnosis and no reference action is unlocked.";
      summary.append(label, value, boundary);
      var provenance = card.querySelector(".supporting-reference, .assistance, .uncertainty");
      if (provenance) provenance.insertAdjacentElement("beforebegin", summary); else card.append(summary);
    }
    if ($("confirmationRegion")) {
      $("confirmationRegion").classList.remove("hidden");
      var instructions = $("confirmationRegion").querySelector(".confirmation-instructions");
      var actions = $("confirmationRegion").querySelector(".confirmation-actions");
      if (instructions) instructions.classList.remove("hidden");
      if (actions) actions.classList.remove("hidden");
    }
  }

  function renderContinuation(data) {
    if (!data || !data.eligible || !data.token || !$('continuationRegion')) return;
    transitionToDeterministic(data);
    if ($('continueAssessment')) $('continueAssessment').textContent = "Continue to supervised WHO classification";
    $('continuationRegion').classList.remove('hidden');
    $('continuationStatus').textContent = "Ready for optional local model-assisted review.";
  }

  function citationText(citation) {
    if (!citation || !citation.doc || citation.page == null) return "";
    return citation.doc + ", page " + citation.page + ".";
  }

  function appendCitation(parent, citation) {
    var text = citationText(citation);
    if (!text) return;
    var cite = document.createElement("small");
    cite.className = "plan-citation";
    cite.textContent = "Source: " + text;
    parent.appendChild(cite);
  }

  function restoreConfirmationPlanHost() {
    var target = $("confirmationPlan");
    var region = $("confirmationRegion");
    if (target && region && target.parentNode !== region) region.appendChild(target);
  }

  function clearReferenceActions() {
    restoreConfirmationPlanHost();
    if ($("confirmationPlan")) $("confirmationPlan").textContent = "";
  }

  function transitionClinicalPhase(phase) {
    clinicalState.phase = phase;
    if ($("result")) $("result").dataset.clinicalPhase = phase;
  }

  function transitionToDeterministic(data) {
    clearReferenceActions();
    clinicalState.confirmationToken = null;
    clinicalState.continuationToken = data.token;
    transitionClinicalPhase("DETERMINISTIC");
  }

  function transitionToProvisional(data) {
    clearReferenceActions();
    clinicalState.continuationToken = null;
    clinicalState.confirmationToken = data.token;
    transitionClinicalPhase("PROVISIONAL");
  }

  function transitionToConfirmed() {
    clinicalState.confirmationToken = null;
    transitionClinicalPhase("CONFIRMED");
  }

  function transitionToRejected() {
    clinicalState.confirmationToken = null;
    clearReferenceActions();
    transitionClinicalPhase("REJECTED");
  }

  function planGroup(key, heading) {
    var section = document.createElement("section");
    section.className = "pgroup";
    section.dataset.planGroup = key;
    var title = document.createElement("h4");
    title.textContent = heading;
    section.appendChild(title);
    return section;
  }

  function sourceLine(value, citation, label) {
    var row = document.createElement("div");
    row.className = "prow";
    row.dataset.sourceLine = "";
    var text = document.createElement("span");
    text.className = "ptext";
    text.textContent = label ? label + ": " + value : value;
    row.appendChild(text);
    appendCitation(row, citation);
    return row;
  }

  function appendActionGroup(parent, key, heading, items, valueKey) {
    if (!items || !items.length) return;
    var section = planGroup(key, heading);
    items.forEach(function (item) {
      var value = item && (item[valueKey] || item.name);
      section.appendChild(sourceLine(value || "Source action", item && item.citation));
    });
    parent.appendChild(section);
  }

  function appendMedicines(parent, medicines) {
    if (!medicines || !medicines.length) return;
    var section = planGroup("medicines", "Medicines and source dose table");
    medicines.forEach(function (medicine) {
        var article = document.createElement("article");
        article.className = "medicine-card";
        article.appendChild(sourceLine(medicine.name || "Source medicine", medicine.citation));
        [["Medicine strength", medicine.strength], ["Frequency", medicine.frequency], ["Duration", medicine.duration], ["Source dose instruction", medicine.dose]].forEach(function (detail) {
          if (detail[1]) article.appendChild(sourceLine(detail[1], medicine.citation, detail[0]));
        });
        if (medicine.bands && medicine.bands.length) {
          var tableWrap = document.createElement("div");
          tableWrap.className = "dose-table-wrap";
          var table = document.createElement("table"); table.className = "dose";
          var head = document.createElement("thead");
          var headRow = document.createElement("tr");
          ["Age / weight", "Dose", "Selection and source"].forEach(function (label) {
            var th = document.createElement("th"); th.scope = "col"; th.textContent = label; headRow.appendChild(th);
          });
          head.appendChild(headRow); table.appendChild(head);
          var body = document.createElement("tbody");
          medicine.bands.forEach(function (band) {
            var selected = medicine.selectedBand && medicine.selectedBand.band === band.band && medicine.selectedBand.dose === band.dose;
            var tr = document.createElement("tr");
            tr.dataset.sourceLine = "";
            if (selected) tr.className = "is-selected";
            var cells = [];
            [band.band + " ", band.dose, selected ? "Selected source band" : "Reference row"].forEach(function (value) {
              var td = document.createElement("td"); td.textContent = value; tr.appendChild(td);
              cells.push(td);
            });
            appendCitation(cells[2], band.citation);
            body.appendChild(tr);
          });
          table.appendChild(body); tableWrap.appendChild(table); article.appendChild(tableWrap);
        }
      section.appendChild(article);
    });
    parent.appendChild(section);
  }

  function appendFollowUp(parent, followUp) {
    if (!followUp) return;
    var section = planGroup("follow-up", "Follow-up timing and assessment");
    section.appendChild(sourceLine(followUp.when, followUp.citation, "Timing"));
    if (followUp.detail) section.appendChild(sourceLine(followUp.detail, followUp.detailCitation, "Assess at follow-up"));
    parent.appendChild(section);
  }

  function mountPlanBeforeProvenance(target) {
    var card = $("card");
    if (!card) return;
    var provenance = card.querySelector(".supporting-reference, .assistance, .uncertainty");
    card.insertBefore(target, provenance || null);
    if ($("confirmationRegion")) $("confirmationRegion").classList.add("hidden");
  }

  function renderReferenceActions(result) {
    if (!$("confirmationRegion") || !$("confirmationPlan")) return;
    transitionToConfirmed();
    var target = $("confirmationPlan");
    target.textContent = "";
    target.className = "confirmed-plan plan";
    var heading = document.createElement("div"); heading.className = "plan-head";
    heading.textContent = "Confirmed WHO management plan"; target.appendChild(heading);
    var actions = result.referenceActions || {};
    var summary = planGroup("summary", "Assessment outcome");
    var identity = document.createElement("p");
    identity.textContent = "Severity: " + (result.severity || "UNKNOWN") + ". Classification: " + (result.classification || "Not available") + ".";
    summary.appendChild(identity);
    var why = document.createElement("p");
    why.textContent = "Why it matched: " + (lastCard && lastCard.basis
      ? lastCard.basis : "The reviewed classification maps to the frozen WHO protocol entry.");
    summary.appendChild(why); target.appendChild(summary);
    var immediate = result.immediateAction || actions.immediateAction;
    if (immediate && immediate.text) {
      var immediateGroup = planGroup("immediate", "Immediate action");
      immediateGroup.appendChild(sourceLine(immediate.text, immediate.citation)); target.appendChild(immediateGroup);
    }
    appendMedicines(target, actions.medicines);
    appendActionGroup(target, "supportive", "Supportive care", actions.supportive, "item");
    appendActionGroup(target, "home", "Home care", actions.home_care, "advice");
    appendActionGroup(target, "return", "Return immediately", actions.return_now, "sign");
    appendFollowUp(target, actions.follow_up);
    appendActionGroup(target, "referral", "Referral", actions.referral ? [actions.referral] : [], "criterion");
    if ((actions.medicines && actions.medicines.length) || (result.doseState && result.doseState.medicineReferenceAvailable)) {
      var dose = document.createElement("p");
      dose.className = "dose-state";
      dose.textContent = "Dose-band state: " + formatEnum(result.doseState && result.doseState.status);
      if (result.doseState && result.doseState.missingFields && result.doseState.missingFields.length) {
        dose.textContent += ". Missing: " + result.doseState.missingFields.join(", ");
      }
      if (result.doseState && result.doseState.status === "LOCKED_SAFETY_REVIEW") {
        dose.textContent += ". Complete the allergy, contraindication, and protocol-applicability review before medicine source rows can unlock.";
        ["allergiesReviewed", "contraindicationsReviewed", "protocolApplicability"].forEach(function (id) {
          if ($(id)) $(id).setAttribute("aria-invalid", String($(id).value === "NOT_ASSESSED"));
        });
      }
      target.appendChild(dose);
    }
    var foot = document.createElement("p"); foot.className = "plan-foot";
    foot.textContent = "Use the cited WHO source and clinical judgment before applying any action.";
    target.appendChild(foot);
    mountPlanBeforeProvenance(target);
  }

  function invalidateConfirmation() {
    restoreConfirmationPlanHost();
    clinicalState.generation += 1;
    transitionClinicalPhase("RECORD");
    clinicalState.confirmationToken = null;
    clinicalState.continuationToken = null;
    clinicalState.confirmationPending = false;
    clinicalState.continuationPending = false;
    ["confirmAssessment", "rejectAssessment"].forEach(function (id) { if ($(id)) $(id).disabled = false; });
    if ($("confirmationRegion")) {
      if ($("confirmationPlan")) $("confirmationPlan").textContent = "";
      var instructions = $("confirmationRegion").querySelector(".confirmation-instructions");
      var actions = $("confirmationRegion").querySelector(".confirmation-actions");
      if (instructions) instructions.classList.remove("hidden");
      if (actions) actions.classList.remove("hidden");
      $("confirmationRegion").classList.add("hidden");
    }
    if ($("continuationRegion")) {
      $("continuationRegion").classList.add("hidden");
      if ($("continuationStatus")) $("continuationStatus").textContent = "";
    }
  }

  async function sendContinuation() {
    if (!clinicalState.continuationToken || clinicalState.continuationPending || assessCtl) return;
    var token = clinicalState.continuationToken;
    var generation = clinicalState.generation;
    clinicalState.continuationPending = true;
    clinicalState.continuationToken = null;
    if ($("continueAssessment")) $("continueAssessment").disabled = true;
    $("continuationStatus").textContent = "Starting local supervised WHO review.";
    assessCtl = new AbortController();
    gotTerminal = false;
    $("reasoningWrap").classList.remove("hidden");
    startReasonTimer();
    var buffer = "";
    try {
      var response = await fetch("/triage/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token }),
        signal: assessCtl.signal,
      });
      if (!response.ok || !response.body) {
        var failure = { error: "Continuation was not accepted." };
        try { failure = await response.json(); } catch (e) {}
        throw new Error(failure.error);
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          if (generation === clinicalState.generation) handleEvent(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
      }
      if (generation === clinicalState.generation && !gotTerminal) throw new Error("No validated continuation result was received.");
    } catch (error) {
      if (generation === clinicalState.generation) {
        $("err").textContent = error && error.name === "AbortError"
          ? "The supervised continuation was stopped. Run the assessment again for a new one-use grant."
          : "The deterministic respiratory result remains valid. " + (error.message || "Local continuation was unavailable.");
      }
    } finally {
      stopReasonTimer();
      assessCtl = null;
      if (generation === clinicalState.generation) {
        clinicalState.continuationPending = false;
        $("continuationRegion").classList.add("hidden");
        if ($("continueAssessment")) $("continueAssessment").disabled = false;
      }
    }
  }

  function invalidateClinicalResult() {
    var result = $("result");
    var hadResult = result && !result.classList.contains("hidden");
    var interrupted = Boolean(assessCtl);
    invalidateConfirmation();
    if (interrupted) {
      clinicalState.recordChangedDuringRun = true;
      assessCtl.abort();
    }
    if (!hadResult && !interrupted) return;
    result.classList.add("hidden");
    result.removeAttribute("aria-busy");
    $("card").textContent = "";
    $("citationBox").textContent = "";
    $("citationBox").classList.add("hidden");
    $("reasoningWrap").classList.add("hidden");
    lastCard = null;
    $("status").textContent = "Recorded data changed. Run the assessment again.";
  }

  async function sendConfirmation(decision) {
    if (!clinicalState.confirmationToken || clinicalState.confirmationPending) return;
    var token = clinicalState.confirmationToken;
    var generation = clinicalState.generation;
    clinicalState.confirmationPending = true;
    if ($("confirmationRegion")) $("confirmationRegion").setAttribute("aria-busy", "true");
    if ($("confirmationStatus")) $("confirmationStatus").textContent = decision === "CONFIRM"
      ? "Applying the reviewed confirmation."
      : "Recording the rejection.";
    ["confirmAssessment", "rejectAssessment"].forEach(function (id) { if ($(id)) $(id).disabled = true; });
    try {
      var response = await fetch("/triage/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, decision: decision }),
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || "Confirmation could not be applied.");
      if (generation !== clinicalState.generation || token !== clinicalState.confirmationToken || clinicalState.phase !== "PROVISIONAL") return;
      if (result.reviewState === "CONFIRMED") renderReferenceActions(result);
      else if ($("confirmationRegion")) {
        transitionToRejected();
        if ($("confirmationPlan")) $("confirmationPlan").textContent = "The provisional classification was rejected. No reference actions were shown.";
      }
    } finally {
      if (generation === clinicalState.generation) {
        clinicalState.confirmationPending = false;
        if ($("confirmationRegion")) $("confirmationRegion").removeAttribute("aria-busy");
        if (clinicalState.phase === "PROVISIONAL" && $("confirmationStatus")) {
          $("confirmationStatus").textContent = "Confirmation was not applied. Review the error and retry.";
        }
        ["confirmAssessment", "rejectAssessment"].forEach(function (id) { if ($(id)) $(id).disabled = false; });
      }
    }
  }

  // ---- on-device pipeline readout ----
  // Each SSE `stage` event is a REAL step the server just ran. Advancing the checklist marks the prior
  // active step done (a check) and appends the new one as active (a spinner). Truthful by construction:
  // a row exists only because its step actually executed on this device. Ignored if the list is absent.
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
  // Build the bounded public stage label and fall back to the server label if needed.
  function stageLabel(d) {
    switch (d.key) {
      case "detect": return t("st_detect");
      case "retrieve": return t("st_retrieve", { n: d.count != null ? d.count : "" });
      case "reason": return t("st_reason");
      case "summarize": return t("st_summarize");
      default: return d.label || d.key;
    }
  }
  var STAGE_DETAIL = { detect: "d_langdetect", retrieve: "d_retrieval", reason: "d_medpsy", summarize: "d_summary" };
  function renderStage(d) {
    var box = $("plSteps");
    if (!box || !d || !d.key) return;
    markActiveDone();
    var li = document.createElement("li");
    li.className = "pl-step is-active";
    li.setAttribute("data-key", String(d.key));
    var detail = STAGE_DETAIL[d.key] ? t(STAGE_DETAIL[d.key]) : (d.detail || "");
    li.innerHTML =
      '<span class="pl-ic" aria-hidden="true"></span>' +
      '<span class="pl-label">' + esc(stageLabel(d)) + "</span>" +
      (detail ? '<span class="pl-detail">' + esc(detail) + "</span>" : "");
    box.appendChild(li);
  }
  // On a terminal frame, close out the last spinning step so the readout never freezes mid-spin.
  function finishStages() { markActiveDone(); }

  function handleEvent(block) {
    // SSE comment frames (keep-alives) start with ":". Ignore them, they carry no event.
    if (block.charAt(0) === ":") return;
    var ev = (block.match(/^event: (.*)$/m) || [])[1];
    var dataLine = (block.match(/^data: (.*)$/m) || [])[1];
    if (!ev || !dataLine) return;
    var d;
    // A malformed frame must be skipped, not kill the whole stream.
    try { d = JSON.parse(dataLine); } catch (e) {
      gotTerminal = true;
      $("err").textContent = "The local assessment response was malformed. Restart the supported app before retrying.";
      $("reasoningWrap").classList.add("hidden");
      return;
    }
    if (ev === "stage") {
      if (d.key === "detect") {
        var h2 = $("h-guideline"); if (h2) h2.textContent = t("step2");
        $("reasonLabel").textContent = t("reason_search");
      }
      renderStage(d);
    } else if (ev === "citation") {
      renderCitation(d);
      $("reasonLabel").textContent = t("reason_read");
    } else if (ev === "first_token") {
      $("hTtft").textContent = (d.ttftMs / 1000).toFixed(1) + " s";
      // H-1 staged status: the model has started producing its assessment.
      $("reasonLabel").textContent = t("reason_think");
    } else if (ev === "card" || ev === "assessment_required") {
      gotTerminal = true;
      renderCard(d.card);
      if (d.perf) {
        if (d.perf.ttftMs != null) $("hTtft").textContent = (d.perf.ttftMs / 1000).toFixed(1) + " s";
        $("hTps").textContent = d.perf.tokensPerSec != null ? Number(d.perf.tokensPerSec).toFixed(1) : "·";
        $("hDev").textContent = (d.perf.backendDevice || "·").toUpperCase();
      }
    } else if (ev === "provisional") {
      renderProvisional(d);
    } else if (ev === "continuation") {
      renderContinuation(d);
    } else if (ev === "abstain") {
      gotTerminal = true;
      finishStages();
      renderCard(d.card);
    } else if (ev === "error") {
      gotTerminal = true;
      $("err").textContent = d.reason || d.error || "Local assistance is unavailable. Check readiness, then retry.";
      $("reasoningWrap").classList.add("hidden");
    }
  }
  // Set true when a terminal frame (card/abstain/error) arrives, so we can tell a clean
  // finish from a stream that closed early and left a blank card.
  var gotTerminal = false;

  // ---- H-1: reasoning wait-timer ----
  // On-device reasoning takes seconds; a live elapsed counter reassures the worker the tool is working
  // (not hung) while the model thinks, and the reasonLabel carries the stage. Decorative — aria-hidden.
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
  // H-2: an AbortController lets the worker stop an in-flight assessment; the Run-assessment button toggles
  // to a Stop button for the duration (mirrors the mic Speak/Stop toggle) and aborts the fetch on click.
  var assessCtl = null;
  function reviewedClinicalRequest() {
    if (unifiedInput && unifiedState.reviewedRevision !== unifiedState.revision) return null;
    var structured = readStructuredDanger();
    var medication = structured.medicationSafety || {};
    var applicability = structured.protocolApplicability || {};
    var request = {
      caseText: clinicalInput().value.trim(),
      dangerObservations: structured.dangerObservations,
      medicationSafety: {
        allergiesReviewed: medication.allergiesReviewed || "NOT_ASSESSED",
        contraindicationsReviewed: medication.contraindicationsReviewed || "NOT_ASSESSED",
        allergyDetails: Array.isArray(medication.allergyDetails) ? medication.allergyDetails.slice() : [],
        contraindicationDetails: Array.isArray(medication.contraindicationDetails) ? medication.contraindicationDetails.slice() : [],
      },
      protocolApplicability: {
        status: applicability.status || "NOT_ASSESSED",
        details: Array.isArray(applicability.details) ? applicability.details.slice() : [],
      },
    };
    if (structured.patientAge) request.patientAge = structured.patientAge;
    if (structured.patientWeightKg != null) request.patientWeightKg = structured.patientWeightKg;
    if (structured.respiratoryAssessment) request.respiratoryAssessment = structured.respiratoryAssessment;
    return request;
  }

  async function runAssess() {
    var request = reviewedClinicalRequest();
    if (!request) return;
    var caseText = request.caseText;
    if (!caseText) { $("status").textContent = "Describe or record a case first."; clinicalInput().setAttribute("aria-invalid", "true"); clinicalInput().focus(); return; }
    if (!updateDangerChecklist()) { $("status").textContent = $("dangerStatus").textContent || "Complete the recorded assessment first."; return; }
    // Re-entrancy guard: a run is already in flight (assessCtl set). The keyboard path (Ctrl/Cmd+Enter)
    // bypasses the button, so without this a second run would overwrite assessCtl + the shared timer
    // interval (stopping the live one) and start a second /triage the single-job engine only queues.
    if (assessCtl) return;
    gotTerminal = false;
    invalidateConfirmation();
    clinicalState.recordChangedDuringRun = false;
    assessCtl = new AbortController();
    // Toggle the button into Stop mode (kept enabled so the worker can abort). Restored in `finally`.
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
    $("reasoningWrap").classList.remove("hidden");
    $("reasoning").textContent = "";
    if ($("plSteps")) $("plSteps").innerHTML = "";
    lastCard = null;
    uiLang = "en"; // reset until the detect stage sets the case's language
    $("reasonLabel").textContent = t("reason_search");
    $("hTtft").textContent = "·"; $("hTps").textContent = "·"; $("hDev").textContent = "·";
    startReasonTimer();
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    var buf = "";
    try {
      var r = await fetch("/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: assessCtl.signal
      });
      // Guard before reading the stream: a non-2xx or bodyless response has no readable stream.
      if (!r.ok || !r.body) {
        var msg = "Could not run assessment (" + r.status + ").";
        try {
          var j = await r.json();
          if (j && j.error) msg = j.error;
          if (j && Array.isArray(j.conflicts)) renderMissingReview(j.conflicts);
        } catch (e) {}
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
      // Stream closed cleanly but no card/abstain/error arrived: do not leave a silent blank card.
      if (!gotTerminal) {
        $("err").textContent = "The assessment did not finish. Try again.";
        $("reasoningWrap").classList.add("hidden");
      }
    } catch (e) {
      // H-2: a worker-initiated Stop aborts the fetch → AbortError. That is not a failure; show a calm
      // "Stopped." and clear the reasoning box rather than an error.
      if (e && e.name === "AbortError") {
        $("status").textContent = clinicalState.recordChangedDuringRun
          ? "Recorded data changed. Run the assessment again."
          : "Stopped.";
        $("err").textContent = "";
      } else {
        $("err").textContent = "Could not run assessment. " + e.message;
      }
      $("reasoningWrap").classList.add("hidden");
    } finally {
      // Restore the button + timer in finally so a Stop or a mid-stream interruption never leaves the
      // button stuck in Stop mode or the timer running.
      stopReasonTimer();
      $("assess").disabled = false;
      $("assess").innerHTML = assessLabel;
      $("assess").classList.remove("is-stopping");
      $("assess").onclick = runUnified;
      assessCtl = null;
      $("result").removeAttribute("aria-busy");
    }
  }
  if ($("assess")) $("assess").onclick = runUnified;
  if ($("dangerChecklist")) {
    $("dangerChecklist").addEventListener("change", handleStructuredEdit);
    $("patientAgeValue").addEventListener("input", handleStructuredEdit);
    if ($("patientWeightKg")) $("patientWeightKg").addEventListener("input", handleStructuredEdit);
    if ($("respiratoryRatePerMinute")) $("respiratoryRatePerMinute").addEventListener("input", handleStructuredEdit);
    document.querySelectorAll(".tri-state input").forEach(function (input) { input.addEventListener("keydown", handleTriStateKey); });
    updateDangerChecklist();
  }
  if (clinicalInput()) clinicalInput().addEventListener("input", function () { handleUnifiedInput(); });
  if ($("confirmAssessment")) $("confirmAssessment").onclick = function () { sendConfirmation("CONFIRM").catch(function (e) { $("err").textContent = e.message; }); };
  if ($("continueAssessment")) $("continueAssessment").onclick = function () { sendContinuation().catch(function (e) { $("err").textContent = e.message; }); };
  if ($("rejectAssessment")) $("rejectAssessment").onclick = function () { sendConfirmation("REJECT").catch(function (e) { $("err").textContent = e.message; }); };
  if ($("correctAssessment")) $("correctAssessment").onclick = function () { invalidateClinicalResult(); clinicalInput().focus(); };
  // Ctrl/Cmd+Enter from the case box submits, the way a clinician expects.
  if (clinicalInput()) clinicalInput().addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runUnified(); }
  });

  var promptState = {
    jobId: null,
    abortController: null,
    terminal: false,
    runId: 0,
    lastPrompt: "",
    retryable: true,
    cancelMessage: null,
  };

  function updatePromptReadiness() {
    updateUnifiedReadiness();
  }

  function promptMessage(kind, title, data) {
    var sharedAnswer = $("sharedAnswer");
    if (!sharedAnswer) return;
    sharedAnswer.textContent = "";
    sharedAnswer.classList.remove("hidden");
    sharedAnswer.dataset.state = kind;
    var heading = document.createElement("h3");
    heading.textContent = title;
    var answer = document.createElement("p");
    var message = data.answer || data.reason || data.error || "No public answer was produced.";
    answer.textContent = data.code ? message + " (" + data.code + ")" : message;
    sharedAnswer.append(heading, answer);
    ["uncertainty", "limitations"].forEach(function (key) {
      if (!data[key] || !data[key].length) return;
      var label = document.createElement("h4");
      label.textContent = formatEnum(key);
      var list = document.createElement("ul");
      data[key].forEach(function (line) {
        var item = document.createElement("li");
        item.textContent = line;
        list.appendChild(item);
      });
      sharedAnswer.append(label, list);
    });
  }

  function handlePromptEvent(event, data, runId) {
    if (runId !== promptState.runId || promptState.terminal) return;
    if (event === "job") promptState.jobId = data.id;
    else if (event === "stage") $("status").textContent = data.label || "Running locally.";
    else if (event === "answer") {
      promptState.terminal = true;
      $("status").textContent = "Complete.";
      promptMessage("completed", "Local answer", data);
    } else if (event === "rejected") {
      promptState.terminal = true;
      promptState.retryable = data.retryable !== false;
      if (data.status === "UNAVAILABLE") {
        $("status").textContent = "Local assistance unavailable.";
        promptMessage("unavailable", "Local assistance unavailable", data);
      } else if (data.status === "CANCELLED") {
        $("status").textContent = "Cancelled.";
        promptMessage("cancelled", "Local run cancelled", data);
      } else {
        $("status").textContent = "Answer withheld.";
        promptMessage("rejected", "Answer withheld", data);
      }
    } else if (event === "error") {
      promptState.terminal = true;
      promptState.retryable = data.retryable !== false;
      $("status").textContent = "Local assistance unavailable.";
      promptMessage("unavailable", "Local assistance unavailable", data);
    }
  }

  function consumePromptFrames(buffer, runId) {
    var split;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      var block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      var event = (block.match(/^event: (.*)$/m) || [])[1];
      var line = (block.match(/^data: (.*)$/m) || [])[1];
      if (!event || !line) continue;
      try { handlePromptEvent(event, JSON.parse(line), runId); } catch (e) {
        handlePromptEvent("error", {
          code: "MALFORMED_RESPONSE",
          reason: "The local prompt response was malformed. Restart the supported app before retrying.",
          retryable: false,
        }, runId);
      }
    }
    return buffer;
  }

  async function runPrompt() {
    var prompt = clinicalInput().value;
    if (!prompt.trim()) { $("status").textContent = "Enter a request first."; clinicalInput().focus(); return; }
    promptState.runId += 1;
    var runId = promptState.runId;
    promptState.jobId = null;
    promptState.terminal = false;
    promptState.retryable = true;
    promptState.cancelMessage = null;
    promptState.lastPrompt = prompt;
    promptState.abortController = new AbortController();
    $("sharedAnswer").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("status").textContent = "Starting local two-pass review.";
    $("assess").disabled = true;
    $("cancelPrompt").hidden = false;
    $("retryPrompt").hidden = true;
    var buffer = "";
    try {
      var response = await fetch("/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt }),
        signal: promptState.abortController.signal,
      });
      if (!response.ok) {
        var failure = { error: "Local prompt request was not accepted.", code: "REQUEST_REJECTED", retryable: false };
        try { failure = await response.json(); } catch (e) {}
        promptState.retryable = failure.retryable !== false;
        throw new Error(failure.error + (failure.code ? " (" + failure.code + ")" : ""));
      }
      if (!response.body) { promptState.retryable = true; throw new Error("The local prompt response had no readable stream."); }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        buffer = consumePromptFrames(buffer, runId);
      }
      if (!promptState.terminal && runId === promptState.runId) {
        promptState.terminal = true;
        $("status").textContent = "Local assistance unavailable.";
        promptMessage("unavailable", "Incomplete local response", { reason: "No validated terminal answer was received." });
      }
    } catch (error) {
      if (runId !== promptState.runId) return;
      promptState.terminal = true;
      if (error && error.name === "AbortError") $("status").textContent = promptState.cancelMessage || "Stopped locally.";
      else {
        $("status").textContent = "Local assistance unavailable.";
        promptMessage("unavailable", "Local assistance unavailable", { reason: error.message || "The local prompt run could not finish." });
      }
    } finally {
      if (runId === promptState.runId) {
        promptState.abortController = null;
        updatePromptReadiness();
        $("cancelPrompt").hidden = true;
        $("retryPrompt").hidden = !promptState.retryable;
      }
    }
  }

  async function cancelPrompt() {
    promptState.cancelMessage = null;
    if (promptState.jobId) {
      try {
        var response = await fetch("/jobs/" + encodeURIComponent(promptState.jobId), { method: "DELETE" });
        if (response.status === 409) {
          $("status").textContent = "The local job had already finished; waiting for its terminal result.";
          return;
        }
        if (!response.ok) {
          $("status").textContent = "Cancellation could not be confirmed; the local run is still active.";
          return;
        }
        promptState.cancelMessage = "Cancelled by user.";
      } catch (error) {
        $("status").textContent = "Cancellation could not be confirmed; the local run is still active.";
        return;
      }
    } else {
      promptState.cancelMessage = "Stopped before a local job was assigned.";
    }
    if (promptState.abortController) promptState.abortController.abort();
  }

  function retryPrompt() {
    promptState.jobId = null;
    promptState.terminal = false;
    if (promptState.lastPrompt) clinicalInput().value = promptState.lastPrompt;
    runPrompt();
  }

  if ($("cancelPrompt")) $("cancelPrompt").onclick = cancelPrompt;
  if ($("retryPrompt")) $("retryPrompt").onclick = retryPrompt;
  updatePromptReadiness();

  var lastCard = null;
  // Test hook (browser-safe: `module` is undefined in the browser, so this is a no-op there and the
  // app wiring above runs unchanged). Lets jsdom unit tests exercise the pure render/parse logic.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      esc: esc,
      renderCitation: renderCitation,
      renderCard: renderCard,
      renderReferenceActions: renderReferenceActions,
      renderStage: renderStage,
      handleEvent: handleEvent,
      // Exported for the jsdom Stop/timer test (H-1/H-2). These drive the /triage flow, so the test can
      // stub fetch + AbortController and assert the abort path, staged label, and timer lifecycle.
      runAssess: runAssess,
      startReasonTimer: startReasonTimer,
      stopReasonTimer: stopReasonTimer,
      readStructuredDanger: readStructuredDanger,
      updateDangerChecklist: updateDangerChecklist,
      updateUnifiedReadiness: updateUnifiedReadiness,
      handleUnifiedInput: handleUnifiedInput,
      runUnified: runUnified,
      unifiedState: unifiedState,
      focusMissingField: focusMissingField,
      promptState: promptState,
      invalidateClinicalResult: invalidateClinicalResult,
      renderProvisional: renderProvisional,
      renderContinuation: renderContinuation,
      sendContinuation: sendContinuation,
      sendConfirmation: sendConfirmation,
      clinicalState: clinicalState,
    };
  }
})();
