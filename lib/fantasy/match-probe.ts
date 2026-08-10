const API_BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/";

type ProbeResult = {
  path: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  bodyPreview: string;
  rowCount: number | null;
  firstKeys: string[];
};

async function probePath(path: string): Promise<ProbeResult> {
  const url = `${API_BASE}${path}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "StangInn/1.0 hockeylive-match-probe" },
    });
    const text = await response.text();
    let rowCount: number | null = null;
    let firstKeys: string[] = [];
    try {
      const payload = JSON.parse(text);
      const rows = Array.isArray(payload)
        ? payload
        : payload?.data ?? payload?.players ?? payload?.goalies ?? payload?.goals ?? payload?.penalties ?? payload?.rows ?? null;
      if (Array.isArray(rows)) {
        rowCount = rows.length;
        if (rows[0] && typeof rows[0] === "object") firstKeys = Object.keys(rows[0]).slice(0, 35);
      } else if (payload && typeof payload === "object") {
        firstKeys = Object.keys(payload).slice(0, 35);
      }
    } catch {
      // not JSON; body preview below is enough for diagnosis
    }
    return {
      path,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 350),
      rowCount,
      firstKeys,
    };
  } catch (error: any) {
    return {
      path,
      status: 0,
      ok: false,
      contentType: null,
      bodyPreview: error?.message || "Network error",
      rowCount: null,
      firstKeys: [],
    };
  }
}

export async function probeHockeyLiveMatch(matchId: string) {
  const id = encodeURIComponent(matchId);
  const paths = [
    `icehockey/Match/Players/${id}`,
    `icehockey/Match/GoalieLeaders/${id}`,
    `icehockey/Match/Goals/${id}`,
    `icehockey/Match/Penalties/${id}`,
    `ta/MatchTeamMembers/${id}`,
    `api/v1/icehockey/Match/Players/${id}`,
    `api/v1/icehockey/Match/GoalieLeaders/${id}`,
    `api/v1/icehockey/Match/Goals/${id}`,
    `api/v1/icehockey/Match/Penalties/${id}`,
  ];
  const results: ProbeResult[] = [];
  for (const path of paths) results.push(await probePath(path));
  return { matchId, apiBase: API_BASE, results };
}
