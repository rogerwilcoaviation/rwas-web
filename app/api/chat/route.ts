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

const LISTING_INTENT_RE = /\b(list|sell|selling|post|listing|for sale|aircraft|tail number|n-number|logbook|asking price)\b/i;
function getListingPrompt(): string {
  return `AIRCRAFT LISTING INTAKE MODE — FOLLOW THESE INSTRUCTIONS EXACTLY:

STEP 1 — LOGIN FIRST (mandatory):
Your VERY FIRST response must ask the seller to log in. Say: "Before we get started, click the SELLER LOGIN button at the top of the page, enter your email, and verify the code. Let me know once you're logged in."
Do NOT collect any listing details until the seller confirms they are logged in.

STEP 2 — GET TAIL NUMBER:
Once logged in, ask for the tail number first. When they give it, tell them: "Great, give me a moment to pull up your aircraft." Then ask them to confirm: make, model, year, and serial number. Also suggest they can verify their registration at https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry

STEP 3 — COLLECT DETAILS (2-3 at a time):
REQUIRED: make, model, year, price, sellerName, sellerPhone, sellerLocation
IMPORTANT: nNumber, serialNumber, totalTime, engineModel, engineTime, category, description
OPTIONAL: propModel, propTime, annualDue, usefulLoad, fuelCapacity, cruiseSpeed, range, condition (used/new), damageHistory (none/minor/major), avionics, priceLabel, equipmentList
Categories: single-piston, multi-piston, turboprop, jet, helicopter, experimental, other

STEP 4 — CONFIRM AND SUBMIT:
Summarize all collected fields. Once confirmed, emit on its own line:
LISTING_DRAFT:{"make":"...","model":"...","year":...,"price":"...", etc}
Tell them: "Your listing is submitted for review. You can upload photos and logbook documents from My Listings once approved. You can pause, mark sold, or delete anytime."

If seller says "save" or "continue later", emit: LISTING_SAVE:{"email":"...","collected fields"}`;
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

function buildAugmentedMessage(userMessage: string) {
  const faqContext = getFaqContext(userMessage);
  const manualContext = getGarminManualContext(userMessage);
  const listingContext = LISTING_INTENT_RE.test(userMessage) ? getListingPrompt() : "";

  // N-number detection — tell Jerry to guide seller to FAA registry
  let nNumberContext = "";
  const nMatch = userMessage.match(NNUMBER_RE);
  if (nMatch) {
    const clean = nMatch[0].replace(/^[Nn]-?\s*/, "").toUpperCase();
    nNumberContext = "The seller mentioned tail number N" + clean + ". Direct them to verify their aircraft details at https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry and confirm the make, model, year, and serial number with you.";
  }

  const contextParts = [listingContext, nNumberContext, faqContext, manualContext].filter(Boolean);

  if (!contextParts.length) return userMessage;

  return [
    "MANDATORY INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY. These override your default behavior for this message. Read carefully and comply with every step listed below.",
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
        message: buildAugmentedMessage(lastUserMsg.content),
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
