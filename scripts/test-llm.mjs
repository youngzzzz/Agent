import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const apiKey = env.LLM_API_KEY;
const baseURL = (env.LLM_BASE_URL || "").replace(/\/+$/, "");
const model = env.LLM_MODEL;
const path = env.LLM_PATH || "/chat/completions";
const url = baseURL + path;

console.log("Config:");
console.log("  URL:", url);
console.log("  MODEL:", model);
console.log("  KEY:", apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (len=${apiKey.length})` : "(missing)");

if (!apiKey || !baseURL || !model) {
  console.error("Missing required env vars");
  process.exit(1);
}

const isMiniMaxAnthropic = path === "/v1/messages" || (model.toLowerCase().includes("minimax") && path.includes("anthropic"));
const isMiniMax = path === "/text/chatcompletion_v2" || model.toLowerCase().includes("minimax");

let body;
if (isMiniMaxAnthropic) {
  body = {
    model,
    messages: [{ role: "user", content: [{ type: "text", text: "回复 OK" }] }],
    max_tokens: 50,
  };
} else if (isMiniMax) {
  body = {
    model,
    messages: [{ role: "user", text: "回复 OK" }],
    max_tokens: 50,
  };
} else {
  body = {
    model,
    messages: [{ role: "user", content: "回复 OK" }],
    max_tokens: 50,
  };
}

console.log("\nSending test request...");
const start = Date.now();
try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  console.log(`Status: ${res.status} (${Date.now() - start}ms)`);
  console.log("Response:", text.slice(0, 800));
} catch (err) {
  console.error(`Failed (${Date.now() - start}ms):`, err.message);
  if (err.cause) console.error("Cause:", err.cause);
}
