import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const JERRY_RELAY = "https://jerry-api.rwas.team";
const JERRY_TOKEN = "7786abd8bfa306d7cce405117bd39349586afc8cc7be62d59f1d70a422a228d8";

const TEAMS_WEBHOOK = "https://default0ed1ffd35c5f47bfa84c67b907a1fc.8f.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cee436c59073463ea85b0102ba822bb3/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=dVy12Ll4q7-PENBM2Srj2hT1mGiSX9esL9PguynoP8w";
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

// ============================================================================
// Fix #2 — deterministic listing-intake intercept
// ============================================================================
// Feature flag; set JERRY_INTAKE_MODE=intercept in the env to activate.
const INTAKE_MODE = process.env.JERRY_INTAKE_MODE === "intercept";

const INTAKE_STEPS = [
  { key: "nNumber",        prompt: "Great — let's get your aircraft listed.\n\nFirst, what's the **tail number** (N-number)?" },
  { key: "make",           prompt: "Thanks. What's the **make** of the aircraft? (e.g. Cessna, Piper, Beechcraft)" },
  { key: "model",          prompt: "And the **model**? (e.g. 182, PA-28, Bonanza A36)" },
  { key: "year",           prompt: "**Year** of manufacture?" },
  { key: "totalTime",      prompt: "**Total airframe time** in hours? (enter a number, or `unknown`)" },
  { key: "engineTime",     prompt: "**Engine time** SMOH or since new, in hours? (or `unknown`)" },
  { key: "price",          prompt: "**Asking price** in USD? (enter a number — no commas or dollar signs)" },
  { key: "sellerName",     prompt: "Who should buyers contact? **Your full name**?" },
  { key: "sellerEmail",    prompt: "**Email** where we can reach you?" },
  { key: "sellerPhone",    prompt: "**Phone number** for buyer inquiries?" },
  { key: "sellerLocation", prompt: "**City and state** where the aircraft is based?" },
  { key: "description",    prompt: "Write a short **description** of the aircraft — condition, recent upgrades, why you're selling. (Type `skip` to leave blank.)" },
  { key: "avionics",       prompt: "List the **avionics stack**. (Type `skip` to leave blank.)" },
] as const;

type IntakeKey = typeof INTAKE_STEPS[number]["key"];

interface IntakeState {
  step: number;
  answers: Partial<Record<IntakeKey, string>>;
  startedAt: string;
  cancelled?: boolean;
  completed?: boolean;
}

const INTAKE_STATE_TOKEN = "LISTING_INTAKE_STATE:";
const INTAKE_FINAL_TOKEN = "LISTING_DRAFT:";
const BAIL_RE = /\b(cancel|never ?mind|stop|not now|exit|quit|abort|i changed my mind)\b/i;

function readIntakeState(messages: Array<{ role: string; content: string }>): IntakeState | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const match = m.content.match(new RegExp(`${INTAKE_STATE_TOKEN}(\\{[^}]+\\})`));
    if (match) {
      try { return JSON.parse(match[1]); } catch { return null; }
    }
  }
  return null;
}

function summariseDraft(d: Record<string, string>): string {
  const rows: Array<[string, string]> = [
    ["Aircraft", `${d.year} ${d.make} ${d.model}`.trim()],
    ["Tail #",   d.nNumber],
    ["Airframe", d.totalTime ? `${d.totalTime} hrs` : "—"],
    ["Engine",   d.engineTime ? `${d.engineTime} hrs` : "—"],
    ["Asking",   d.price ? `$${Number(d.price).toLocaleString()}` : "—"],
    ["Based",    d.sellerLocation],
    ["Contact",  `${d.sellerName} · ${d.sellerEmail} · ${d.sellerPhone}`],
  ];
  return rows.map(([k, v]) => `- **${k}:** ${v || "—"}`).join("\n");
}

interface InterceptResult { body: { reply: string; model?: string } | null }

async function handleListingIntake(
  userMessage: string,
  messages: Array<{ role: string; content: string }>,
): Promise<InterceptResult> {
  if (!INTAKE_MODE) return { body: null };
  const existing = readIntakeState(messages);
  const intentMatch = LISTING_INTENT_RE.test(userMessage);
  const bailMatch = BAIL_RE.test(userMessage);

  if (!existing && !intentMatch) return { body: null };

  if (existing && existing.step === -1) return { body: null };

  if (existing && bailMatch) {
    return {
      body: {
        reply:
          "No problem — cancelling the listing. If you want to pick it up again later, just say so.\n\n" +
          `${INTAKE_STATE_TOKEN}{"step":-1,"cancelled":true}`,
        model: "intercept/cancelled",
      },
    };
  }

  if (!existing && intentMatch) {
    const state: IntakeState = { step: 0, answers: {}, startedAt: new Date().toISOString() };
    return {
      body: {
        reply: INTAKE_STEPS[0].prompt + `\n\n${INTAKE_STATE_TOKEN}${JSON.stringify(state)}`,
        model: "intercept/intake",
      },
    };
  }

  if (existing && existing.step >= 0 && existing.step < INTAKE_STEPS.length) {
    const currentKey = INTAKE_STEPS[existing.step].key;
    const answer = userMessage.trim();
    const skip = answer.toLowerCase() === "skip";
    existing.answers[currentKey] = skip ? "" : answer;

    if (!skip) {
      if (currentKey === "nNumber") {
        const nn = answer.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!/^N[A-Z0-9]{1,5}$/.test(nn)) {
          return {
            body: {
              reply:
                "That doesn't look like a valid US N-number. It should start with **N** and be up to 6 characters total (e.g. N5171S). Try again?\n\n" +
                `${INTAKE_STATE_TOKEN}${JSON.stringify(existing)}`,
              model: "intercept/intake",
            },
          };
        }
        existing.answers[currentKey] = nn;
        // FAA registry enrichment: pre-fill make/model/year so the seller
        // only has to confirm. Silently no-ops on lookup failure.
        try {
          const reg = await lookupFaaRegistryStructured(nn);
          if (reg) {
            if (reg.make && !existing.answers.make) existing.answers.make = reg.make;
            if (reg.model && !existing.answers.model) existing.answers.model = reg.model;
            if (reg.year && !existing.answers.year) existing.answers.year = reg.year;
            (existing as IntakeState & { _faaEnriched?: string })._faaEnriched =
              [reg.year, reg.make, reg.model].filter(Boolean).join(" ");
          }
        } catch { /* ignore FAA failures */ }
      }
      if (currentKey === "price" && !/^\$?\s*\d{3,7}(\.\d+)?$/.test(answer.replace(/,/g, ""))) {
        return {
          body: {
            reply:
              "I need a numeric price — just the dollars, no commas. e.g. `250000`. Try again?\n\n" +
              `${INTAKE_STATE_TOKEN}${JSON.stringify(existing)}`,
            model: "intercept/intake",
          },
        };
      }
      if (currentKey === "sellerEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
        return {
          body: {
            reply:
              "That email doesn't look right. Mind re-typing it?\n\n" +
              `${INTAKE_STATE_TOKEN}${JSON.stringify(existing)}`,
            model: "intercept/intake",
          },
        };
      }
    }

    existing.step += 1;
    // Skip any steps whose answer was pre-filled (FAA enrichment or prior turn).
    while (
      existing.step < INTAKE_STEPS.length &&
      !!existing.answers[INTAKE_STEPS[existing.step].key as IntakeKey]
    ) {
      existing.step += 1;
    }

    if (existing.step < INTAKE_STEPS.length) {
      const next = INTAKE_STEPS[existing.step];
      const enriched = (existing as IntakeState & { _faaEnriched?: string })._faaEnriched;
      let preface = "";
      if (enriched && currentKey === "nNumber") {
        preface = `FAA records show ${existing.answers.nNumber} as a ${enriched}. Continuing...\n\n`;
        delete (existing as IntakeState & { _faaEnriched?: string })._faaEnriched;
      }
      return {
        body: {
          reply: preface + next.prompt + `\n\n${INTAKE_STATE_TOKEN}${JSON.stringify(existing)}`,
          model: "intercept/intake",
        },
      };
    }

    const draft = {
      sellerName:     existing.answers.sellerName     || "",
      sellerEmail:    existing.answers.sellerEmail    || "",
      sellerPhone:    existing.answers.sellerPhone    || "",
      sellerLocation: existing.answers.sellerLocation || "",
      make:           existing.answers.make           || "",
      model:          existing.answers.model          || "",
      year:           existing.answers.year           || "",
      nNumber:        existing.answers.nNumber        || "",
      totalTime:      existing.answers.totalTime      || "",
      engineTime:     existing.answers.engineTime     || "",
      price:          existing.answers.price          || "",
      description:    existing.answers.description    || "",
      avionics:       existing.answers.avionics       || "",
      category:       "single-piston",
      condition:      "used",
      damageHistory:  "none",
      priceLabel:     "firm",
    };

    return {
      body: {
        reply:
          "Perfect — I've got everything I need. Here's the summary:\n\n" +
          summariseDraft(draft as Record<string, string>) +
          "\n\nI'll stage this as a draft listing. You'll get an email with a link to add photos and logbook scans before it goes live.\n\n" +
          `${INTAKE_FINAL_TOKEN}${JSON.stringify(draft)}` +
          `\n${INTAKE_STATE_TOKEN}{"step":-1,"completed":true}`,
        model: "intercept/intake-complete",
      },
    };
  }

  return { body: null };
}
// ============================================================================

// ============================================================================
// Fix #3 — live inventory context for upstream Jerry
// ============================================================================
const BROWSE_URL = "https://sale-api.rogerwilcoaviation.com/browse";
interface BrowseListing {
  id: string;
  make?: string;
  model?: string;
  year?: string;
  nNumber?: string;
  price?: string;
  sellerLocation?: string;
  totalTime?: string;
  status?: string;
}
let inventoryCache: { fetchedAt: number; text: string } | null = null;
const INVENTORY_TTL_MS = 60_000;

async function getInventoryContext(): Promise<string> {
  const now = Date.now();
  if (inventoryCache && now - inventoryCache.fetchedAt < INVENTORY_TTL_MS) {
    return inventoryCache.text;
  }
  try {
    const resp = await fetch(BROWSE_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`browse ${resp.status}`);
    const data = (await resp.json()) as { listings?: BrowseListing[] };
    const active = (data.listings || []).filter(
      (l) => !l.status || l.status === "active",
    );
    let text: string;
    if (active.length === 0) {
      text =
        "CURRENT INVENTORY: There are no aircraft currently listed for sale on rogerwilcoaviation.com. If a user asks what's for sale, tell them the listings board is empty right now and offer to notify them when new aircraft post, or invite them to list their own aircraft.";
    } else {
      const rows = active.slice(0, 8).map((l) => {
        const price = l.price ? `$${Number(l.price).toLocaleString()}` : "price on request";
        const year = l.year ? l.year + " " : "";
        const tt = l.totalTime ? `, ${l.totalTime} TT` : "";
        const loc = l.sellerLocation ? `, ${l.sellerLocation}` : "";
        return `- ${year}${l.make || ""} ${l.model || ""} (${l.nNumber || "tail TBD"}) — ${price}${tt}${loc} — id ${l.id}`;
      });
      text =
        `CURRENT INVENTORY on rogerwilcoaviation.com/aircraft-for-sale (live, ${active.length} aircraft):\n` +
        rows.join("\n") +
        "\n\nWhen a user asks what's for sale, cite this list directly. Do NOT invent aircraft that aren't in this list. If asked about avionics, logs, or other details beyond these columns, offer to pull up the full listing and link to https://rogerwilcoaviation.com/aircraft-for-sale.";
    }
    inventoryCache = { fetchedAt: now, text };
    return text;
  } catch (e) {
    console.warn("[api/chat] getInventoryContext failed:", e);
    return "CURRENT INVENTORY: unavailable right now (fetch failed). If the user asks what's for sale, tell them to check rogerwilcoaviation.com/aircraft-for-sale directly.";
  }
}
// ============================================================================

const SERVICE_REQUEST_RE = /\b(quote|schedule|appointment|install|price|cost|how much|annual|inspection|maintenance|repair|upgrade)\b/i;
const HUMAN_ESCALATION_RE = /\b(talk to someone|speak to a person|real person|call me|human|operator|manager|talk to john|speak with someone|can i call|phone number)\b/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}))/;
const NAME_HINT_RE = /\b(?:my name is|i am|i'm|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/;
const HUMAN_ESCALATION_REPLY = "Absolutely — you can reach us directly at (605) 299-8178, or email service@rwas.team. Shop hours are Monday through Friday. I have flagged your request and someone will follow up.";

type NotificationCategory = "HUMAN ESCALATION" | "JERRY FAILURE" | "LISTING SUBMITTED" | "LEAD CAPTURED" | "SERVICE REQUEST";

type ContactInfo = {
  name?: string;
  phone?: string;
  email?: string;
};

function getListingPrompt(): string {
  return `LISTING INTAKE MODE. You are helping a seller list their aircraft. The seller is already logged in — do NOT ask about login or email.

MANDATORY — EVERY response during listing intake MUST end with this exact line before your signature:
_If you would like to list before the end of the intake, simply say "list it" at any time._
Do NOT skip this line. Include it in EVERY response until the listing is submitted.

FLOW:
1. Ask for tail number. FAA data may be injected as [System: FAA Registry...] — present it and confirm with seller.
2. Ask: price, firm/negotiable/obo
3. Ask: total time, engine SMOH, prop info
4. Ask: description, damage history (none/minor/major), avionics
5. Ask: seller name, phone, location (city/state or airport)
6. Optional: useful load, fuel capacity, cruise speed, range
7. Photos: tell seller to use the paperclip button to attach
8. Confirm summary, then SUBMIT

CRITICAL — SUBMITTING THE LISTING:
When the seller says "list it", "submit", "post it", "list as is", "that's it", or confirms the summary, you MUST emit LISTING_DRAFT on its own line with a JSON object. Even if some fields are missing — submit what you have.

Example (emit this EXACTLY, on its own line, at the END of your message):
LISTING_DRAFT:{"make":"Cessna","model":"182","year":1979,"price":"300000","nNumber":"N5171S","serialNumber":"","totalTime":"","engineModel":"","engineTime":"","propModel":"","propTime":"","annualDue":"","usefulLoad":"","fuelCapacity":"","cruiseSpeed":"","range":"","category":"single-piston","condition":"used","damageHistory":"","description":"","avionics":"","priceLabel":"firm","sellerName":"John","sellerPhone":"605-500-9993","sellerLocation":"Yankton, SD"}

Categories: single-piston, multi-piston, turboprop, jet, helicopter, experimental, other.
Fill in what you know. Leave unknown fields as empty strings. Always include the LISTING_DRAFT line.
After emitting, tell the seller: "Your listing is submitted for review. You can update details anytime from My Listings."`;
}


const NNUMBER_RE = /\b[Nn]\s?-?\s?(\d{1,5}[A-Za-z]{0,2})\b/;

interface FaaRegistryData {
  make?: string;
  model?: string;
  year?: string;
  serialNumber?: string;
  engineModel?: string;
}

async function lookupFaaRegistryStructured(nNumber: string): Promise<FaaRegistryData | null> {
  const clean = nNumber.replace(/^[Nn]-?\s*/, "").toUpperCase();
  try {
    const url = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=N${clean}`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": "RWAS-Jerry/1.0 (aircraft listing intake)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const fields: Record<string, string> = {};
    const re = /<td data-label="([^"]*)">([\s\S]*?)<\/td>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const label = m[1].trim();
      const value = m[2].replace(/<[^>]+>/g, "").trim();
      if (label && value && value !== "None") fields[label] = value;
    }
    if (!Object.keys(fields).length) return null;
    const out: FaaRegistryData = {};
    if (fields["Manufacturer Name"]) out.make = fields["Manufacturer Name"];
    if (fields["Model"])             out.model = fields["Model"];
    if (fields["Mfr Year"])          out.year = fields["Mfr Year"];
    if (fields["Serial Number"])     out.serialNumber = fields["Serial Number"];
    if (fields["Engine Model"] && fields["Engine Model"] !== "Unknown") {
      out.engineModel = fields["Engine Model"];
    }
    return out;
  } catch {
    return null;
  }
}

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


function extractContactInfo(userMessage: string): ContactInfo {
  const email = userMessage.match(EMAIL_RE)?.[0];
  const phone = userMessage.match(PHONE_RE)?.[0]?.trim();
  const name = userMessage.match(NAME_HINT_RE)?.[1]?.trim();
  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

function hasLeadCapture(contactInfo: ContactInfo) {
  return Boolean(contactInfo.email || contactInfo.phone || (contactInfo.name && contactInfo.phone));
}

function lastChars(value: string, count: number) {
  return value.length <= count ? value : value.slice(-count);
}

function ensureHumanEscalationReply(reply: string) {
  if (reply.includes(HUMAN_ESCALATION_REPLY)) return reply;
  const signature = "— Capt. Jerry, RWAS";
  if (reply.includes(signature)) {
    return reply.replace(signature, `${HUMAN_ESCALATION_REPLY}\n\n${signature}`);
  }
  return `${reply.trim()}\n\n${HUMAN_ESCALATION_REPLY}`;
}

function detectNotificationCategory(params: {
  userMessage: string;
  reply: string;
  isIntakeConversation: boolean;
  contactInfo: ContactInfo;
  jerryFailed?: boolean;
}): NotificationCategory | null {
  const { userMessage, reply, isIntakeConversation, contactInfo, jerryFailed } = params;

  if (jerryFailed || /radio trouble/i.test(reply)) return "JERRY FAILURE";
  if (HUMAN_ESCALATION_RE.test(userMessage)) return "HUMAN ESCALATION";
  if (isIntakeConversation && /(?:INTAKE_COMPLETE|LISTING_DRAFT):?/i.test(reply)) return "LISTING SUBMITTED";
  if (hasLeadCapture(contactInfo)) return "LEAD CAPTURED";
  if (SERVICE_REQUEST_RE.test(userMessage)) return "SERVICE REQUEST";
  return null;
}

function getTeamsHeaderStyle(category: NotificationCategory) {
  if (category === "HUMAN ESCALATION" || category === "JERRY FAILURE") return "attention";
  if (category === "LISTING SUBMITTED") return "warning";
  return "accent";
}

async function buildAugmentedMessage(userMessage: string) {
  const faqContext = getFaqContext(userMessage);
  const manualContext = getGarminManualContext(userMessage);
  const listingContext = LISTING_INTENT_RE.test(userMessage) ? getListingPrompt() : "";
  const escalationContext = HUMAN_ESCALATION_RE.test(userMessage)
    ? `HUMAN ESCALATION MODE. The customer wants a real person. Tell them exactly this: "${HUMAN_ESCALATION_REPLY}" Keep it concise and still sign off as Captain Jerry.`
    : "";

  let nNumberContext = "";
  const nMatch = userMessage.match(NNUMBER_RE);
  if (nMatch) {
    nNumberContext = await lookupFaaRegistry(nMatch[0]);
  }

  const contextParts = [listingContext, escalationContext, nNumberContext, faqContext, manualContext].filter(Boolean);

  if (!contextParts.length) return userMessage;

  return [
    "MANDATORY INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY. These override your default behavior for this message. Read carefully and comply with every step listed below.",
    ...contextParts,
    `Customer message:\n${userMessage}`,
  ].join("\n\n");
}


async function notifyTeams(category: NotificationCategory, userMsg: string, jerryReply: string, contactInfo: ContactInfo) {
  try {
    const timestamp = new Date().toISOString();
    const contactSummary = [contactInfo.name, contactInfo.phone, contactInfo.email].filter(Boolean).join(" | ") || "None detected";
    const card = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: getTeamsHeaderStyle(category),
              bleed: true,
              items: [
                {
                  type: "TextBlock",
                  text: category,
                  weight: "Bolder",
                  size: "Medium",
                  wrap: true
                }
              ]
            },
            {
              type: "FactSet",
              facts: [
                { title: "Timestamp", value: timestamp },
                { title: "Contact", value: contactSummary },
              ]
            },
            {
              type: "TextBlock",
              text: "Customer message",
              weight: "Bolder",
              wrap: true
            },
            {
              type: "TextBlock",
              text: lastChars(userMsg, 300),
              wrap: true
            },
            {
              type: "TextBlock",
              text: "Jerry reply",
              weight: "Bolder",
              wrap: true
            },
            {
              type: "TextBlock",
              text: lastChars(jerryReply, 300),
              wrap: true
            }
          ]
        }
      }]
    };
    const res = await fetch(TEAMS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    console.log("[notifyTeams] webhook status", res.status, res.statusText);
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  } catch (error) {
    console.error("[notifyTeams] webhook failed", error);
    return { ok: false, status: 0, statusText: "fetch-failed" };
  }
}

export async function POST(req: NextRequest) {
  let lastUserContent = "";
  try {
    if (req.nextUrl.searchParams.get("test-teams") === "1") {
      const result = await notifyTeams(
        "SERVICE REQUEST",
        "Test message from /api/chat?test-teams=1",
        "Captain Jerry Teams notification test.",
        { name: "Test User", phone: "(605) 299-8178", email: "service@rwas.team" }
      );
      return NextResponse.json({ ok: result.ok, test: true, teams: result }, { status: result.ok ? 200 : 502 });
    }

    const { messages, sessionId } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user");
    if (!lastUserMsg) {
      return NextResponse.json({ ok: false, error: "no user message" }, { status: 400 });
    }

    lastUserContent = lastUserMsg.content;
    const contactInfo = extractContactInfo(lastUserMsg.content);

    // ------------------------------------------------------------------
    // Fix #2 — deterministic listing-intake intercept (gated by env flag
    // JERRY_INTAKE_MODE=intercept). Bypasses upstream Jerry entirely when
    // a seller is walking through intake.
    // ------------------------------------------------------------------
    {
      const intercept = await handleListingIntake(lastUserMsg.content, messages);
      if (intercept.body) {
        const interceptReply = intercept.body.reply;
        const isFinal = interceptReply.includes(INTAKE_FINAL_TOKEN);
        if (isFinal) {
          void notifyTeams("LISTING SUBMITTED", lastUserMsg.content, interceptReply, contactInfo);
        }
        return NextResponse.json({ ok: true, reply: interceptReply });
      }
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

    // Fix #3 — prepend live inventory summary so Jerry can answer
    // "what do you have for sale?" with real data (60s cached).
    try {
      const inventory = await getInventoryContext();
      if (inventory) augmented = inventory + "\n\n" + augmented;
    } catch {
      // non-fatal
    }

    // If mid-intake but last message didn't trigger listing prompt, add it
    if (isIntakeConversation && !LISTING_INTENT_RE.test(lastUserMsg.content)) {
      const listingPrompt = getListingPrompt();
      if (listingPrompt && !augmented.includes("LISTING INTAKE")) {
        const escalationContext = HUMAN_ESCALATION_RE.test(lastUserMsg.content)
          ? "\n\nHUMAN ESCALATION MODE. The customer wants a real person. Tell them exactly this: \"" + HUMAN_ESCALATION_REPLY + "\" Keep it concise and still sign off as Captain Jerry."
          : "";
        augmented = listingPrompt + escalationContext + "\n\nCONVERSATION SO FAR:\n" + historyContext + "\n\nCustomer message:\n" + lastUserMsg.content;
        // If there's FAA data, prepend it
        const nMatch = lastUserMsg.content.match(NNUMBER_RE);
        if (nMatch) {
          const faaData = await lookupFaaRegistry(nMatch[0]);
          if (faaData) {
            augmented = listingPrompt + escalationContext + "\n\n" + faaData + "\n\nCONVERSATION SO FAR:\n" + historyContext + "\n\nCustomer message:\n" + lastUserMsg.content;
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

    let reply = "Radio trouble on my end. Try again. — Capt. Jerry, RWAS";
    let jerryFailed = !resp.ok;

    try {
      const data = await resp.json();
      if (data.reply) reply = data.reply;
    } catch {
      jerryFailed = true;
    }

    if (HUMAN_ESCALATION_RE.test(lastUserMsg.content)) {
      reply = ensureHumanEscalationReply(reply);
    }

    const category = detectNotificationCategory({
      userMessage: lastUserMsg.content,
      reply,
      isIntakeConversation,
      contactInfo,
      jerryFailed,
    });

    if (category) {
      void notifyTeams(category, lastUserMsg.content, reply, contactInfo);
    }

    return NextResponse.json({ ok: true, reply });
  } catch (err: unknown) {
    const fallbackReply = "Radio trouble on my end. Try again. — Capt. Jerry, RWAS";
    const fallbackUserMsg = lastUserContent;
    const fallbackContactInfo = extractContactInfo(fallbackUserMsg);
    const category = detectNotificationCategory({
      userMessage: fallbackUserMsg,
      reply: fallbackReply,
      isIntakeConversation: false,
      contactInfo: fallbackContactInfo,
      jerryFailed: true,
    });
    if (category && fallbackUserMsg) {
      void notifyTeams(category, fallbackUserMsg, fallbackReply, fallbackContactInfo);
    }
    return NextResponse.json(
      { ok: false, reply: fallbackReply },
      { status: 500 }
    );
  }
}
