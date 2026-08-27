(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TriageUnifiedInput = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var OBSERVATIONS = [
    ["cannotDrinkOrBreastfeed", /\b(?:can|able to|still)\s+(?:drink|breastfeed)|\bdrinking well\b/i, /\b(?:cannot|can't|unable to)\s+(?:drink(?:\s+or\s+breastfeed)?|breastfeed)\b/i],
    ["vomitsEverything", /\b(?:does not|doesn't|not) vomit everything\b|\bno vomiting\b/i, /\bvomits? everything\b/i],
    ["convulsions", /\bno convulsions?\b/i, /\bconvulsions?\b/i],
    ["lethargicOrUnconscious", /\b(?:not lethargic|conscious and alert|alert and responsive)\b/i, /\b(?:lethargic(?:\s+or\s+unconscious)?|unconscious)\b/i],
    ["chestIndrawing", /\b(?:no|without)\s+chest indrawing\b/i, /\bchest indrawing\b/i],
    ["stridorWhenCalm", /\bno stridor\s+(?:when|while)\s+calm\b/i, /\bstridor\s+(?:when|while)\s+calm\b/i],
    ["lowOxygenOrCentralCyanosis", /\b(?:no low oxygen|no central cyanosis|oxygen (?:is )?normal)\b/i, /\b(?:low oxygen(?:\s+or\s+central cyanosis)?|central cyanosis)\b/i],
  ];
  var NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

  function routeInput(text) {
    var input = assertedText(text).trim();
    if (!input) return "AMBIGUOUS";
    if (/^(?:please\s+)?(?:explain|summari[sz]e|compare|define|list|outline|state|describe|why\b|what\b|how\b)/i.test(input)) return "GENERAL";
    if (allObservationsAbsent(input)) return "CLINICAL";
    var age = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?\s*(?:months?|years?)(?:\s+old)?\b/i.test(input);
    var person = /\b(?:patient|child|infant|baby|boy|girl|woman|man|adult)\b/i.test(input);
    var finding = /\b(?:cough|breath(?:ing|less)|fever|diarrh(?:oea|ea)|vomit|convulsion|lethargic|unconscious|stridor|cyanosis|sunken eyes|depression)\b/i.test(input);
    if (OBSERVATIONS.some(function (spec) {
      var evidence = observationEvidence(input, spec);
      return evidence.present || evidence.absent;
    })) return "CLINICAL";
    return (finding && (age || person)) ? "CLINICAL" : "AMBIGUOUS";
  }

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

  function withoutPattern(text, pattern) {
    var flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    return text.replace(new RegExp(pattern.source, flags), " ");
  }

  function assertedText(text) {
    var asserted = String(text || "").replace(/"[^"]*"|“[^”]*”/g, " ");
    asserted = asserted.replace(/(^|[\s([{:;,])'[^'\r\n]+'(?=$|[\s)\]}:;,.!?])/g, "$1 ");
    asserted = asserted.replace(/‘[^’]*’/g, " ");
    asserted = asserted.replace(/\b(?:asked|asks?|wondered|wonders?)\s+whether\b[^.!?;]*/gi, " ");
    asserted = asserted.replace(/\b(?:if|whether|assuming|suppose(?:\s+that)?)\b[^.!?;]*/gi, " ");
    OBSERVATIONS.forEach(function (spec) {
      asserted = asserted.replace(new RegExp("(?:" + spec[2].source + ")\\s+absent-minded\\b", "gi"), " ");
    });
    return asserted;
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

  function localPolarity(clause, occurrence, negativeRanges) {
    if (negativeRanges.some(function (range) { return rangesOverlap(range, occurrence); })) return "ABSENT";
    var suffixText = clause.slice(occurrence.end);
    if (/^\s+(?:(?:is|was|were)\s+)?(?:not\s+(?:assessed|recorded|provided|established)|unknown|documented)(?![-\w])/i.test(suffixText)) return "NONE";
    if (/^\s+(?:(?:is|was|were)\s+)?not\s+present\b/i.test(suffixText) || /^\s+denied\b/i.test(suffixText)) return "ABSENT";
    var suffix = suffixText.match(/^\s+(?:(?:is|was|were)\s+)?(present|absent)(?![-\w])/i);
    if (suffix) return suffix[1].toUpperCase();
    var prefix = clause.slice(0, occurrence.start);
    if (/\b(?:check|screen)(?:ed|ing)?\s+for\s+$/i.test(prefix) ||
        /\b(?:documented|used\s+the\s+(?:word|phrase))\s+$/i.test(prefix)) return "NONE";
    if (/\b(?:denied|no\s+history\s+of)\s+$/i.test(prefix)) return "ABSENT";
    if (/\b(?:has|had|with|shows?|is|was)\s+(?:a\s+)?$/i.test(prefix)) return "PRESENT";
    return null;
  }

  function observationEvidence(text, spec) {
    var evidence = { present: false, absent: false };
    text.split(/[.!?;]+|\bbut\b|\bhowever\b/gi).forEach(function (clause) {
      var negativeRanges = patternMatches(clause, spec[1]);
      var occurrences = patternMatches(clause, spec[2]);
      if (negativeRanges.length) evidence.absent = true;
      var sharedAbsent = observationCount(clause) > 1 &&
        /\b(?:(?:is|was|were)\s+)?absent(?![-\w])\s*$/i.test(clause);
      occurrences.forEach(function (occurrence) {
        var polarity = localPolarity(clause, occurrence, negativeRanges);
        if (polarity === "NONE") return;
        if (polarity === "PRESENT") evidence.present = true;
        else if (polarity === "ABSENT" || sharedAbsent) evidence.absent = true;
        else evidence.present = true;
      });
    });
    return evidence;
  }

  function observationValue(text, spec, allAbsent, conflicts) {
    var evidence = observationEvidence(text, spec);
    var absent = allAbsent || evidence.absent;
    var present = evidence.present;
    if (present && absent) {
      conflicts.push("dangerObservations." + spec[0]);
      return "NOT_ASSESSED";
    }
    return present ? "PRESENT" : absent ? "ABSENT" : "NOT_ASSESSED";
  }

  function extractObservations(text, conflicts) {
    var allAbsent = allObservationsAbsent(text);
    var values = {};
    OBSERVATIONS.forEach(function (spec) { values[spec[0]] = observationValue(text, spec, allAbsent, conflicts); });
    return values;
  }

  function allObservationsAbsent(text) {
    return /\ball\s+(?:seven|7)\s+(?:structured\s+)?(?:danger and breathing\s+)?observations?\s+(?:were\s+|are\s+)?(?:recorded\s+)?absent\b/i.test(text);
  }

  function respiratoryConcern(text, conflicts) {
    var absentPattern = /\b(?:no|without)\s+(?:cough|difficult breathing)\b/i;
    var absent = absentPattern.test(text);
    var present = /\b(?:has|with|reports?|presenting with)?\s*(?:a\s+)?cough\b|\bdifficult breathing\b/i.test(absent ? withoutPattern(text, absentPattern) : text);
    if (present && absent) { conflicts.push("respiratoryConcern"); return "NOT_ASSESSED"; }
    return present ? "PRESENT" : absent ? "ABSENT" : "NOT_ASSESSED";
  }

  function extractWeight(text) {
    var match = text.match(/\b(?:weighs?|weight(?:\s+is)?)\s*(\d+(?:\.\d+)?)\s*kg\b/i);
    return match ? Number(match[1]) : null;
  }

  function extractClinicalCandidate(text) {
    var input = assertedText(text);
    var conflicts = [];
    var ages = ageCandidates(input);
    var rates = rateCandidates(input);
    if (uniqueValues(ages.map(function (age) { return age.value + ":" + age.unit; })).length > 1) conflicts.push("patientAge");
    if (rates.length > 1) conflicts.push("respiratoryRatePerMinute");
    return {
      patientAge: ages[0] || null, patientWeightKg: extractWeight(input),
      dangerObservations: extractObservations(input, conflicts), respiratoryConcern: respiratoryConcern(input, conflicts),
      respiratoryRatePerMinute: rates[0] || null,
      rateCountQuality: /\b(?:for\s+)?one minute while calm\b/i.test(input) ? "ONE_MINUTE_WHILE_CALM" : "NOT_CONFIRMED",
      medicationSafety: { allergiesReviewed: "NOT_ASSESSED", contraindicationsReviewed: "NOT_ASSESSED" },
      protocolApplicability: "NOT_ASSESSED", conflicts: conflicts,
    };
  }

  return { routeInput: routeInput, extractClinicalCandidate: extractClinicalCandidate };
});
