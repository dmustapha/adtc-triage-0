import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "triage0_session";
const SESSION_PATTERN = /^[a-f0-9-]{20,80}$/i;

function cookieValue(header: string | undefined): string | null {
  const part = header?.split(";").map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE_NAME}=`));
  const value = part?.slice(COOKIE_NAME.length + 1);
  return value && SESSION_PATTERN.test(value) ? value : null;
}

export function browserSessionOwner(request: Request, response: Response): string {
  const existing = cookieValue(request.headers.cookie);
  if (existing) return existing;
  const owner = randomUUID();
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${owner}; HttpOnly; SameSite=Strict; Path=/`);
  return owner;
}
