import { NextRequest, NextResponse } from "next/server";
import { syncMatches } from "../../../lib/sync-service";
import type { ProviderName } from "../../../lib/providers";
import type { ImportedMatch } from "../../../types/data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: ProviderName; matches?: ImportedMatch[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const providerName: ProviderName =
    body.provider === "manual" ? "manual" :
    body.provider === "hockeylive" ? "hockeylive" :
    "nif";

  const result = await syncMatches(providerName, body.matches || []);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
