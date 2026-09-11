import Link from "next/link";
import { getStandings } from "../../../lib/football-data";

export default async function StandingsPage({ params }) {
  const { code } = params;

  let table = [];
  let competitionName = "";
  let error = null;

  try {
    const result = await getStandings(code);
    competitionName = result.competitionName;
    table = result.table;
  } catch (e) {
    error = e.message;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/leagues" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>{competitionName || "Standings"}</span>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
        {error && <p style={{ color: "crimson" }}>Couldn't load standings. ({error})</p>}
        {!error && table.length === 0 && <p style={{ color: "#888" }}>No standings data available.</p>}

        {table.length > 0 && (
          <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 0.6fr 0.6fr 0.6fr", padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: "#555", borderBottom: "2px solid #ddd" }}>
              <span>#</span>
              <span>Team</span>
              <span style={{ textAlign: "center" }}>P</span>
              <span style={{ textAlign: "center" }}>GD</span>
              <span style={{ textAlign: "center" }}>Pts</span>
            </div>
            {table.map((row) => (
              <div key={row.team.id} style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 0.6fr 0.6fr 0.6fr", padding: "0.5rem 0.75rem", fontSize: "0.8rem", borderBottom: "1px solid #eee", alignItems: "center" }}>
                <span>{row.position}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {row.team.crest && <img src={row.team.crest} alt="" style={{ width: 16, height: 16 }} />}
                  {row.team.name}
                </span>
                <span style={{ textAlign: "center" }}>{row.playedGames}</span>
                <span style={{ textAlign: "center" }}>{row.goalDifference}</span>
                <span style={{ textAlign: "center", fontWeight: 700 }}>{row.points}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
