import Link from "next/link";
import { getMatchDetail, getFinishedMatchesByDateRange } from "../../../lib/football-data";
import { predictMatch } from "../../../lib/predictions";

function addDays(date, amount) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

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
    try {
      const code = detail.competition?.code;
      if (code) {
        const history = await getFinishedMatchesByDateRange(addDays(detail.utcDate, -365), addDays(detail.utcDate, -1), 500);
        const competitionHistory = history.filter((m) => m.competition?.code === code && new Date(m.utcDate) < new Date(detail.utcDate));
        pred = predictMatch({ homeTeam: detail.homeTeam, awayTeam: detail.awayTeam, historicalMatches: competitionHistory });
      }
    } catch (e) {
      error = error || e.message;
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>{detail ? `${detail.homeTeam.name} vs ${detail.awayTeam.name}` : "Match Preview"}</span>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
        {error && <p style={{ color: "crimson" }}>Some prediction data could not be loaded. ({error})</p>}

        {pred && (
          <>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", margin: "0 0 0.9rem", color: "#111" }}>Mathematical Prediction</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center", marginBottom: "1rem" }}>
                <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{pred.homeWinProbability}%</div><div style={{ fontSize: "0.7rem", color: "#888" }}>{detail.homeTeam.name} Win</div></div>
                <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{pred.drawProbability}%</div><div style={{ fontSize: "0.7rem", color: "#888" }}>Draw</div></div>
                <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{pred.awayWinProbability}%</div><div style={{ fontSize: "0.7rem", color: "#888" }}>{detail.awayTeam.name} Win</div></div>
              </div>
              <p style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}><strong>Prediction:</strong> {pred.pick}</p>
              <p style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}><strong>Most likely score:</strong> {pred.mostLikelyScore}</p>
              <p style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}><strong>Expected goals:</strong> {pred.homeExpectedGoals} - {pred.awayExpectedGoals}</p>
              <p style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}><strong>Over 2.5:</strong> {pred.over25}% · <strong>BTTS:</strong> {pred.bttsYes}%</p>
              <p style={{ fontSize: "0.85rem", margin: 0 }}><strong>Confidence:</strong> {pred.confidence}% · <strong>Data:</strong> {pred.dataMatchesHome} home / {pred.dataMatchesAway} away matches</p>
            </div>
          </>
        )}

        {h2h && (
          <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem" }}>
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "#111" }}>Head-to-Head</h2>
            <p style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>Last {h2h.numberOfMatches ?? 0} meetings — {h2h.homeTeam?.wins ?? 0} wins for {detail.homeTeam.name}, {h2h.awayTeam?.wins ?? 0} wins for {detail.awayTeam.name}, {h2h.homeTeam?.draws ?? 0} draws.</p>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Total goals: {h2h.totalGoals ?? "—"}</p>
          </div>
        )}
      </main>
    </div>
  );
}
