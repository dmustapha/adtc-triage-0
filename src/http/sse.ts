import type { Response } from "express";
import { recordDiagnostic } from "../logging.js";

export type SseStream = {
  send(event: string, data: unknown): boolean;
  finish(): void;
  isOpen(): boolean;
};

export function openSse(response: Response, onDisconnect: () => void): SseStream {
  let open = true;
  response.setHeader("Content-Type", "text/event-stream");
  if (!response.hasHeader("Cache-Control")) response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();
  response.on("close", () => {
    const disconnected = open && !response.writableEnded;
    open = false;
    if (disconnected) onDisconnect();
  });
  return {
    send(event, data) {
      if (!open || response.writableEnded || response.destroyed) return false;
      try { response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); return true; }
      catch (error) { recordDiagnostic("SSE_WRITE_FAILED", error); open = false; return false; }
    },
    finish() {
      if (!open || response.writableEnded) return;
      open = false;
      response.end();
    },
    isOpen: () => open && !response.writableEnded && !response.destroyed,
  };
}
