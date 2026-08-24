const terminalMarker = "[end of text]" as const;
const isWhitespace = (character: string) => /[\t\n\r ]/.test(character);

export interface JsonFramingMetadata {
  leadingWhitespace: string;
  beforeTerminalWhitespace: string;
  terminalMarker: typeof terminalMarker | null;
  trailingWhitespace: string;
}

export interface NormalizedJsonStdout {
  rawStdout: string;
  normalizedPayload: string;
  framing: JsonFramingMetadata;
}

function skipWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length && isWhitespace(text[index])) index += 1;
  return index;
}

function findJsonEnd(text: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const opening = stack.pop();
      if ((opening === "{" && character !== "}") || (opening === "[" && character !== "]")) throw new Error("invalid JSON nesting");
      if (stack.length === 0) return index + 1;
    }
  }
  throw new Error("truncated JSON value");
}

function parseFraming(rawStdout: string, payloadEnd: number) {
  const framingStart = skipWhitespace(rawStdout, payloadEnd);
  const between = rawStdout.slice(payloadEnd, framingStart);
  if (framingStart === rawStdout.length) return { beforeTerminalWhitespace: "", terminalMarker: null, trailingWhitespace: between };
  if (!rawStdout.startsWith(terminalMarker, framingStart)) {
    if (rawStdout[framingStart] === "{" || rawStdout[framingStart] === "[") throw new Error("multiple JSON values");
    throw new Error("undocumented JSON suffix");
  }
  const markerEnd = framingStart + terminalMarker.length;
  const suffixEnd = skipWhitespace(rawStdout, markerEnd);
  if (suffixEnd !== rawStdout.length) throw new Error("undocumented JSON suffix");
  return { beforeTerminalWhitespace: between, terminalMarker, trailingWhitespace: rawStdout.slice(markerEnd) };
}

export function normalizeJsonStdout(rawStdout: string): NormalizedJsonStdout {
  const payloadStart = skipWhitespace(rawStdout, 0);
  const opening = rawStdout[payloadStart];
  if (opening !== "{" && opening !== "[") {
    if (rawStdout.slice(payloadStart).search(/[\[{]/) >= 0) throw new Error("non-whitespace JSON prefix");
    throw new Error("JSON value not found");
  }
  const payloadEnd = findJsonEnd(rawStdout, payloadStart);
  const normalizedPayload = rawStdout.slice(payloadStart, payloadEnd);
  try { JSON.parse(normalizedPayload); } catch { throw new Error("invalid JSON value"); }
  return {
    rawStdout,
    normalizedPayload,
    framing: { leadingWhitespace: rawStdout.slice(0, payloadStart), ...parseFraming(rawStdout, payloadEnd) },
  };
}
