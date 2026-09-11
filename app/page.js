import Link from "next/link";
import { getFixturesByDate } from "../lib/api-football";
import { predictMatch } from "../lib/predictions";

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

function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

function formatShort(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export default async function HomePage({ searchParams }) {
  const today = new Date();
  const selectedDateStr = searchParams.date || toDateStr(today);

  // Build a row of date tabs: yesterday, today, next 3 days
  const dateTabs = [];
  for (let offset = -1; offset <= 3; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    dateTabs.push({ dateStr: toDateStr(d), label: offset === 0 ? "Today" : formatShort(d) });
  }

  let fixtures = [];
  let error = null;

  try {
    fixtures = await getFixturesByDate(selectedDateStr);
  } catch (e) {
    error = e.message;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.5px" }}>
          STAR<span style={{ color: "#e2231a" }}>ZONE</span>
        </span>
        <span style={{ color: "#ccc", fontSize: "1.2rem" }}>🔍</span>
      </header>

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

        {/* Working date tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", flexWrap: "wrap" }}>
          {dateTabs.map((tab) => (
            <Link
              key={tab.dateStr}
              href={`/?date=${tab.dateStr}`}
              style={{
                background: tab.dateStr === selectedDateStr ? "#e2231a" : "#111",
                color: "#fff",
                borderRadius: "16px",
                padding: "0.4rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {error && (
          <p style={{ color: "crimson", padding: "0 1rem" }}>
            Couldn't load fixtures — add your API_FOOTBALL_KEY in .env.local. ({error})
          </p>
        )}
        {!error && fixtures.length === 0 && (
          <p style={{ textAlign: "center", color: "#666" }}>No fixtures found for this date.</p>
        )}

        {fixtures.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr", padding: "0.5rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#555", borderBottom: "2px solid #ddd" }}>
            <span>Home / Away</span>
            <span style={{ textAlign: "center" }}>1&nbsp;&nbsp;X&nbsp;&nbsp;2</span>
            <span style={{ textAlign: "center" }}>Coef.</span>
            <span style={{ textAlign: "center" }}>Score</span>
            <span style={{ textAlign: "center" }}></span>
          </div>
        )}

        {fixtures.map((f) => {
          const pred = getPrediction();
          const bestOdd = Math.max(pred.homeWinProbability, pred.drawProbability, pred.awayWinProbability);
          const coef = (100 / bestOdd).toFixed(2);
          const matchHref = `/match/${f.fixture.id}?homeId=${f.teams.home.id}&awayId=${f.teams.away.id}&homeName=${encodeURIComponent(f.teams.home.name)}&awayName=${encodeURIComponent(f.teams.away.name)}`;

          return (
            <div
              key={f.fixture.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr",
                alignItems: "center",
                padding: "0.6rem 0.75rem",
                background: "#fff",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c0392b", lineHeight: 1.4 }}>
                <div>
                  <Link href={`/team/${f.teams.home.id}?league=${f.league.id}&season=${f.league.season}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {f.teams.home.name}
                  </Link>
                </div>
                <div>
                  <Link href={`/team/${f.teams.away.id}?league=${f.league.id}&season=${f.league.season}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {f.teams.away.name}
                  </Link>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", fontSize: "0.78rem", fontWeight: 600 }}>
                <span>{pred.homeWinProbability}</span>
                <span>{pred.drawProbability}</span>
                <span>{pred.awayWinProbability}</span>
              </div>

              <div style={{ textAlign: "center" }}>
                <span style={{ background: "#f5a623", color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>
                  {pred.homeWinProbability > pred.awayWinProbability ? "1" : pred.awayWinProbability > pred.homeWinProbability ? "2" : "X"}
                </span>
                <div style={{ fontSize: "0.65rem", color: "#333", marginTop: "0.2rem" }}>{coef}</div>
              </div>

              <div style={{ textAlign: "center", fontSize: "0.78rem", fontWeight: 600 }}>
                {f.goals.home ?? pred.mostLikelyScore.split("-")[0]} - {f.goals.away ?? pred.mostLikelyScore.split("-")[1]}
              </div>

              <div style={{ textAlign: "center" }}>
                <Link
                  href={matchHref}
                  style={{
                    fontSize: "0.62rem", fontWeight: 700, color: "#111",
                    border: "1px solid #ccc", borderRadius: "4px",
                    padding: "0.25rem 0.4rem", textDecoration: "none",
                  }}
                >
                  PREVIEW
                </Link>
              </div>
            </div>
          );
        })}
      </main>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#fff", borderTop: "1px solid #ddd",
        display: "flex", justifyContent: "space-around", padding: "0.5rem 0",
      }}>
        {[
          { label: "Home", icon: "🏠", href: "/" },
          { label: "Predictions", icon: "📊", href: "/" },
          { label: "Leagues", icon: "🛡️", href: "/leagues" },
          { label: "Favs", icon: "⭐", href: "/" },
          { label: "More", icon: "☰", href: "/" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            style={{ textAlign: "center", fontSize: "0.65rem", color: item.label === "Home" ? "#e2231a" : "#666", textDecoration: "none" }}
          >
            <div style={{ fontSize: "1.1rem" }}>{item.icon}</div>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
