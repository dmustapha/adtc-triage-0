import { generateKeyPairSync } from "node:crypto";
import { access, writeFile } from "node:fs/promises";

const privatePath = ".release-private-key.pem";
const publicPath = "config/release-public-key.pem";
for (const path of [privatePath, publicPath]) {
  try { await access(path); throw new Error(`refusing to overwrite release key: ${path}`); }
  catch (error) { if (error instanceof Error && error.message.startsWith("refusing")) throw error; }
}
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
await writeFile(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
await writeFile(publicPath, publicKey.export({ type: "spki", format: "pem" }), { flag: "wx" });
console.log(`created ${publicPath}; private key remains untracked at ${privatePath}`);
