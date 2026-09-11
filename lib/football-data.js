// Wrapper around football-data.org (v4) — free tier gives genuine
// current-season data for 12 major competitions, unlike some
// free-tier alternatives that restrict you to old seasons.

const BASE_URL = "https://api.football-data.org/v4";

async function fdFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-Auth-Token": process.env.FOOTBALL_DATA_KEY,
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`football-data.org request failed: ${res.status}`);
  }

  return res.json();
}

export async function getMatchesByDate(dateStr) {
  const data = await fdFetch(`/matches?dateFrom=${dateStr}&dateTo=${dateStr}`);
  return data.matches ?? [];
}

export async function getStandings(competitionCode) {
  const data = await fdFetch(`/competitions/${competitionCode}/standings`);
  const totalTable = data.standings?.find((s) => s.type === "TOTAL");
  return {
    competitionName: data.competition?.name ?? competitionCode,
    table: totalTable?.table ?? [],
  };
}

export async function getTeamInfo(teamId) {
  return fdFetch(`/teams/${teamId}`);
}

export async function getTeamRecentMatches(teamId, limit = 5) {
  const data = await fdFetch(`/teams/${teamId}/matches?status=FINISHED&limit=${limit}`);
  return data.matches ?? [];
}

export async function getMatchDetail(matchId) {
  return fdFetch(`/matches/${matchId}`);
}
