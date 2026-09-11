import Link from "next/link";
import { getMatchesByDate } from "../lib/football-data";
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

  const dateTabs = [];
  for (let offset = -1; offset <= 3; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    dateTabs.push({ dateStr: toDateStr(d), label: offset === 0 ? "Today" : formatShort(d) });
  }

  let matches = [];
  let error = null;

  try {
    matches = await getMatchesByDate(selectedDateStr);
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
      </nav>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 4rem" }}>
        <h1 style={{ textAlign: "center", fontSize: "1.1rem", padding: "1rem 1rem 0.5rem", color: "#222" }}>
          Mathematical Football Predictions and Statistics
        </h1>

        <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", flexWrap: "wrap" }}>
          {dateTabs.map((tab) => (
            <Link
              key={tab.dateStr}
              href={`/?date=${tab.dateStr}`}
              style={{
                background: tab.dateStr === selectedDateStr ? "#e2231a" : "#111",
                color: "#fff", borderRadius: "16px", padding: "0.4rem 0.9rem",
                fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {error && (
          <p style={{ color: "crimson", padding: "0 1rem" }}>
            Couldn't load matches — add your FOOTBALL_DATA_KEY in .env.local. ({error})
          </p>
        )}
        {!error && matches.length === 0 && (
          <p style={{ textAlign: "center", color: "#666" }}>No matches found for this date in the covered competitions.</p>
        )}

        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr", padding: "0.5rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#555", borderBottom: "2px solid #ddd" }}>
            <span>Home / Away</span>
            <span style={{ textAlign: "center" }}>1&nbsp;&nbsp;X&nbsp;&nbsp;2</span>
            <span style={{ textAlign: "center" }}>Coef.</span>
            <span style={{ textAlign: "center" }}>Score</span>
            <span></span>
          </div>
        )}

        {matches.map((m) => {
          const pred = getPrediction();
          const bestOdd = Math.max(pred.homeWinProbability, pred.drawProbability, pred.awayWinProbability);
          const coef = (100 / bestOdd).toFixed(2);
          const homeGoals = m.score.fullTime.home;
          const awayGoals = m.score.fullTime.away;
          const matchHref = `/match/${m.id}?homeId=${m.homeTeam.id}&awayId=${m.awayTeam.id}&homeName=${encodeURIComponent(m.homeTeam.name)}&awayName=${encodeURIComponent(m.awayTeam.name)}`;

          return (
            <div
              key={m.id}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr",
                alignItems: "center", padding: "0.6rem 0.75rem",
                background: "#fff", borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c0392b", lineHeight: 1.4 }}>
                <div>
                  <Link href={`/team/${m.homeTeam.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {m.homeTeam.name}
                  </Link>
                </div>
                <div>
                  <Link href={`/team/${m.awayTeam.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {m.awayTeam.name}
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
                {homeGoals ?? pred.mostLikelyScore.split("-")[0]} - {awayGoals ?? pred.mostLikelyScore.split("-")[1]}
              </div>

              <div style={{ textAlign: "center" }}>
                <Link href={matchHref} style={{ fontSize: "0.62rem", fontWeight: 700, color: "#111", border: "1px solid #ccc", borderRadius: "4px", padding: "0.25rem 0.4rem", textDecoration: "none" }}>
                  PREVIEW
                </Link>
              </div>
            </div>
          );
        })}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-around", padding: "0.5rem 0" }}>
        {[
          { label: "Home", icon: "🏠", href: "/" },
          { label: "Predictions", icon: "📊", href: "/" },
          { label: "Leagues", icon: "🛡️", href: "/leagues" },
          { label: "Favs", icon: "⭐", href: "/" },
          { label: "More", icon: "☰", href: "/" },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={{ textAlign: "center", fontSize: "0.65rem", color: item.label === "Home" ? "#e2231a" : "#666", textDecoration: "none" }}>
            <div style={{ fontSize: "1.1rem" }}>{item.icon}</div>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
