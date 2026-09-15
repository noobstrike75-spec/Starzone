import { getMatchesByDateRange } from "../../../../lib/football-data";

export async function GET() {
  try {
    const start = new Date();
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + 6);

    const dateFrom = start.toISOString().slice(0, 10);
    const dateTo = end.toISOString().slice(0, 10);

    const matches = await getMatchesByDateRange(dateFrom, dateTo);

    const upcoming = matches.filter((match) =>
      ["SCHEDULED", "TIMED"].includes(match.status)
    );

    return Response.json({
      success: true,
      service: "StarZone API",
      endpoint: "/api/matches/upcoming",
      dateFrom,
      dateTo,
      count: upcoming.length,
      matches: upcoming,
    });
  } catch (error) {
    console.error("StarZone upcoming matches API error:", error);

    return Response.json(
      {
        success: false,
        service: "StarZone API",
        endpoint: "/api/matches/upcoming",
        error: error.message || "Unable to load upcoming matches",
      },
      { status: 500 }
    );
  }
}
