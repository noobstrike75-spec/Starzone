import Link from "next/link";

const LEAGUES = [
  { id: 39, name: "Premier League", country: "England" },
  { id: 140, name: "La Liga", country: "Spain" },
  { id: 78, name: "Bundesliga", country: "Germany" },
  { id: 135, name: "Serie A", country: "Italy" },
  { id: 61, name: "Ligue 1", country: "France" },
  { id: 2, name: "Champions League", country: "Europe" },
];

const SEASON = 2023; // free-tier plans often only cover 2021-2023 data

export default function LeaguesPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f4f4f4", minHeight: "100vh", paddingBottom: "3rem" }}>
      <header style={{ background: "#111", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.3rem", textDecoration: "none" }}>←</Link>
        <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>Leagues</span>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
        <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden" }}>
          {LEAGUES.map((l) => (
            <Link
              key={l.id}
              href={`/standings/${l.id}/${SEASON}`}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.9rem 1rem", borderBottom: "1px solid #eee",
                color: "#111", textDecoration: "none",
              }}
            >
              <span style={{ fontWeight: 600 }}>{l.name}</span>
              <span style={{ color: "#888", fontSize: "0.8rem" }}>{l.country} →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
