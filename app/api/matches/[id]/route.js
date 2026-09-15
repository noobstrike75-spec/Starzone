import { getMatchDetail } from "../../../../../lib/football-data";

export async function GET(request, { params }) {
  try {
    const matchId = params.id;

    if (!matchId) {
      return Response.json(
        {
          success: false,
          service: "StarZone API",
          endpoint: "/api/matches/[id]",
          error: "Match ID is required",
        },
        { status: 400 }
      );
    }

    const match = await getMatchDetail(matchId);

    return Response.json({
      success: true,
      service: "StarZone API",
      endpoint: `/api/matches/${matchId}`,
      match,
    });
  } catch (error) {
    console.error("StarZone match API error:", error);

    return Response.json(
      {
        success: false,
        service: "StarZone API",
        endpoint: "/api/matches/[id]",
        error: error.message || "Unable to load match",
      },
      { status: 500 }
    );
  }
}
