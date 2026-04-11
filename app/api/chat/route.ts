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

The widget has already verified the seller is logged in. Do NOT ask about login. Proceed directly.

STEP 1 — GET TAIL NUMBER:
Ask: "What's the tail number?"
When they give it, the system will automatically look up the FAA registry and provide aircraft details (make, model, year, serial, engine). Present the FAA data and ask the seller to confirm: "I pulled up your aircraft from the FAA registry — looks like it's a [year] [make] [model], serial [s/n], [engine]. That correct?"
If no FAA data comes back, ask them to provide: make, model, year, and serial number.

STEP 2 — PRICING:
"What are you asking for it?" and "Firm, negotiable, or best offer?"

STEP 3 — TIMES:
"Total time on the airframe?" then "Engine SMOH?" then "Prop model and time?" (optional)

STEP 4 — DESCRIPTION:
"Give me a description — condition, history, recent work, why you're selling."
"Any damage history?" (none, minor, major)
"What's the avionics stack?"

STEP 5 — SELLER INFO:
"Your name, phone number, and location (airport or city)?"
"When's the next annual due?" (optional)

STEP 6 — OPTIONAL SPECS (ask if seller wants to add):
Useful load, fuel capacity, cruise speed, range, equipment list

STEP 7 — PHOTOS AND DOCUMENTS:
"Hit the paperclip icon next to the chat input to attach photos — left side, right side, front, panel, interior, engine. Logbook scans and equipment lists too. They'll link to your listing automatically."

STEP 8 — CONFIRM AND SUBMIT:
Summarize all collected fields. Ask seller to confirm.
Categories: single-piston, multi-piston, turboprop, jet, helicopter, experimental, other
condition: used or new. damageHistory: none, minor, major.
Once confirmed, emit on its own line at the very end:
LISTING_DRAFT:{"make":"...","model":"...","year":...,"price":"...","nNumber":"...","serialNumber":"...","totalTime":"...","engineModel":"...","engineTime":"...","propModel":"...","propTime":"...","annualDue":"...","usefulLoad":"...","fuelCapacity":"...","cruiseSpeed":"...","range":"...","category":"...","condition":"...","damageHistory":"...","description":"...","avionics":"...","priceLabel":"...","sellerName":"...","sellerPhone":"...","sellerLocation":"..."}
Tell them: "Your listing is submitted for review. Once approved it goes Active. You can pause, mark sold, or delete anytime."

If seller says "save" or "continue later", emit: LISTING_SAVE:{"email":"...","collected fields so far"}

Keep answers under 120 words. Be conversational, not robotic.`;
}


const NNUMBER_RE = /\b[Nn]\s?-?\s?(\d{1,5}[A-Za-z]{0,2})\b/;

async function lookupFaaRegistry(nNumber: string): Promise<string> {
  const clean = nNumber.replace(/^[Nn]-?\s*/, "").toUpperCase();
  try {
    const url = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=N${clean}`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": "RWAS-Jerry/1.0 (aircraft listing intake)" },
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const html = await res.text();

    // FAA registry uses data-label attributes for field values
    const fields: Record<string, string> = {};
    const dataLabelPattern = /<td data-label="([^"]*)">([\s\S]*?)<\/td>/gi;
    let match;
    while ((match = dataLabelPattern.exec(html)) !== null) {
      const label = match[1].trim();
      const value = match[2].trim();
      if (label && value && value !== "None") {
        fields[label] = value;
      }
    }

    if (!Object.keys(fields).length) return "";

    const parts: string[] = [];
    const mfr = fields["Manufacturer Name"] || "";
    const model = fields["Model"] || "";
    const year = fields["Mfr Year"] || "";
    const serial = fields["Serial Number"] || "";
    const status = fields["Status"] || "";
    const acType = fields["Aircraft Type"] || "";
    const engMfr = fields["Engine Manufacturer"] || "";
    const engModel = fields["Engine Model"] || "";
    const city = fields["City"] || "";
    const state = fields["State"] || "";

    if (mfr || model) parts.push("Aircraft: " + (year ? year + " " : "") + mfr + " " + model);
    if (serial) parts.push("Serial Number: " + serial);
    if (acType) parts.push("Aircraft Type: " + acType);
    if (engMfr && engMfr !== "Unknown") parts.push("Engine: " + engMfr + (engModel && engModel !== "Unknown" ? " " + engModel : ""));
    if (status) parts.push("Registration Status: " + status);
    if (city && state) parts.push("Registered Location: " + city + ", " + state);

    if (!parts.length) return "";
    return "FAA REGISTRY LOOKUP for N" + clean + ":\n" + parts.join("\n") + "\nUse this data to pre-fill listing fields. Confirm details with the seller before proceeding.";
  } catch {
    return "";
  }
}


async function buildAugmentedMessage(userMessage: string) {
  const faqContext = getFaqContext(userMessage);
  const manualContext = getGarminManualContext(userMessage);
  const listingContext = LISTING_INTENT_RE.test(userMessage) ? getListingPrompt() : "";

  let nNumberContext = "";
  const nMatch = userMessage.match(NNUMBER_RE);
  if (nMatch) {
    nNumberContext = await lookupFaaRegistry(nMatch[0]);
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
    const { messages, sessionId } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user");
    if (!lastUserMsg) {
      return NextResponse.json({ ok: false, error: "no user message" }, { status: 400 });
    }

    // Build conversation context from history
    const historyContext = messages
      .slice(-10) // Last 10 messages for context
      .map((m: { role: string; content: string }) => {
        const prefix = m.role === "user" ? "SELLER" : "JERRY";
        return prefix + ": " + m.content;
      })
      .join("\n");

    // Check if any message in history has listing intent (means we're mid-intake)
    const isIntakeConversation = messages.some(
      (m: { role: string; content: string }) => LISTING_INTENT_RE.test(m.content)
    );

    // Augment the last message with context
    let augmented = await buildAugmentedMessage(lastUserMsg.content);

    // If mid-intake but last message didn't trigger listing prompt, add it
    if (isIntakeConversation && !LISTING_INTENT_RE.test(lastUserMsg.content)) {
      const listingPrompt = getListingPrompt();
      if (listingPrompt && !augmented.includes("LISTING INTAKE")) {
        augmented = listingPrompt + "\n\nCONVERSATION SO FAR:\n" + historyContext + "\n\nCustomer message:\n" + lastUserMsg.content;
        // If there's FAA data, prepend it
        const nMatch = lastUserMsg.content.match(NNUMBER_RE);
        if (nMatch) {
          const faaData = await lookupFaaRegistry(nMatch[0]);
          if (faaData) {
            augmented = listingPrompt + "\n\n" + faaData + "\n\nCONVERSATION SO FAR:\n" + historyContext + "\n\nCustomer message:\n" + lastUserMsg.content;
          }
        }
      }
    }

    // Use stable session key so Jerry remembers the conversation
    const stableSessionKey = sessionId || "web-" + messages[0]?.content?.slice(0, 20).replace(/[^a-z0-9]/gi, "") || Date.now();

    const resp = await fetch(`${JERRY_RELAY}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${JERRY_TOKEN}`,
      },
      body: JSON.stringify({
        message: augmented,
        sessionKey: String(stableSessionKey),
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
