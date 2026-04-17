// /api/chat is handled by the intake-bridge Cloudflare Worker, not this file.
//
// Zone route (see ~/projects/intake-bridge/wrangler.toml):
//   pattern = "rogerwilcoaviation.com/api/chat"
//   zone_name = "rogerwilcoaviation.com"
//
// The Worker owns: FAQ fast-path, listing-intake state machine, FAA registry
// enrichment, live inventory enrichment from sale-api.rogerwilcoaviation.com,
// Jerry relay, WhatsApp notifications, SSE streaming.
//
// This file exists only so Next.js doesn't complain about a missing route and
// so anyone looking here lands on the right destination instead of editing
// dead code. Worker Routes at the zone level take priority over Pages, so
// this stub never actually serves traffic in production.
//
// DO NOT add logic here. Edit ~/projects/intake-bridge/worker.js instead,
// then: cd ~/projects/intake-bridge && wrangler deploy.

import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "This endpoint is served by the intake-bridge Cloudflare Worker. This Pages route is a placeholder and should not be reachable in production.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
