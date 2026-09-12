// football-data.org v4 wrapper.
// Keep the API key on the server: FOOTBALL_DATA_KEY in Vercel Environment Variables.

const BASE_URL = "https://api.football-data.org/v4";

async function fdFetch(path, revalidate = 300) {
  const token = process.env.FOOTBALL_DATA_KEY;
  if (!token) throw new Error("FOOTBALL_DATA_KEY is not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    next: { revalidate },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org request failed: ${res.status}${body ? ` — ${body}` : ""}`);
  }

  return res.json();
}

export async function getMatchesByDate(dateStr) {
  const data = await fdFetch(`/matches?dateFrom=${dateStr}&dateTo=${dateStr}`, 120);
  return data.matches ?? [];
}

export async function getStandings(competitionCode) {
  const data = await fdFetch(`/competitions/${competitionCode}/standings`, 600);
  const totalTable = data.standings?.find((s) => s.type === "TOTAL");
  return {
    competitionName: data.competition?.name ?? competitionCode,
    table: totalTable?.table ?? [],
  };
}

export async function getTeamInfo(teamId) {
  return fdFetch(`/teams/${teamId}`, 600);
}

export async function getTeamRecentMatches(teamId, limit = 10) {
  const data = await fdFetch(
    `/teams/${teamId}/matches?status=FINISHED&limit=${Math.min(limit, 100)}`,
    300
  );
  return data.matches ?? [];
}

export async function getMatchDetail(matchId) {
  return fdFetch(`/matches/${matchId}`, 300);
}

// One request gives us the whole competition's current-season match pool.
// The prediction engine derives each team's recent home/away form from it,
// avoiding dozens of API calls for a 20+ match prediction page.
export async function getCompetitionMatches(competitionCode, dateFrom, dateTo) {
  const qs = new URLSearchParams({
    dateFrom,
    dateTo,
    status: "FINISHED",
  });
  const data = await fdFetch(`/competitions/${competitionCode}/matches?${qs}`, 900);
  return data.matches ?? [];
}
