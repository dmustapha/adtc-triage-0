// triage.js · the Triage-0 tool logic, extracted from the original inline script.
// The active English text workflow uses /health and /triage SSE, with citation-first metadata and a
// narrowed assessment renderer. Removed speech and management events cannot recreate public capability.
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

  // English-only public assessment copy. Templates use {placeholder} substitution.
  var COPY = {
      reason_search: "Checking supporting references", reason_read: "Supporting reference found", reason_think: "Preparing the assessment summary",
      st_detect: "Recorded assessment received", st_retrieve: "Checked {n} local reference passages",
      st_reason: "Local model-assisted review", st_summarize: "Prepared assessment summary",
      d_langdetect: "structured observations", d_retrieval: "local reference lookup", d_medpsy: "local model · on-device", d_summary: "bounded local review",
      cite_from: "Supporting reference", cite_from_generic: "Supporting reference", cite_fixed: "Fixed policy reference", cite_retrieved: "Retrieved WHO reference", cite_src: "{doc}, page {page}.",
      outcome: "Assessment outcome", observations: "Recorded observations", uncertainty: "Uncertainty", reference: "Supporting reference",
      model_summary: "Model-assisted summary", source_excerpt: "Retrieved WHO excerpt", input_authority: "How this result was produced",
      abstain_msg: "This assessment is outside the supported scope. Escalate to a qualified clinician.",
      step2: "Assessment outcome",
  };
  function t(key, params) {
    var s = COPY[key] != null ? COPY[key] : key;
    if (params) for (var k in params) s = s.split("{" + k + "}").join(params[k]);
    return s;
  }

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
    assessLabel: null,
  };

  var unifiedInput = typeof window !== "undefined" ? window.TriageUnifiedInput : null;
  var unifiedState = {
    candidate: null, route: "AMBIGUOUS", revision: 0, choiceRevision: null, routeOverride: null,
    reviewPresentedRevision: null, reviewedRevision: null, presentationRevision: null,
    focusGeneration: 0, deferMissingFocusRevision: null,
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

  function checklistState() {
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
    return { values: values, assessed: assessed, band: band, ageReady: ageReady, emergency: emergency,
      respiratory: respiratory, broaderFocus: broaderFocus, rateReady: rateReady, chestReview: chestReview,
      respiratoryReady: respiratoryReady, policyReady: policyReady, narrativeReady: narrativeReady,
      weightReady: weightReady, ready: ready };
  }

  function renderChecklistValidity(state) {
    if ($("patientAgeValue")) $("patientAgeValue").setAttribute("aria-invalid", String(Boolean($("patientAgeValue").value) && !state.ageReady));
    if ($("patientWeightKg")) $("patientWeightKg").setAttribute("aria-invalid", String(!state.weightReady));
    document.querySelectorAll("[data-danger-key]").forEach(function (fieldset) {
      var missing = state.values[fieldset.dataset.dangerKey] === "NOT_ASSESSED";
      fieldset.setAttribute("aria-invalid", String(state.band === "young-child" && !state.emergency && missing));
    });
    var breathingIncomplete = state.band === "young-child" && !state.broaderFocus && !state.emergency && !state.respiratoryReady;
    if ($("respiratoryAssessment")) $("respiratoryAssessment").setAttribute("aria-invalid", String(breathingIncomplete));
    var rateRequired = breathingIncomplete && state.respiratory.coughOrDifficultBreathing === "PRESENT" && !state.chestReview;
    if ($("respiratoryRatePerMinute")) $("respiratoryRatePerMinute").setAttribute("aria-invalid", String(rateRequired && !state.rateReady));
    if ($("rateCountQuality")) $("rateCountQuality").setAttribute("aria-invalid", String(rateRequired && state.respiratory.rateCountQuality !== "ONE_MINUTE_WHILE_CALM"));
  }

  function checklistStatus(state) {
    var status = state.assessed + " of " + DANGER_SIGNS.length + " signs assessed.";
    if (state.emergency) return status + " Emergency observation ready for assessment.";
    if (state.policyReady && !state.narrativeReady) return status + " Describe the recorded case to continue.";
    if (state.policyReady && !state.weightReady) return status + " Weight must be between 0.5 and 300 kg, or left blank.";
    if (state.band === "adult") return status + " Ready for adult WHO assessment.";
    if (state.ready && state.broaderFocus) return status + " Ready for broader WHO assessment.";
    if (state.ready) return status + " Ready for respiratory assessment.";
    if (!state.ageReady) return status + " Supported age required: 2 months to under 5 years, or 18 years and older.";
    if (state.assessed === DANGER_SIGNS.length) return status + " Complete the breathing assessment.";
    return status;
  }

  function updateDangerChecklist() {
    var state = checklistState();
    renderChecklistValidity(state);
    if ($("dangerStatus")) $("dangerStatus").textContent = checklistStatus(state);
    if ($("dangerSummary")) {
      $("dangerSummary").textContent = "Recorded checklist: " + DANGER_SIGNS.map(function (sign) {
        var value = state.values[sign[0]].toLowerCase().replace("_", " ");
        return sign[1] + ": " + value.charAt(0).toUpperCase() + value.slice(1);
      }).join("; ") + ".";
    }
    if ($("assess") && !assessCtl) $("assess").disabled = !Boolean(clinicalInput() && clinicalInput().value.trim());
    return state.ready;
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
    var broaderFocus = $("assessmentFocus") && $("assessmentFocus").value === "BROADER_WHO";
    var breathing = structured.respiratoryAssessment;
    if (!breathing) {
      if (!broaderFocus) missing.push("respiratoryConcern");
    } else if (breathing.coughOrDifficultBreathing === "PRESENT") {
      if (!Number.isInteger(breathing.respiratoryRatePerMinute)) missing.push("respiratoryRatePerMinute");
      if (breathing.rateCountQuality !== "ONE_MINUTE_WHILE_CALM") missing.push("rateCountQuality");
    }
    return missing.concat(unifiedState.candidate ? unifiedState.candidate.conflicts : []);
  }

  function focusMissingField(field) {
    field = field.replace(/^dangerObservations\./, "").replace(/^respiratoryAssessment\./, "");
    var danger = DANGER_SIGNS.some(function (sign) { return sign[0] === field; });
    var target = danger ? document.querySelector('input[name="danger-' + field + '"]') :
      field === "respiratoryConcern" ? document.querySelector('input[name="respiratory-concern"]') :
      field === "patientAge" ? $("patientAgeValue") : $(field);
    if (target) target.focus();
  }

  function scheduleMissingFieldFocus(field) {
    var owner = {
      revision: unifiedState.revision,
      reviewRevision: unifiedState.reviewPresentedRevision,
      generation: unifiedState.focusGeneration,
    };
    setTimeout(function () {
      if (owner.revision !== unifiedState.revision ||
          owner.reviewRevision !== unifiedState.reviewPresentedRevision ||
          owner.generation !== unifiedState.focusGeneration) return;
      if ($("missingReview") && $("missingReview").classList.contains("hidden")) return;
      if (missingClinicalFields()[0] !== field) return;
      focusMissingField(field);
    }, 0);
  }

  function renderMissingReview(fields, deferFocus) {
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
    if (fields.length) {
      if (deferFocus) scheduleMissingFieldFocus(fields[0]);
      else focusMissingField(fields[0]);
    }
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

  function beginSharedPresentationRevision() {
    unifiedState.presentationRevision = unifiedState.revision;
    if ($("sharedAnswer")) {
      $("sharedAnswer").textContent = "";
      $("sharedAnswer").classList.add("hidden");
      $("sharedAnswer").removeAttribute("data-state");
    }
    if ($("status")) $("status").textContent = "";
    if ($("err")) $("err").textContent = "";
    if ($("cancelPrompt")) $("cancelPrompt").hidden = true;
    if ($("retryPrompt")) $("retryPrompt").hidden = true;
  }

  function handleUnifiedInput() {
    unifiedState.revision += 1;
    unifiedState.focusGeneration += 1;
    unifiedState.choiceRevision = null;
    unifiedState.routeOverride = null;
    unifiedState.deferMissingFocusRevision = null;
    unifiedState.reviewPresentedRevision = null;
    unifiedState.reviewedRevision = null;
    invalidatePromptRun();
    invalidateClinicalResult();
    beginSharedPresentationRevision();
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
    unifiedState.focusGeneration += 1;
    unifiedState.choiceRevision = revision;
    unifiedState.routeOverride = route;
    unifiedState.deferMissingFocusRevision = route === "CLINICAL" ? revision : null;
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
    var deferMissingFocus = unifiedState.deferMissingFocusRevision === unifiedState.revision;
    unifiedState.deferMissingFocusRevision = null;
    var complete = updateDangerChecklist();
    if (unifiedState.reviewPresentedRevision !== unifiedState.revision) {
      unifiedState.reviewPresentedRevision = unifiedState.revision;
      var missing = complete ? [] : missingClinicalFields();
      if (missing.length) renderMissingReview(missing, deferMissingFocus);
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
    unifiedState.focusGeneration += 1;
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

  function clearHealthTruth() {
    var net = $("net");
    if (net) {
      var text = net.querySelector(".badge-txt");
      if (text) text.textContent = "Runtime proof unavailable";
      net.classList.remove("is-offline", "is-online");
      delete net.dataset.egress;
      net.title = "Server egress status is unavailable.";
    }
    var proof = $("odProof");
    if (proof) { proof.innerHTML = ""; proof.hidden = true; }
  }

  function renderHealthBadge(eg) {
    var net = $("net");
    if (!eg.armed) { clearHealthTruth(); return; }
    if (!net) return;
    var btxt = net.querySelector(".badge-txt");
    if (btxt) btxt.textContent = "On-device";
    net.classList.add("is-offline");
    net.classList.remove("is-online");
    net.dataset.egress = "1";
    net.title = "On-device only. Egress guard armed" + (eg.strict ? " (strict)" : "") +
      " — network calls this session: " + (eg.violations || 0) + " blocked.";
  }

  function renderHealthProof(h, eg) {
    var proof = $("odProof");
    if (!proof) return;
    var chips = [];
    if (eg.armed) {
      chips.push('<span class="od-chip od-chip--seal">' + ICON.shield + "Network calls this session: " +
        (eg.violations || 0) + (eg.strict ? " &middot; egress blocked (strict)" : "") + "</span>");
    }
    var residents = Array.isArray(h.residentModels) ? h.residentModels : [];
    if (h.medpsy && residents.indexOf("medpsy") !== -1) {
      chips.push('<span class="od-chip">' + ICON.chip + "MedPsy " + esc(String(h.medpsy).toUpperCase()) + " &middot; runs on this Mac</span>");
    }
    proof.innerHTML = chips.join("");
    proof.hidden = chips.length === 0;
  }

  function renderSetupHealth(h) {
    var banner = $("setupBanner");
    if (!banner || h.ready == null) return;
    if (h.ready === true) { banner.classList.add("hidden"); return; }
    if (h.inference && h.inference.recoveryRequired) {
      banner.innerHTML = "<strong>Local inference restart required.</strong> Stop and restart the supported app server before retrying.";
    } else if (h.chunks === 0 || h.citationMapHealthy === false || h.ragLive === false) {
      banner.innerHTML = "<strong>WHO reference store not ready.</strong> Restore the verified protocol files, run <code>npm run ingest</code>, then restart the supported app server.";
    } else banner.innerHTML = "<strong>Runtime loading.</strong> Keep this page open while the local model and WHO reference engine finish loading.";
    banner.classList.remove("hidden");
  }

  function observeRuntimeIdentity(h) {
    var runtime = h.model && h.model.productRuntime;
    if (!runtime || !runtime.name || !runtime.version) return;
    COPY.d_medpsy = String(runtime.name) + " " + String(runtime.version) + " · on-device";
  }

  function scheduleHealthRefresh(delay) {
    var timer = setTimeout(refreshHealth, delay);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  // Keep proof current after readiness because queue recovery can change without a reload.
  async function refreshHealth() {
    try {
      var response = await fetch("/health");
      var h = await response.json();
      if ($("hChunks")) $("hChunks").textContent = h.chunks != null ? h.chunks : "·";
      var eg = h.egress || {};
      renderHealthBadge(eg);
      renderHealthProof(h, eg);
      renderSetupHealth(h);
      observeRuntimeIdentity(h);
      if (h.ready != null) scheduleHealthRefresh(h.ready === true ? 10000 : 2000);
    } catch (error) {
    clearHealthTruth();
    var banner = $("setupBanner");
    if (banner) {
      banner.innerHTML = "<strong>Local runtime unreachable.</strong> Confirm the supported server is running, then retry this page.";
      banner.classList.remove("hidden");
    }
    if ($("hChunks")) $("hChunks").textContent = "Unavailable";
    var timer = setTimeout(refreshHealth, 2000);
    if (timer && typeof timer.unref === "function") timer.unref();
    }
  }
  refreshHealth();

  function wireExampleSeeds() {
    var seedRow = $("seeds");
    if (!seedRow) return;
    seedRow.querySelectorAll(".seed").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-fill") || "";
        var ta = clinicalInput();
        if (ta) { ta.value = t; handleUnifiedInput(); ta.focus(); }
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
        handleStructuredEdit();
        if ($("status")) $("status").textContent = "";
      });
    });
  }
  wireExampleSeeds();

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
      ["confirmAssessment", "correctAssessment", "rejectAssessment"].forEach(function (id) {
        if ($(id)) $(id).disabled = false;
      });
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

  function resetConfirmationPresentation(status) {
    clearReferenceActions();
    if ($("confirmationRegion")) $("confirmationRegion").removeAttribute("aria-busy");
    if ($("confirmationStatus")) {
      $("confirmationStatus").textContent = status || "";
      $("confirmationStatus").removeAttribute("tabindex");
    }
  }

  function transitionClinicalPhase(phase) {
    clinicalState.phase = phase;
    if ($("result")) $("result").dataset.clinicalPhase = phase;
  }

  function transitionToDeterministic(data) {
    resetConfirmationPresentation("");
    clinicalState.confirmationToken = null;
    clinicalState.continuationToken = data.token;
    transitionClinicalPhase("DETERMINISTIC");
  }

  function transitionToProvisional(data) {
    resetConfirmationPresentation("Ready for human review. Confirm, correct, or reject this provisional classification.");
    clinicalState.continuationToken = null;
    clinicalState.confirmationToken = data.token;
    transitionClinicalPhase("PROVISIONAL");
  }

  function transitionToConfirmed() {
    clinicalState.confirmationToken = null;
    resetConfirmationPresentation("Reviewed classification confirmed. Cited reference actions are shown.");
    transitionClinicalPhase("CONFIRMED");
  }

  function transitionToRejected() {
    clinicalState.confirmationToken = null;
    resetConfirmationPresentation("");
    transitionClinicalPhase("REJECTED");
    var region = $("confirmationRegion");
    if (region) {
      var instructions = region.querySelector(".confirmation-instructions");
      var actions = region.querySelector(".confirmation-actions");
      if (instructions) instructions.classList.add("hidden");
      if (actions) actions.classList.add("hidden");
    }
    ["confirmAssessment", "correctAssessment", "rejectAssessment"].forEach(function (id) {
      if ($(id)) $(id).disabled = true;
    });
    if ($("confirmationStatus")) {
      $("confirmationStatus").textContent = "Provisional classification rejected. No reference actions were shown.";
      $("confirmationStatus").tabIndex = -1;
      $("confirmationStatus").focus();
    }
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
    var heading = document.createElement("h3"); heading.className = "plan-head";
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
    resetConfirmationPresentation("");
    clinicalState.generation += 1;
    transitionClinicalPhase("RECORD");
    clinicalState.confirmationToken = null;
    clinicalState.continuationToken = null;
    clinicalState.confirmationPending = false;
    clinicalState.continuationPending = false;
    ["confirmAssessment", "correctAssessment", "rejectAssessment"].forEach(function (id) { if ($(id)) $(id).disabled = false; });
    if ($("confirmationRegion")) {
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

  function beginContinuation() {
    clinicalState.continuationPending = true;
    clinicalState.continuationToken = null;
    if ($("continueAssessment")) $("continueAssessment").disabled = true;
    $("continuationStatus").textContent = "Starting local supervised WHO review.";
    assessCtl = new AbortController();
    gotTerminal = false;
    $("reasoningWrap").classList.remove("hidden");
    startReasonTimer();
  }

  async function consumeContinuation(response, generation) {
    if (!response.ok || !response.body) {
      var failure = { error: "Continuation was not accepted." };
      try { failure = await response.json(); } catch (error) {}
      var continuationError = new Error(failure.error);
      continuationError.code = failure.code;
      continuationError.retryable = failure.retryable === true;
      throw continuationError;
    }
    var buffer = "";
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
  }

  async function sendContinuation() {
    if (!clinicalState.continuationToken || clinicalState.continuationPending || assessCtl) return;
    var token = clinicalState.continuationToken;
    var generation = clinicalState.generation;
    var retryable = false;
    beginContinuation();
    try {
      var response = await fetch("/triage/continue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token }), signal: assessCtl.signal,
      });
      await consumeContinuation(response, generation);
    } catch (error) {
      if (generation === clinicalState.generation) {
        retryable = error && error.retryable === true;
        if (retryable) {
          clinicalState.continuationToken = token;
          $("continuationRegion").classList.remove("hidden");
        }
        $("err").textContent = error && error.name === "AbortError"
          ? "The supervised continuation was stopped. Run the assessment again for a new one-use grant."
          : "The deterministic respiratory result remains valid. " + (error.message || "Local continuation was unavailable.")
            + (error.code ? " (" + error.code + ")" : "");
      }
    } finally {
      stopReasonTimer();
      assessCtl = null;
      if (generation === clinicalState.generation) {
        clinicalState.continuationPending = false;
        if (!retryable) $("continuationRegion").classList.add("hidden");
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
      var controller = assessCtl;
      controller.abort();
      stopReasonTimer();
      if ($("assess")) {
        $("assess").disabled = false;
        if (clinicalState.assessLabel != null) $("assess").innerHTML = clinicalState.assessLabel;
        $("assess").classList.remove("is-stopping");
        $("assess").onclick = runUnified;
      }
      clinicalState.assessLabel = null;
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
    } catch (error) {
      if (generation !== clinicalState.generation || token !== clinicalState.confirmationToken || clinicalState.phase !== "PROVISIONAL") return;
      throw error;
    } finally {
      if (generation === clinicalState.generation) {
        clinicalState.confirmationPending = false;
        if ($("confirmationRegion")) $("confirmationRegion").removeAttribute("aria-busy");
        if (clinicalState.phase === "PROVISIONAL" && $("confirmationStatus")) {
          $("confirmationStatus").textContent = "Confirmation was not applied. Review the error and retry.";
        }
        if (clinicalState.phase === "PROVISIONAL") {
          ["confirmAssessment", "correctAssessment", "rejectAssessment"].forEach(function (id) { if ($(id)) $(id).disabled = false; });
        }
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

  function parseClinicalFrame(block) {
    if (block.charAt(0) === ":") return null;
    var ev = (block.match(/^event: (.*)$/m) || [])[1];
    var dataLine = (block.match(/^data: (.*)$/m) || [])[1];
    if (!ev || !dataLine) return null;
    try { return { event: ev, data: JSON.parse(dataLine) }; }
    catch (error) { return { malformed: true }; }
  }

  function handleEvent(block, owner) {
    if (owner && !ownsClinicalRun(owner)) return;
    var frame = parseClinicalFrame(block);
    if (!frame) return;
    if (frame.malformed) {
      markClinicalTerminal(owner);
      $("err").textContent = "The local assessment response was malformed. Restart the supported app before retrying.";
      $("reasoningWrap").classList.add("hidden");
      return;
    }
    dispatchClinicalEvent(frame.event, frame.data, owner);
  }

  function dispatchClinicalEvent(ev, d, owner) {
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
      markClinicalTerminal(owner);
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
      markClinicalTerminal(owner);
      finishStages();
      renderCard(d.card);
    } else if (ev === "error") {
      markClinicalTerminal(owner);
      $("err").textContent = d.reason || d.error || "Local assistance is unavailable. Check readiness, then retry.";
      $("reasoningWrap").classList.add("hidden");
    }
  }
  // Set true when a terminal frame (card/abstain/error) arrives, so we can tell a clean
  // finish from a stream that closed early and left a blank card.
  var gotTerminal = false;

  function markClinicalTerminal(owner) {
    gotTerminal = true;
    if (owner) owner.terminal = true;
  }

  function ownsClinicalRun(owner) {
    return owner.generation === clinicalState.generation &&
      owner.revision === unifiedState.revision &&
      owner.presentationRevision === unifiedState.presentationRevision &&
      owner.controller === assessCtl;
  }

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

  function beginAssessmentRun() {
    gotTerminal = false;
    invalidateConfirmation();
    clinicalState.recordChangedDuringRun = false;
    var controller = new AbortController();
    assessCtl = controller;
    var owner = {
      controller: controller,
      generation: clinicalState.generation,
      revision: unifiedState.revision,
      presentationRevision: unifiedState.presentationRevision,
      terminal: false,
    };
    var assessLabel = $("assess").innerHTML;
    clinicalState.assessLabel = assessLabel;
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
    $("reasonLabel").textContent = t("reason_search");
    $("hTtft").textContent = "·"; $("hTps").textContent = "·"; $("hDev").textContent = "·";
    startReasonTimer();
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    return { owner: owner, controller: controller, assessLabel: assessLabel };
  }

  async function readAssessmentResponse(response, owner) {
    if (!response.ok || !response.body) {
      var message = "Could not run assessment (" + response.status + ").";
      try {
        var failure = await response.json();
        if (!ownsClinicalRun(owner)) return;
        if (failure && failure.error) message = failure.error;
        if (failure && Array.isArray(failure.conflicts)) renderMissingReview(failure.conflicts);
      } catch (error) {}
      throw new Error(message);
    }
    var buf = "";
    var reader = response.body.getReader();
    var dec = new TextDecoder();
    for (;;) {
      var res = await reader.read();
      if (!ownsClinicalRun(owner)) return;
      if (res.done) break;
      buf += dec.decode(res.value, { stream: true });
      var index;
      while ((index = buf.indexOf("\n\n")) >= 0) {
        handleEvent(buf.slice(0, index), owner);
        buf = buf.slice(index + 2);
      }
    }
    if (!owner.terminal) {
      $("err").textContent = "The assessment did not finish. Try again.";
      $("reasoningWrap").classList.add("hidden");
    }
  }

  function renderAssessmentFailure(error, owner) {
    if (!ownsClinicalRun(owner)) return;
    if (error && error.name === "AbortError") {
      $("status").textContent = clinicalState.recordChangedDuringRun
        ? "Recorded data changed. Run the assessment again." : "Stopped.";
      $("err").textContent = "";
    } else $("err").textContent = "Could not run assessment. " + error.message;
    $("reasoningWrap").classList.add("hidden");
  }

  function finishAssessmentRun(run) {
    if (ownsClinicalRun(run.owner)) {
      stopReasonTimer();
      $("assess").disabled = false;
      $("assess").innerHTML = run.assessLabel;
      $("assess").classList.remove("is-stopping");
      $("assess").onclick = runUnified;
      assessCtl = null;
      clinicalState.assessLabel = null;
      $("result").removeAttribute("aria-busy");
    } else if (assessCtl === run.controller) assessCtl = null;
  }

  async function runAssess() {
    var request = reviewedClinicalRequest();
    if (!request) return;
    if (!request.caseText) { $("status").textContent = "Describe or record a case first."; clinicalInput().setAttribute("aria-invalid", "true"); clinicalInput().focus(); return; }
    if (!updateDangerChecklist()) { $("status").textContent = $("dangerStatus").textContent || "Complete the recorded assessment first."; return; }
    if (assessCtl) return;
    var run = beginAssessmentRun();
    try {
      var response = await fetch("/triage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request), signal: run.controller.signal,
      });
      if (!ownsClinicalRun(run.owner)) return;
      await readAssessmentResponse(response, run.owner);
    } catch (error) { renderAssessmentFailure(error, run.owner); }
    finally { finishAssessmentRun(run); }
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

  function beginPromptRun(prompt) {
    promptState.runId += 1;
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
    return { runId: promptState.runId, controller: promptState.abortController };
  }

  async function readPromptResponse(response, runId) {
    if (!response.ok) {
      var failure = { error: "Local prompt request was not accepted.", code: "REQUEST_REJECTED", retryable: false };
      try { failure = await response.json(); } catch (error) {}
      if (runId === promptState.runId) promptState.retryable = failure.retryable !== false;
      throw new Error(failure.error + (failure.code ? " (" + failure.code + ")" : ""));
    }
    if (!response.body) {
      if (runId === promptState.runId) promptState.retryable = true;
      throw new Error("The local prompt response had no readable stream.");
    }
    var buffer = "";
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
  }

  function renderPromptFailure(error, runId) {
    if (runId !== promptState.runId) return;
    promptState.terminal = true;
    if (error && error.name === "AbortError") $("status").textContent = promptState.cancelMessage || "Stopped locally.";
    else {
      $("status").textContent = "Local assistance unavailable.";
      promptMessage("unavailable", "Local assistance unavailable", { reason: error.message || "The local prompt run could not finish." });
    }
  }

  function finishPromptRun(runId) {
    if (runId !== promptState.runId) return;
    promptState.abortController = null;
    updatePromptReadiness();
    $("cancelPrompt").hidden = true;
    $("retryPrompt").hidden = !promptState.retryable;
  }

  async function runPrompt() {
    var prompt = clinicalInput().value;
    if (!prompt.trim()) { $("status").textContent = "Enter a request first."; clinicalInput().focus(); return; }
    var run = beginPromptRun(prompt);
    try {
      var response = await fetch("/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt }), signal: run.controller.signal,
      });
      await readPromptResponse(response, run.runId);
    } catch (error) { renderPromptFailure(error, run.runId); }
    finally { finishPromptRun(run.runId); }
  }

  async function cancelPrompt() {
    promptState.cancelMessage = null;
    var owner = {
      runId: promptState.runId,
      presentationRevision: unifiedState.presentationRevision,
      jobId: promptState.jobId,
      controller: promptState.abortController,
    };
    function ownsCancellation() {
      return owner.runId === promptState.runId &&
        owner.presentationRevision === unifiedState.presentationRevision &&
        owner.jobId === promptState.jobId &&
        owner.controller === promptState.abortController;
    }
    if (owner.jobId) {
      try {
        var response = await fetch("/jobs/" + encodeURIComponent(owner.jobId), { method: "DELETE" });
        if (!ownsCancellation()) return;
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
        if (!ownsCancellation()) return;
        $("status").textContent = "Cancellation could not be confirmed; the local run is still active.";
        return;
      }
    } else {
      promptState.cancelMessage = "Stopped before a local job was assigned.";
    }
    if (ownsCancellation() && owner.controller) owner.controller.abort();
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
      refreshHealth: refreshHealth,
      clinicalState: clinicalState,
    };
  }
})();
