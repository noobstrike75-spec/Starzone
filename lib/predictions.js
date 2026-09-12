// Match-specific statistical prediction engine.
// It uses recent results + home/away splits + league averages and a
// Poisson goal model. It is deliberately conservative when the sample is small.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mean(values, fallback = 0) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(values, fallback = 0) {
  if (!values.length) return fallback;
  let weighted = 0;
  let weightTotal = 0;
  values.forEach((value, index) => {
    const weight = index + 1;
    weighted += value * weight;
    weightTotal += weight;
  });
  return weightTotal ? weighted / weightTotal : fallback;
}

function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function poissonProbability(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function finished(match) {
  return match?.status === "FINISHED" &&
    Number.isFinite(match?.score?.fullTime?.home) &&
    Number.isFinite(match?.score?.fullTime?.away);
}

function resultForTeam(match, teamId) {
  const isHome = match.homeTeam.id === teamId;
  const gf = isHome ? match.score.fullTime.home : match.score.fullTime.away;
  const ga = isHome ? match.score.fullTime.away : match.score.fullTime.home;
  return {
    date: new Date(match.utcDate).getTime(),
    isHome,
    gf,
    ga,
    opponentId: isHome ? match.awayTeam.id : match.homeTeam.id,
    result: gf > ga ? "W" : gf === ga ? "D" : "L",
  };
}

function teamForm(teamId, matches, homeAway) {
  const relevant = matches
    .filter(finished)
    .filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId)
    .map((m) => resultForTeam(m, teamId))
    .filter((r) => homeAway === "home" ? r.isHome : homeAway === "away" ? !r.isHome : true)
    .sort((a, b) => b.date - a.date)
    .slice(0, 10);

  return relevant;
}

function summarize(form, fallbackGoalsFor, fallbackGoalsAgainst) {
  if (!form.length) {
    return {
      matches: 0,
      scored: fallbackGoalsFor,
      conceded: fallbackGoalsAgainst,
      points: 1,
      btts: 0.5,
      over25: 0.5,
    };
  }

  const scored = weightedMean(form.map((x) => x.gf), fallbackGoalsFor);
  const conceded = weightedMean(form.map((x) => x.ga), fallbackGoalsAgainst);
  const points = mean(form.map((x) => x.result === "W" ? 3 : x.result === "D" ? 1 : 0)) / 3;
  const btts = mean(form.map((x) => x.gf > 0 && x.ga > 0 ? 1 : 0));
  const over25 = mean(form.map((x) => x.gf + x.ga > 2.5 ? 1 : 0));

  return { matches: form.length, scored, conceded, points, btts, over25 };
}

function leagueAverages(matches) {
  const played = matches.filter(finished);
  if (!played.length) {
    return { homeGoals: 1.45, awayGoals: 1.15, totalGoals: 2.60 };
  }
  const homeGoals = mean(played.map((m) => m.score.fullTime.home), 1.45);
  const awayGoals = mean(played.map((m) => m.score.fullTime.away), 1.15);
  return { homeGoals, awayGoals, totalGoals: homeGoals + awayGoals };
}

function normaliseProbabilities(home, draw, away) {
  const total = home + draw + away || 1;
  return {
    home: (home / total) * 100,
    draw: (draw / total) * 100,
    away: (away / total) * 100,
  };
}

export function predictMatch({
  homeTeam,
  awayTeam,
  historicalMatches = [],
  maxGoals = 7,
}) {
  const league = leagueAverages(historicalMatches);

  const homeForm = teamForm(homeTeam.id, historicalMatches, "home");
  const awayForm = teamForm(awayTeam.id, historicalMatches, "away");
  const homeAll = teamForm(homeTeam.id, historicalMatches, "all");
  const awayAll = teamForm(awayTeam.id, historicalMatches, "all");

  const hf = summarize(homeForm, league.homeGoals, league.awayGoals);
  const af = summarize(awayForm, league.awayGoals, league.homeGoals);
  const ha = summarize(homeAll, league.homeGoals, league.awayGoals);
  const aa = summarize(awayAll, league.awayGoals, league.homeGoals);

  // Blend home/away splits with overall form. This reduces wild estimates
  // when a team has only 1–2 home/away games early in a season.
  const homeAttack = hf.scored * 0.70 + ha.scored * 0.30;
  const homeDefence = hf.conceded * 0.70 + ha.conceded * 0.30;
  const awayAttack = af.scored * 0.70 + aa.scored * 0.30;
  const awayDefence = af.conceded * 0.70 + aa.conceded * 0.30;

  // Attack/defence ratios against the league baseline.
  const homeAttackStrength = homeAttack / league.homeGoals;
  const awayDefenceStrength = awayDefence / league.homeGoals;
  const awayAttackStrength = awayAttack / league.awayGoals;
  const homeDefenceStrength = homeDefence / league.awayGoals;

  let homeExpected = league.homeGoals * homeAttackStrength * awayDefenceStrength;
  let awayExpected = league.awayGoals * awayAttackStrength * homeDefenceStrength;

  // Small home advantage and shrinkage toward league means.
  const sample = Math.min(1, (hf.matches + af.matches + ha.matches + aa.matches) / 30);
  homeExpected = league.homeGoals * (1 - 0.35 * sample) + homeExpected * (0.35 * sample);
  awayExpected = league.awayGoals * (1 - 0.35 * sample) + awayExpected * (0.35 * sample);

  homeExpected = clamp(homeExpected, 0.20, 3.80);
  awayExpected = clamp(awayExpected, 0.15, 3.50);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  const scoreProbabilities = [];

  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = poissonProbability(homeExpected, h) * poissonProbability(awayExpected, a);
      scoreProbabilities.push({ home: h, away: a, probability: p });
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a > 1.5) over15 += p;
      if (h + a > 2.5) over25 += p;
      if (h + a > 3.5) over35 += p;
      if (h > 0 && a > 0) btts += p;
    }
  }

  // Dixon-Coles-inspired low-score adjustment: draws and 0-0/1-1 are
  // slightly more common than independent Poisson tends to estimate.
  const lowScoreBoost = 1.08;
  draw *= lowScoreBoost;
  const probs = normaliseProbabilities(homeWin, draw, awayWin);

  const mostLikelyScore = scoreProbabilities.reduce((best, current) =>
    current.probability > best.probability ? current : best
  );

  const confidenceBase = Math.min(1, (hf.matches + af.matches) / 12);
  const probabilitySpread = Math.max(probs.home, probs.draw, probs.away) -
    Math.min(probs.home, probs.draw, probs.away);
  const confidence = clamp(45 + confidenceBase * 35 + probabilitySpread * 0.35, 45, 95);

  const pick = probs.home >= probs.draw && probs.home >= probs.away ? "1" :
    probs.away >= probs.home && probs.away >= probs.draw ? "2" : "X";

  return {
    homeExpectedGoals: Number(homeExpected.toFixed(2)),
    awayExpectedGoals: Number(awayExpected.toFixed(2)),
    homeWinProbability: Number(probs.home.toFixed(1)),
    drawProbability: Number(probs.draw.toFixed(1)),
    awayWinProbability: Number(probs.away.toFixed(1)),
    mostLikelyScore: `${mostLikelyScore.home}-${mostLikelyScore.away}`,
    pick,
    coefficient: Number((100 / Math.max(probs.home, probs.draw, probs.away)).toFixed(2)),
    over15: Number((over15 * 100).toFixed(1)),
    over25: Number((over25 * 100).toFixed(1)),
    over35: Number((over35 * 100).toFixed(1)),
    under25: Number(((1 - over25) * 100).toFixed(1)),
    bttsYes: Number((btts * 100).toFixed(1)),
    bttsNo: Number(((1 - btts) * 100).toFixed(1)),
    confidence: Number(confidence.toFixed(0)),
    dataMatchesHome: hf.matches,
    dataMatchesAway: af.matches,
  };
}

export function buildPredictions(matches, historyByCompetition) {
  return matches.map((match) => {
    const code = match.competition?.code;
    const history = historyByCompetition.get(code) || [];
    const prediction = predictMatch({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      historicalMatches: history.filter((h) => new Date(h.utcDate) < new Date(match.utcDate)),
    });
    return { match, prediction };
  }).sort((a, b) => b.prediction.confidence - a.prediction.confidence);
}
