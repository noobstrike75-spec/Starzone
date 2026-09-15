import { getMatchesByDateRange } from "../../../../lib/football-data";

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const matches = await getMatchesByDateRange(today, today);

    return Response.json({
      success: true,
      service: "StarZone API",
      endpoint: "/api/matches/today",
      date: today,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error("StarZone matches API error:", error);

    return Response.json(
      {
        success: false,
        service: "StarZone API",
        endpoint: "/api/matches/today",
        error: error.message || "Unable to load today's matches",
      },
      { status: 500 }
    );
  }
}
