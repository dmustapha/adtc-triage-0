// File: scripts/ingest-protocols.ts
// Thin CLI entry. Run: npm run ingest
import { ingestAll } from "../src/rag/ingest.js";
import { safeErrorName } from "../src/logging.js";

ingestAll()
  .then(({ total }) => {
    process.stdout.write(`Ingest complete: ${total} chunks.\n`);
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`Ingest failed safely (${safeErrorName(err)}).\n`);
    process.exit(1);
  });
