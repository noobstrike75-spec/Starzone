import Link from "next/link";
import { getMatchDetail } from "../../../lib/football-data";
import { predictMatch } from "../../../lib/predictions";

export default async function MatchPage({ params }) {
  const matchId = params.id;

  let detail = null;
  let error = null;

  try {
    detail = await getMatchDetail(matchId);
  } catch (e) {
    error = e.message;
  }

  let pred = null;
  let h2h = null;

  if (detail) {
    h2h = detail.head2head;
    const homeWins = h2h?.homeTeam?.wins ?? 0;
    const awayWins = h2h?.awayTeam?.wins ?? 0;
    const draws = h2h?.homeTeam?.draws ?? 0;
    const totalGames = h2h?.numberOfMatches || 1;
    const totalGoals = h2h?.totalGoals ?? totalGames * 2.5;
    const avgGoalsPerGame = totalGoals / totalGames / 2;

    pred = predictMatch({
      homeAvgScored: 1.2 + (homeWins / totalGames) * 0.6,
      homeAvgConceded: 1.1,
      awayAvgScored: 1.0 + (awayWins / totalGames) * 0.6,
      awayAvgConceded: 1.2,
    });
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>
          {detail ? `${detail.homeTeam.name} vs ${detail.awayTeam.name}` : "Match Preview"}
        </span>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
        {error && <p style={{ color: "crimson" }}>Couldn't load match data. ({error})</p>}

        {pred && (
          <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.9rem", color: "#111" }}>Prediction</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#2e7d32" }}>{pred.homeWinProbability}%</div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>{detail.homeTeam.name} Win</div>
              </div>
              <div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f5a623" }}>{pred.drawProbability}%</div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>Draw</div>
              </div>
              <div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#c0392b" }}>{pred.awayWinProbability}%</div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>{detail.awayTeam.name} Win</div>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#333", margin: "0 0 0.3rem" }}>
              <strong>Predicted score:</strong> {pred.mostLikelyScore}
            </p>
            <p style={{ fontSize: "0.85rem", color: "#333", margin: 0 }}>
              <strong>Expected goals:</strong> {pred.homeExpectedGoals} - {pred.awayExpectedGoals}
            </p>
          </div>
        )}

        {h2h && (
          <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem" }}>
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "#111" }}>Head-to-Head</h2>
            <p style={{ fontSize: "0.85rem", color: "#333", margin: "0 0 0.4rem" }}>
              Last {h2h.numberOfMatches} meetings — {h2h.homeTeam?.wins ?? 0} wins for {detail.homeTeam.name},{" "}
              {h2h.awayTeam?.wins ?? 0} wins for {detail.awayTeam.name}, {h2h.homeTeam?.draws ?? 0} draws.
            </p>
            <p style={{ fontSize: "0.85rem", color: "#333", margin: 0 }}>
              Total goals across those meetings: {h2h.totalGoals ?? "—"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
