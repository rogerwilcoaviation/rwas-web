import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const JERRY_RELAY = "https://jerry-api.rwas.team";
const JERRY_TOKEN = "7786abd8bfa306d7cce405117bd39349586afc8cc7be62d59f1d70a422a228d8";
const FAQ_PATH = "/Users/rwas/.openclaw/workspace/JERRY-FAQ-KB.md";
const GARMIN_MANUALS_DIR = "/Users/rwas/Documents/garmin-manuals-text";
const MAX_FAQ_CHARS = 2200;
const MAX_MANUAL_FILES = 3;
const MAX_SNIPPETS_PER_FILE = 3;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchTerms(query: string) {
  const lowered = query.toLowerCase();
  const terms = new Set<string>();

  const aliasGroups: Array<[RegExp, string[]]> = [
    [/\bgtn\b|650xi|750xi|xi navigator/, ["GTN", "GTN 650", "GTN 750", "GTN Xi"]],
    [/\bgnx\b|gnx375|375/, ["GNX 375", "GNX"]],
    [/\bgfc\b|autopilot/, ["GFC 500", "GFC"]],
    [/\bg3x\b/, ["G3X Touch", "G3X"]],
    [/\bg5\b|electronic flight instrument/, ["G5"]],
    [/\bgma\b|audio panel/, ["GMA", "audio panel"]],
    [/\bgtx\b|transponder|ads-b/, ["GTX", "ADS-B", "transponder"]],
    [/\bgi[- ]?275\b|gi275/, ["GI 275"]],
    [/\btxi\b|g500txi|g600txi/, ["TXi", "G500TXi", "G600TXi"]],
    [/perspective|cirrus/, ["Perspective", "Perspective+", "Cirrus"]],
    [/cherokee|pa-28/, ["Cherokee", "PA-28"]],
    [/install|installation|wiring|pinout|stc|compatib/, ["installation", "install", "wiring", "STC", "compatibility"]],
  ];

  for (const [pattern, values] of aliasGroups) {
    if (pattern.test(lowered)) {
      values.forEach((value) => terms.add(value));
    }
  }

  for (const token of query.match(/[A-Za-z0-9+.-]+/g) || []) {
    if (token.length >= 3) terms.add(token);
  }

  return Array.from(terms).slice(0, 12);
}

function getFaqContext(query: string) {
  if (!existsSync(FAQ_PATH)) return "";
  const faq = readFileSync(FAQ_PATH, "utf8");
  const lowered = query.toLowerCase();
  const sections = faq.split(/^## /m).slice(1);
  const matched = sections.find((section) => section.toLowerCase().includes(lowered))
    || sections.find((section) => {
      const terms = buildSearchTerms(query).map((term) => term.toLowerCase());
      return terms.some((term) => section.toLowerCase().includes(term));
    });

  if (!matched) return "";
  return `FAQ reference:\n## ${matched.trim()}`.slice(0, MAX_FAQ_CHARS);
}

function getGarminManualContext(query: string) {
  if (!existsSync(GARMIN_MANUALS_DIR)) return "";

  const terms = buildSearchTerms(query);
  if (!terms.length) return "";

  const pattern = terms.map(escapeRegex).join("|");

  let files: string[] = [];
  try {
    const output = execFileSync("rg", ["-l", "-i", "-m", "1", pattern, GARMIN_MANUALS_DIR], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    });
    files = output.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, MAX_MANUAL_FILES);
  } catch {
    files = [];
  }

  if (!files.length) return "";

  const hits: string[] = [];

  for (const file of files) {
    try {
      const snippetOutput = execFileSync("rg", ["-n", "-i", "-m", String(MAX_SNIPPETS_PER_FILE), pattern, file], {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      }).trim();
      if (snippetOutput) {
        hits.push(`- ${basename(file)}\n${snippetOutput}`);
      }
    } catch {
      hits.push(`- ${basename(file)}`);
    }
  }

  if (!hits.length) return "";

  return [
    "Garmin manual reference hits (read-only local corpus):",
    ...hits,
  ].join("\n\n");
}

const LISTING_INTENT_RE = /\b(list|sell|selling|post|listing|for sale|aircraft.*(sale|sell|market)|want to (list|sell))\b/i;
const LISTING_PROMPT_PATH = "/Users/rwas/projects/rwas-web/public/js/jerry-listing-prompt.txt";

function getListingPrompt() {
  if (!existsSync(LISTING_PROMPT_PATH)) return "";
  return readFileSync(LISTING_PROMPT_PATH, "utf8");
}


const NNUMBER_RE = /\b[Nn]\s?-?\s?(\d{1,5}[A-Za-z]{0,2})\b/;

async function lookupFaaRegistry(nNumber: string): Promise<string> {
  const clean = nNumber.replace(/^[Nn]-?\s*/, "").toUpperCase();
  try {
    const url = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=N${clean}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RWAS-Jerry/1.0 (aircraft listing intake)" },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })(),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Extract key fields from the FAA registry HTML
    const extract = (label: string): string => {
      const patterns = [
        new RegExp(label + '\\s*</td>\\s*<td[^>]*>\\s*([^<]+)', 'i'),
        new RegExp(label + '\\s*:?\\s*</th>\\s*<td[^>]*>\\s*([^<]+)', 'i'),
        new RegExp('>' + label + '\\s*</label>\\s*[^<]*<[^>]*>\\s*([^<]+)', 'i'),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) return m[1].trim();
      }
      return "";
    };

    const data = {
      nNumber: "N" + clean,
      serialNumber: extract("Serial Number"),
      manufacturer: extract("Manufacturer Name") || extract("MFR Name"),
      model: extract("Model"),
      year: extract("Year Manufacturer") || extract("Year MFR"),
      engineManufacturer: extract("Engine Manufacturer") || extract("Eng MFR"),
      engineModel: extract("Engine Model"),
      type: extract("Type Aircraft"),
      registrant: extract("Name"),
      city: extract("City"),
      state: extract("State"),
      status: extract("Status"),
      certificateDate: extract("Certificate Issue Date"),
      airworthiness: extract("Airworthiness Date"),
    };

    const parts: string[] = [];
    if (data.manufacturer || data.model) parts.push(`Aircraft: ${data.year || "?"} ${data.manufacturer} ${data.model}`);
    if (data.serialNumber) parts.push(`Serial: ${data.serialNumber}`);
    if (data.engineManufacturer || data.engineModel) parts.push(`Engine: ${data.engineManufacturer} ${data.engineModel}`);
    if (data.registrant) parts.push(`Registrant: ${data.registrant}`);
    if (data.city && data.state) parts.push(`Location: ${data.city}, ${data.state}`);
    if (data.status) parts.push(`Status: ${data.status}`);
    if (data.airworthiness) parts.push(`Airworthiness: ${data.airworthiness}`);

    if (!parts.length) return "";
    return "FAA REGISTRY LOOKUP for N" + clean + ":\n" + parts.join("\n") + "\nUse this data to pre-fill listing fields. Confirm with the seller.";
  } catch {
    return "";
  }
}

async function buildAugmentedMessage(userMessage: string) {
  const faqContext = getFaqContext(userMessage);
  const manualContext = getGarminManualContext(userMessage);
  const listingContext = LISTING_INTENT_RE.test(userMessage) ? getListingPrompt() : "";

  // FAA N-number lookup
  let faaContext = "";
  const nMatch = userMessage.match(NNUMBER_RE);
  if (nMatch) {
    faaContext = await lookupFaaRegistry(nMatch[0]);
  }

  const contextParts = [listingContext, faaContext, faqContext, manualContext].filter(Boolean);

  if (!contextParts.length) return userMessage;

  return [
    "INTERNAL RWAS REFERENCE CONTEXT. Use this to answer accurately. Do not dump large manual excerpts verbatim. Quote only brief snippets when necessary, and prefer concise practical guidance.",
    ...contextParts,
    `Customer message:\n${userMessage}`,
  ].join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user");
    if (!lastUserMsg) {
      return NextResponse.json({ ok: false, error: "no user message" }, { status: 400 });
    }

    const resp = await fetch(`${JERRY_RELAY}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${JERRY_TOKEN}`,
      },
      body: JSON.stringify({
        message: await buildAugmentedMessage(lastUserMsg.content),
        sessionKey: "web-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
        timeout: 30000,
      }),
    });

    const data = await resp.json();
    const reply = data.reply || "Radio trouble on my end. Try again. — Capt. Jerry, RWAS";

    return NextResponse.json({ ok: true, reply });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, reply: "Radio trouble on my end. Try again. — Capt. Jerry, RWAS" },
      { status: 500 }
    );
  }
}
