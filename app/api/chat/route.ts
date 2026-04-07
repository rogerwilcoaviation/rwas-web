import { NextRequest, NextResponse } from "next/server";

const JERRY_RELAY = "https://jerry-api.rwas.team";
const JERRY_TOKEN = "7786abd8bfa306d7cce405117bd39349586afc8cc7be62d59f1d70a422a228d8";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
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
        message: lastUserMsg.content,
        sessionKey: "web-chat",
        timeout: 30000,
      }),
    });

    const data = await resp.json();
    const reply = data.reply || "Radio trouble on my end. Try again. — Capt. Jerry, RWAS";

    return NextResponse.json({ ok: true, reply });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, reply: "Radio trouble on my end. Try again. — Capt. Jerry, RWAS" },
      { status: 500 }
    );
  }
}
