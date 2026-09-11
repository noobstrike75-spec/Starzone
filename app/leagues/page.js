import Link from "next/link";

const LEAGUES = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "FL1", name: "Ligue 1", country: "France" },
  { code: "CL", name: "Champions League", country: "Europe" },
];

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
              key={l.code}
              href={`/standings/${l.code}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #eee", color: "#111", textDecoration: "none" }}
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
