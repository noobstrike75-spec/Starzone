import Link from "next/link";
import { getTeamInfo, getTeamRecentMatches } from "../../../lib/football-data";

export default async function TeamPage({ params }) {
  const teamId = params.id;

  let info = null;
  let recent = [];
  let error = null;

  try {
    info = await getTeamInfo(teamId);
    recent = await getTeamRecentMatches(teamId, 5);
  } catch (e) {
    error = e.message;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700 }}>Team Stats</span>
      </header>

      {error && <p style={{ color: "crimson", padding: "1rem" }}>Couldn't load team data. ({error})</p>}

      {info && (
        <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem", display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            {info.crest && <img src={info.crest} alt={info.name} style={{ width: 56, height: 56 }} />}
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem", color: "#111" }}>{info.name}</h1>
              <p style={{ margin: "0.2rem 0 0", color: "#666", fontSize: "0.85rem" }}>
                {info.area?.name} · Founded {info.founded ?? "—"}
              </p>
              {info.venue && (
                <p style={{ margin: "0.2rem 0 0", color: "#666", fontSize: "0.8rem" }}>🏟️ {info.venue}</p>
              )}
              {info.coach?.name && (
                <p style={{ margin: "0.2rem 0 0", color: "#666", fontSize: "0.8rem" }}>👔 Coach: {info.coach.name}</p>
              )}
            </div>
          </div>

          {recent.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "10px", padding: "1.2rem" }}>
              <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "#111" }}>Last 5 Matches</h2>
              {recent.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #eee", fontSize: "0.85rem" }}>
                  <span>{m.homeTeam.name} vs {m.awayTeam.name}</span>
                  <span style={{ fontWeight: 600 }}>{m.score.fullTime.home ?? "-"} : {m.score.fullTime.away ?? "-"}</span>
                </div>
              ))}
            </div>
          )}
          {recent.length === 0 && !error && (
            <p style={{ color: "#888", fontSize: "0.85rem" }}>No recent finished matches found for this team.</p>
          )}
        </main>
      )}
    </div>
  );
}
