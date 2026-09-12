import Link from "next/link";
import { getMatchesByDate, getCompetitionMatches } from "../lib/football-data";
import { buildPredictions } from "../lib/predictions";

function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

function formatShort(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return toDateStr(d);
}

export default async function HomePage({ searchParams }) {
  const today = new Date();
  const selectedDateStr = searchParams?.date || toDateStr(today);

  const dateTabs = [];
  for (let offset = -1; offset <= 3; offset += 1) {
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

  // Only predict scheduled matches. If the selected day has fewer than 20
  // fixtures, extend forward so StarZone can still present up to 20 predictions.
  let predictionMatches = matches.filter((m) =>
    ["SCHEDULED", "TIMED"].includes(m.status)
  );

  if (!error && predictionMatches.length < 20) {
    const extraDates = await Promise.all(
      Array.from({ length: 6 }, (_, i) => getMatchesByDate(addDays(selectedDateStr, i + 1)))
    );
    const seen = new Set(predictionMatches.map((m) => m.id));
    for (const dayMatches of extraDates.flat()) {
      for (const m of dayMatches) {
        if (seen.has(m.id)) continue;
        if (!["SCHEDULED", "TIMED"].includes(m.status)) continue;
        seen.add(m.id);
        predictionMatches.push(m);
        if (predictionMatches.length >= 20) break;
      }
      if (predictionMatches.length >= 20) break;
    }
  }

  const upcoming = predictionMatches.slice(0, 20);

  // Build one history pool per competition rather than one API request per team.
  // This is much friendlier to football-data.org's request limits.
  const competitionCodes = [...new Set(upcoming.map((m) => m.competition?.code).filter(Boolean))];
  const historyFrom = addDays(selectedDateStr, -365);
  const historyTo = addDays(selectedDateStr, -1);
  const historyByCompetition = new Map();

  if (!error && competitionCodes.length) {
    const results = await Promise.allSettled(
      competitionCodes.map(async (code) => [
        code,
        await getCompetitionMatches(code, historyFrom, historyTo),
      ])
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        historyByCompetition.set(result.value[0], result.value[1]);
      }
    }
  }

  const predictions = !error ? buildPredictions(upcoming, historyByCompetition) : [];
  const predictionMap = new Map(predictions.map((p) => [p.match.id, p.prediction]));

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
            <Link key={tab.dateStr} href={`/?date=${tab.dateStr}`} style={{ background: tab.dateStr === selectedDateStr ? "#e2231a" : "#111", color: "#fff", borderRadius: "16px", padding: "0.4rem 0.9rem", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
              {tab.label}
            </Link>
          ))}
        </div>

        {error && <p style={{ color: "crimson", padding: "0 1rem" }}>Couldn't load matches. Check your FOOTBALL_DATA_KEY in Vercel. ({error})</p>}
        {!error && matches.length === 0 && <p style={{ textAlign: "center", color: "#666" }}>No matches found for this date in the covered competitions.</p>}

        {!error && matches.length > 0 && (
          <>
            <div style={{ padding: "0.4rem 0.75rem", fontSize: "0.7rem", color: "#666" }}>
              {predictions.length} match prediction{predictions.length === 1 ? "" : "s"} generated from match-specific historical data.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr", padding: "0.5rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "#555", borderBottom: "2px solid #ddd" }}>
              <span>Home / Away</span><span style={{ textAlign: "center" }}>1&nbsp;&nbsp;X&nbsp;&nbsp;2</span><span style={{ textAlign: "center" }}>Coef.</span><span style={{ textAlign: "center" }}>Score</span><span></span>
            </div>
          </>
        )}

        {matches.map((m) => {
          const pred = predictionMap.get(m.id);
          const finished = m.status === "FINISHED";
          const homeGoals = m.score?.fullTime?.home;
          const awayGoals = m.score?.fullTime?.away;
          const matchHref = `/match/${m.id}?homeId=${m.homeTeam.id}&awayId=${m.awayTeam.id}&homeName=${encodeURIComponent(m.homeTeam.name)}&awayName=${encodeURIComponent(m.awayTeam.name)}`;

          return (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.8fr 0.8fr 0.9fr", alignItems: "center", padding: "0.6rem 0.75rem", background: "#fff", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c0392b", lineHeight: 1.4 }}>
                <div><Link href={`/team/${m.homeTeam.id}`} style={{ color: "inherit", textDecoration: "none" }}>{m.homeTeam.name}</Link></div>
                <div><Link href={`/team/${m.awayTeam.id}`} style={{ color: "inherit", textDecoration: "none" }}>{m.awayTeam.name}</Link></div>
              </div>

              {pred ? (
                <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", fontSize: "0.78rem", fontWeight: 600 }}>
                  <span>{pred.homeWinProbability}</span><span>{pred.drawProbability}</span><span>{pred.awayWinProbability}</span>
                </div>
              ) : <div style={{ textAlign: "center", color: "#888", fontSize: "0.7rem" }}>{finished ? "Result" : "—"}</div>}

              <div style={{ textAlign: "center" }}>
                {pred && <><span style={{ background: "#f5a623", color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>{pred.pick}</span><div style={{ fontSize: "0.65rem", color: "#333", marginTop: "0.2rem" }}>{pred.coefficient}</div></>}
              </div>

              <div style={{ textAlign: "center", fontSize: "0.78rem", fontWeight: 600 }}>
                {finished ? `${homeGoals ?? "-"} - ${awayGoals ?? "-"}` : (pred?.mostLikelyScore ?? "—")}
              </div>

              <div style={{ textAlign: "center" }}>
                <Link href={matchHref} style={{ fontSize: "0.62rem", fontWeight: 700, color: "#111", border: "1px solid #ccc", borderRadius: "4px", padding: "0.25rem 0.4rem", textDecoration: "none" }}>PREVIEW</Link>
              </div>
            </div>
          );
        })}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-around", padding: "0.5rem 0" }}>
        {[{ label: "Home", icon: "🏠", href: "/" }, { label: "Predictions", icon: "📊", href: "/" }, { label: "Leagues", icon: "🛡️", href: "/leagues" }, { label: "Favs", icon: "⭐", href: "/" }, { label: "More", icon: "☰", href: "/" }].map((item) => (
          <Link key={item.label} href={item.href} style={{ textAlign: "center", fontSize: "0.65rem", color: item.label === "Home" ? "#e2231a" : "#666", textDecoration: "none" }}>
            <div style={{ fontSize: "1.1rem" }}>{item.icon}</div>{item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
