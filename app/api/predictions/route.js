import {
  getMatchesByDateRange,
  getFinishedMatchesByDateRange,
} from "../../../lib/football-data";

import { buildPredictions } from "../../../lib/predictions";

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return toDateString(d);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedDate =
      searchParams.get("date") || toDateString(new Date());

    const days = Math.min(
      Math.max(Number(searchParams.get("days") || 1), 1),
      7
    );

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      50
    );

    const upcomingTo = addDays(requestedDate, days - 1);

    // Get upcoming fixtures.
    const matches = await getMatchesByDateRange(
      requestedDate,
      upcomingTo
    );

    const predictionMatches = matches
      .filter((match) =>
        ["SCHEDULED", "TIMED"].includes(match.status)
      )
      .sort(
        (a, b) =>
          new Date(a.utcDate) - new Date(b.utcDate)
      )
      .slice(0, limit);

    if (!predictionMatches.length) {
      return Response.json({
        success: true,
        service: "StarZone API",
        endpoint: "/api/predictions",
        dateFrom: requestedDate,
        dateTo: upcomingTo,
        count: 0,
        predictions: [],
      });
    }

    // Build a 60-day historical pool.
    const historyFrom = addDays(requestedDate, -60);
    const historyTo = addDays(requestedDate, -1);

    const history = await getFinishedMatchesByDateRange(
      historyFrom,
      historyTo,
      500
    );

    // Group historical matches by competition.
    const historyByCompetition = new Map();

    for (const match of history) {
      const code = match.competition?.code;

      if (!code) continue;

      if (!historyByCompetition.has(code)) {
        historyByCompetition.set(code, []);
      }

      historyByCompetition.get(code).push(match);
    }

    // Run the StarZone v6 prediction engine.
    const predictions = buildPredictions(
      predictionMatches,
      historyByCompetition
    );

    return Response.json({
      success: true,
      service: "StarZone API",
      endpoint: "/api/predictions",
      model: "StarZone v6",
      dateFrom: requestedDate,
      dateTo: upcomingTo,
      count: predictions.length,

      predictions: predictions.map(
        ({ match, prediction }) => ({
          match: {
            id: match.id,
            utcDate: match.utcDate,
            status: match.status,

            competition: match.competition
              ? {
                  id: match.competition.id,
                  name: match.competition.name,
                  code: match.competition.code,
                }
              : null,

            homeTeam: {
              id: match.homeTeam?.id,
              name: match.homeTeam?.name,
              crest: match.homeTeam?.crest || null,
            },

            awayTeam: {
              id: match.awayTeam?.id,
              name: match.awayTeam?.name,
              crest: match.awayTeam?.crest || null,
            },
          },

          prediction,
        })
      ),
    });
  } catch (error) {
    console.error(
      "StarZone predictions API error:",
      error
    );

    return Response.json(
      {
        success: false,
        service: "StarZone API",
        endpoint: "/api/predictions",
        error:
          error.message ||
          "Unable to generate predictions",
      },
      { status: 500 }
    );
  }
}
