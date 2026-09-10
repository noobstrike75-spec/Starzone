import { getFixturesByDate } from "../lib/api-football";
import { predictMatch } from "../lib/predictions";

// Placeholder average goals until we wire real per-team form data.
// (League-average-ish numbers so the math isn't nonsense.)
const DEFAULT_HOME_SCORED = 1.4;
const DEFAULT_HOME_CONCEDED = 1.1;
const DEFAULT_AWAY_SCORED = 1.1;
const DEFAULT_AWAY_CONCEDED = 1.3;

function getPrediction() {
  return predictMatch({
    homeAvgScored: DEFAULT_HOME_SCORED,
    homeAvgConceded: DEFAULT_HOME_CONCEDED,
    awayAvgScored: DEFAULT_AWAY_SCORED,
    awayAvgConceded: DEFAULT_AWAY_CONCEDED,
  });
}

function formatDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function HomePage() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let fixtures = [];
  let error = null;

  try {
    fixtures = await getFixturesByDate(todayStr);
  } catch (e) {
    error = e.message;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.5px" }}>
          STAR<span style={{ color: "#e2231a" }}>ZONE</span>
        </span>
        <span style={{ color: "#ccc", fontSize: "1.2rem" }}>🔍</span>
      </header>

      {/* Sport tabs */}
      <nav style={{ background: "#222", display: "flex", gap: "1.2rem", padding: "0.6rem 1rem", overflowX: "auto" }}>
        <span style={{ color: "#fff", fontWeight: 700, borderBottom: "2px solid #e2231a", paddingBottom: "0.2rem" }}>⚽ Football</span>
        <span style={{ color: "#888" }}>🏀 Basketball</span>
        <span style={{ color: "#888" }}>🎾 Tennis</span>
        <span style={{ color: "#888" }}>🏒 Hockey</span>
      </nav>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 4rem" }}>
        <h1 style={{ textAlign: "center", fontSize: "1.1rem", padding: "1rem 1rem 0.5rem", color: "#222" }}>
          Mathematical Football Predictions and Statistics
        </h1>

        {/* Date tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", padding: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ background: "#111", color: "#fff", borderRadius: "16px", padding: "0.4rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}>
            Today · {formatDate(today)}
          </span>
        </div>

        {error && (
          <p style={{ color: "crimson", padding: "0 1rem" }}>
            Couldn't load fixtures — add your API_FOOTBALL_KEY in .env.local. ({error})
          </p>
        )}
        {!error && fixtures.length === 0 && (
          <p style={{ textAlign: "center", color: "#666" }}>No fixtures found for today.</p>
        )}

        {/* Table header */}
        {fixtures.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 0.9fr", padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: "#555", borderBottom: "2px solid #ddd" }}>
            <span>Home / Away</span>
            <span style={{ textAlign: "center" }}>1&nbsp;&nbsp;X&nbsp;&nbsp;2</span>
            <span style={{ textAlign: "center" }}>Coef.</span>
            <span style={{ textAlign: "center" }}>Score</span>
          </div>
        )}

        {/* Match rows */}
        {fixtures.map((f) => {
          const pred = getPrediction();
          const bestOdd = Math.max(pred.homeWinProbability, pred.drawProbability, pred.awayWinProbability);
          const coef = (100 / bestOdd).toFixed(2);

          return (
            <div
              key={f.fixture.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.4fr 1fr 0.9fr",
                alignItems: "center",
                padding: "0.6rem 0.75rem",
                background: "#fff",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c0392b", lineHeight: 1.4 }}>
                <div>{f.teams.home.name}</div>
                <div>{f.teams.away.name}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>{pred.homeWinProbability}</span>
                <span>{pred.drawProbability}</span>
                <span>{pred.awayWinProbability}</span>
              </div>

              <div style={{ textAlign: "center" }}>
                <span style={{ background: "#f5a623", color: "#fff", borderRadius: "50%", width: "22px", height: "22px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>
                  {pred.homeWinProbability > pred.awayWinProbability ? "1" : pred.awayWinProbability > pred.homeWinProbability ? "2" : "X"}
                </span>
                <div style={{ fontSize: "0.7rem", color: "#333", marginTop: "0.2rem" }}>{coef}</div>
              </div>

              <div style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 600 }}>
                {f.goals.home ?? pred.mostLikelyScore.split("-")[0]} - {f.goals.away ?? pred.mostLikelyScore.split("-")[1]}
              </div>
            </div>
          );
        })}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#fff", borderTop: "1px solid #ddd",
        display: "flex", justifyContent: "space-around", padding: "0.5rem 0",
      }}>
        {[
          { label: "Home", icon: "🏠" },
          { label: "Predictions", icon: "📊" },
          { label: "Leagues", icon: "🛡️" },
          { label: "Favs", icon: "⭐" },
          { label: "More", icon: "☰" },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: "center", fontSize: "0.65rem", color: item.label === "Home" ? "#e2231a" : "#666" }}>
            <div style={{ fontSize: "1.1rem" }}>{item.icon}</div>
            {item.label}
          </div>
        ))}
      </nav>
    </div>
  );
        }
