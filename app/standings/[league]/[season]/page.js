import Link from "next/link";
import { getHeadToHead } from "../../../lib/api-football";
import { predictMatch } from "../../../lib/predictions";

export default async function MatchPage({ params, searchParams }) {
  const { homeId, awayId, homeName, awayName } = searchParams;

  let h2h = [];
  let error = null;

  try {
    if (homeId && awayId) {
      h2h = await getHeadToHead(homeId, awayId);
    }
  } catch (e) {
    error = e.message;
  }

  // Estimate form from H2H goals as a stand-in until full per-team
  // season form is wired in — better than a flat default, still rough.
  let homeAvgScored = 1.4, homeAvgConceded = 1.1;
  let awayAvgScored = 1.1, awayAvgConceded = 1.3;

  if (h2h.length > 0) {
    let hFor = 0, hAgainst = 0, aFor = 0, aAgainst = 0, count = 0;
    h2h.forEach((m) => {
      const isHomeTeamHome = String(m.teams.home.id) === String(homeId);
      const homeGoals = m.goals.home ?? 0;
      const awayGoals = m.goals.away ?? 0;
      if (isHomeTeamHome) {
        hFor += homeGoals; hAgainst += awayGoals;
        aFor += awayGoals; aAgainst += homeGoals;
      } else {
        hFor += awayGoals; hAgainst += homeGoals;
        aFor += homeGoals; aAgainst += awayGoals;
      }
      count++;
    });
    if (count > 0) {
      homeAvgScored = hFor / count; homeAvgConceded = hAgainst / count;
      awayAvgScored = aFor / count; awayAvgConceded = aAgainst / count;
    }
  }

  const pred = predictMatch({ homeAvgScored, homeAvgConceded, awayAvgScored, awayAvgConceded });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>
          {homeName} vs {awayName}
        </span>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
        {/* Prediction breakdown */}
        <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 0.9rem", color: "#111" }}>Prediction</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#2e7d32" }}>{pred.homeWinProbability}%</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>{homeName} Win</div>
            </div>
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f5a623" }}>{pred.drawProbability}%</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>Draw</div>
            </div>
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#c0392b" }}>{pred.awayWinProbability}%</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>{awayName} Win</div>
            </div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#333", margin: "0 0 0.3rem" }}>
            <strong>Predicted score:</strong> {pred.mostLikelyScore}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#333", margin: 0 }}>
            <strong>Expected goals:</strong> {pred.homeExpectedGoals} - {pred.awayExpectedGoals}
          </p>
        </div>

        {/* Head to head */}
        <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "#111" }}>Head-to-Head</h2>

          {error && <p style={{ color: "crimson", fontSize: "0.85rem" }}>Couldn't load H2H data. ({error})</p>}
          {!error && h2h.length === 0 && (
            <p style={{ fontSize: "0.85rem", color: "#888" }}>No previous meetings found.</p>
          )}

          {h2h.slice(0, 8).map((m) => (
            <div
              key={m.fixture.id}
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "0.5rem 0", borderBottom: "1px solid #eee", fontSize: "0.8rem",
              }}
            >
              <span>{m.teams.home.name} vs {m.teams.away.name}</span>
              <span style={{ fontWeight: 600 }}>{m.goals.home ?? "-"} : {m.goals.away ?? "-"}</span>
            </div>
          ))}

          <p style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "0.8rem" }}>
            Prediction above is estimated from head-to-head goal averages — not yet full season form.
          </p>
        </div>
      </main>
    </div>
  );
}
