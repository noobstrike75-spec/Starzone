import { getFixturesByDate } from "../lib/api-football";

export default async function HomePage() {
  const today = new Date().toISOString().split("T")[0];

  let fixtures = [];
  let error = null;

  try {
    fixtures = await getFixturesByDate(today);
  } catch (e) {
    error = e.message;
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 700, margin: "0 auto" }}>
      <h1>Starzone — Today's Fixtures</h1>

      {error && (
        <p style={{ color: "crimson" }}>
          Couldn't load fixtures yet — add your API_FOOTBALL_KEY in .env.local.
          ({error})
        </p>
      )}

      {!error && fixtures.length === 0 && <p>No fixtures found for today.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {fixtures.map((f) => (
          <li
            key={f.fixture.id}
            style={{
              padding: "0.75rem",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              {f.teams.home.name} vs {f.teams.away.name}
            </span>
            <span>
              {f.goals.home ?? "-"} : {f.goals.away ?? "-"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
  }
