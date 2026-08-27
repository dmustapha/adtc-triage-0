(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TriageUnifiedInput = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

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

  function routeInput(text) {
    var input = assertedText(text).trim();
    if (!input) return "AMBIGUOUS";
    if (/^(?:please\s+)?(?:explain|summari[sz]e|compare|define|list|outline|state|describe|why\b|what\b|how\b)/i.test(input)) return "GENERAL";
    var authorityInput = observationSegments(input)
      .filter(function (clause) { return !clauseNonAuthority(clause); }).join(" ");
    if (allObservationsAbsent(input)) return "CLINICAL";
    var age = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?\s*(?:months?|years?)(?:\s+old)?\b/i.test(authorityInput);
    var person = /\b(?:patient|child|infant|baby|boy|girl|woman|man|adult)\b/i.test(authorityInput);
    var finding = /\b(?:cough|breath(?:ing|less)|fever|diarrh(?:oea|ea)|vomit|convulsion|lethargic|unconscious|stridor|cyanosis|sunken eyes|depression)\b/i.test(authorityInput);
    if (OBSERVATIONS.some(function (spec) {
      var evidence = observationEvidence(authorityInput, spec);
      return evidence.present || evidence.absent;
    })) return "CLINICAL";
    var respiratory = respiratoryEvidence(authorityInput);
    if (respiratory.present || respiratory.absent) return "CLINICAL";
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
    var closes = { "'": "'", "\"": "\"", "‘": "’", "“": "”" };
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

  function extractObservations(text, conflicts) {
    var allAbsent = allObservationsAbsent(text);
    var values = {};
    OBSERVATIONS.forEach(function (spec) { values[spec[0]] = observationValue(text, spec, allAbsent, conflicts); });
    return values;
  }

  function allObservationsAbsent(text) {
    return text.split(/[.!;]+/).some(function (clause) {
      return /^\s*all\s+(?:seven|7)\s+(?:structured\s+)?(?:danger and breathing\s+)?observations?\s+(?:were\s+|are\s+)?(?:recorded\s+)?absent\s*$/i.test(clause);
    });
  }

  function respiratoryConcern(text, conflicts) {
    var evidence = respiratoryEvidence(text);
    if (evidence.present && evidence.absent) { conflicts.push("respiratoryConcern"); return "NOT_ASSESSED"; }
    return evidence.present ? "PRESENT" : evidence.absent ? "ABSENT" : "NOT_ASSESSED";
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
