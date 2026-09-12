// football-data.org v4 wrapper.
// Keep the API key on the server: FOOTBALL_DATA_KEY in Vercel Environment Variables.
//
// v3 rate-limit strategy:
// - Prefer broad date-range requests over many team/competition requests.
// - Let Next.js cache API responses so repeated page views do not hit the provider.
// - Never retry a 429 automatically (retries can make a rate-limit problem worse).

const BASE_URL = "https://api.football-data.org/v4";

async function fdFetch(path, revalidate = 900) {
  const token = process.env.FOOTBALL_DATA_KEY;
  if (!token) throw new Error("FOOTBALL_DATA_KEY is not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    next: { revalidate },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new Error("football-data.org rate limit reached. Please wait a moment and try again.");
    }
    throw new Error(`football-data.org request failed: ${res.status}${body ? ` — ${body.slice(0, 180)}` : ""}`);
  }

  return res.json();
}

function rangeQuery(dateFrom, dateTo, status) {
  const qs = new URLSearchParams({ dateFrom, dateTo });
  if (status) qs.set("status", status);
  return qs.toString();
}

export async function getMatchesByDate(dateStr) {
  const data = await fdFetch(`/matches?${rangeQuery(dateStr, dateStr)}`, 300);
  return data.matches ?? [];
}

// One request can cover several upcoming days. This is intentionally used by
// the homepage instead of making one API request per day.
export async function getMatchesByDateRange(dateFrom, dateTo) {
  const data = await fdFetch(`/matches?${rangeQuery(dateFrom, dateTo)}`, 300);
  return data.matches ?? [];
}

// One request supplies a historical pool across all competitions. The caller
// groups it by competition code locally, avoiding 10–20 separate API calls.
export async function getFinishedMatchesByDateRange(dateFrom, dateTo, limit = 500) {
  const qs = new URLSearchParams({
    dateFrom,
    dateTo,
    status: "FINISHED",
    limit: String(Math.min(Math.max(limit, 1), 500)),
  });
  const data = await fdFetch(`/matches?${qs.toString()}`, 1800);
  return data.matches ?? [];
}

export async function getStandings(competitionCode) {
  const data = await fdFetch(`/competitions/${competitionCode}/standings`, 1800);
  const totalTable = data.standings?.find((s) => s.type === "TOTAL");
  return {
    competitionName: data.competition?.name ?? competitionCode,
    table: totalTable?.table ?? [],
  };
}

export async function getTeamInfo(teamId) {
  return fdFetch(`/teams/${teamId}`, 1800);
}

export async function getTeamRecentMatches(teamId, limit = 10) {
  const data = await fdFetch(
    `/teams/${teamId}/matches?status=FINISHED&limit=${Math.min(limit, 100)}`,
    900
  );
  return data.matches ?? [];
}

export async function getMatchDetail(matchId) {
  return fdFetch(`/matches/${matchId}`, 900);
}

// Kept for the individual match page and any existing routes that use it.
// The homepage no longer calls this once per competition.
export async function getCompetitionMatches(competitionCode, dateFrom, dateTo) {
  const qs = new URLSearchParams({
    dateFrom,
    dateTo,
    status: "FINISHED",
  });
  const data = await fdFetch(`/competitions/${competitionCode}/matches?${qs.toString()}`, 1800);
  return data.matches ?? [];
}
