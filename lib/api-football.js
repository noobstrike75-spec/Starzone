// Thin wrapper around the API-Football free tier.
// Swap this file's internals later if you change data providers —
// every page just imports getFixtures / getStandings from here.

const BASE_URL = "https://v3.football.api-sports.io";

async function apiFootballFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": process.env.API_FOOTBALL_KEY,
    },
    // Cache for 60s so we don't burn free-tier request limits
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

export async function getFixturesByDate(date) {
  // date format: YYYY-MM-DD
  return apiFootballFetch(`/fixtures?date=${date}`);
}

export async function getStandings(leagueId, season) {
  return apiFootballFetch(`/standings?league=${leagueId}&season=${season}`);
}

export async function getHeadToHead(team1Id, team2Id) {
  return apiFootballFetch(`/fixtures/headtohead?h2h=${team1Id}-${team2Id}`);
}
