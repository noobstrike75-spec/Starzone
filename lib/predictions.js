// StarZone v5 prediction engine.
//
// The model combines several independent signals from the available match
// history instead of relying on one simple average:
//   - recency-weighted goals and points
//   - home/away attacking and defensive splits
//   - opponent-adjusted Elo-style strength
//   - rolling competition form table
//   - direct head-to-head signal when enough meetings exist
//   - Poisson score distribution with a low-score/draw correction
//
// It is intentionally conservative when the historical sample is small.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mean(values, fallback = 0) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(values, weights, fallback = 0) {
  if (!values.length) return fallback;
  if (!weights || weights.length !== values.length) return mean(values, fallback);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (!totalWeight) return fallback;
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
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
    Number.isFinite(match?.score?.fullTime?.away) &&
    match?.homeTeam?.id != null &&
    match?.awayTeam?.id != null;
}

function dateValue(match) {
  const value = new Date(match?.utcDate).getTime();
  return Number.isFinite(value) ? value : 0;
}

function resultForTeam(match, teamId) {
  const isHome = match.homeTeam.id === teamId;
  const gf = isHome ? match.score.fullTime.home : match.score.fullTime.away;
  const ga = isHome ? match.score.fullTime.away : match.score.fullTime.home;
  return {
    date: dateValue(match),
    isHome,
    gf,
    ga,
    opponentId: isHome ? match.awayTeam.id : match.homeTeam.id,
    result: gf > ga ? "W" : gf === ga ? "D" : "L",
    points: gf > ga ? 3 : gf === ga ? 1 : 0,
  };
}

function recencyWeight(date, latestDate) {
  if (!date || !latestDate) return 1;
  const daysAgo = Math.max(0, (latestDate - date) / 86400000);
  // Half-life of roughly 35 days: recent matches matter more, but older
  // matches still contribute when a team has a small sample.
  return Math.exp(-Math.log(2) * daysAgo / 35);
}

function teamForm(teamId, matches, homeAway, limit = 10) {
  const relevant = matches
    .filter(finished)
    .filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId)
    .map((m) => resultForTeam(m, teamId))
    .filter((r) => homeAway === "home" ? r.isHome : homeAway === "away" ? !r.isHome : true)
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);

  const latestDate = relevant[0]?.date || 0;
  return relevant.map((item) => ({
    ...item,
    weight: recencyWeight(item.date, latestDate),
  }));
}

function summarize(form, fallbackGoalsFor, fallbackGoalsAgainst) {
  if (!form.length) {
    return {
      matches: 0,
      scored: fallbackGoalsFor,
      conceded: fallbackGoalsAgainst,
      points: 1,
      goalDiff: 0,
      btts: 0.5,
      over25: 0.5,
      cleanSheet: 0.25,
      failedToScore: 0.25,
    };
  }

  const weights = form.map((x) => x.weight);
  const scored = weightedMean(form.map((x) => x.gf), weights, fallbackGoalsFor);
  const conceded = weightedMean(form.map((x) => x.ga), weights, fallbackGoalsAgainst);
  const points = weightedMean(form.map((x) => x.points / 3), weights, 1);
  const goalDiff = scored - conceded;
  const btts = weightedMean(form.map((x) => x.gf > 0 && x.ga > 0 ? 1 : 0), weights, 0.5);
  const over25 = weightedMean(form.map((x) => x.gf + x.ga > 2.5 ? 1 : 0), weights, 0.5);
  const cleanSheet = weightedMean(form.map((x) => x.ga === 0 ? 1 : 0), weights, 0.25);
  const failedToScore = weightedMean(form.map((x) => x.gf === 0 ? 1 : 0), weights, 0.25);

  return {
    matches: form.length,
    scored,
    conceded,
    points,
    goalDiff,
    btts,
    over25,
    cleanSheet,
    failedToScore,
  };
}

function leagueAverages(matches) {
  const played = matches.filter(finished);
  if (!played.length) {
    return { homeGoals: 1.45, awayGoals: 1.15, totalGoals: 2.60 };
  }

  const latestDate = Math.max(...played.map(dateValue));
  const weights = played.map((m) => recencyWeight(dateValue(m), latestDate));
  const homeGoals = weightedMean(played.map((m) => m.score.fullTime.home), weights, 1.45);
  const awayGoals = weightedMean(played.map((m) => m.score.fullTime.away), weights, 1.15);
  return { homeGoals, awayGoals, totalGoals: homeGoals + awayGoals };
}

function buildTeamTable(matches) {
  const table = new Map();
  const played = matches.filter(finished).sort((a, b) => dateValue(a) - dateValue(b));

  for (const match of played) {
    const homeId = match.homeTeam.id;
    const awayId = match.awayTeam.id;
    const hg = match.score.fullTime.home;
    const ag = match.score.fullTime.away;

    if (!table.has(homeId)) table.set(homeId, { matches: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });
    if (!table.has(awayId)) table.set(awayId, { matches: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });

    const home = table.get(homeId);
    const away = table.get(awayId);

    home.matches += 1;
    away.matches += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) home.points += 3;
    else if (hg < ag) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  return table;
}

function buildElo(matches) {
  const ratings = new Map();
  const sorted = matches.filter(finished).sort((a, b) => dateValue(a) - dateValue(b));
  const K = 22;
  const HOME_ADVANTAGE = 55;

  const get = (id) => ratings.has(id) ? ratings.get(id) : 1500;

  for (const match of sorted) {
    const homeId = match.homeTeam.id;
    const awayId = match.awayTeam.id;
    const hg = match.score.fullTime.home;
    const ag = match.score.fullTime.away;
    const homeRating = get(homeId);
    const awayRating = get(awayId);
    const expectedHome = 1 / (1 + Math.pow(10, ((awayRating + HOME_ADVANTAGE) - homeRating) / 400));
    const actualHome = hg > ag ? 1 : hg === ag ? 0.5 : 0;
    const margin = Math.min(3, Math.abs(hg - ag));
    const marginFactor = margin <= 1 ? 1 : 1 + (margin - 1) * 0.35;
    const change = K * marginFactor * (actualHome - expectedHome);

    ratings.set(homeId, homeRating + change);
    ratings.set(awayId, awayRating - change);
  }

  return ratings;
}

function teamStrength(teamId, table, league) {
  const row = table.get(teamId);
  if (!row || !row.matches) return { pointsPerGame: 1.5, goalDiffPerGame: 0, sample: 0 };
  return {
    pointsPerGame: row.points / row.matches,
    goalDiffPerGame: (row.goalsFor - row.goalsAgainst) / row.matches,
    sample: row.matches,
  };
}

function headToHead(homeId, awayId, matches) {
  const meetings = matches
    .filter(finished)
    .filter((m) =>
      (m.homeTeam.id === homeId && m.awayTeam.id === awayId) ||
      (m.homeTeam.id === awayId && m.awayTeam.id === homeId)
    )
    .sort((a, b) => dateValue(b) - dateValue(a))
    .slice(0, 6);

  if (!meetings.length) return { matches: 0, homeShare: 0.5, drawShare: 0.25, awayShare: 0.5 };

  let homePoints = 0;
  let awayPoints = 0;
  let draws = 0;
  let totalWeight = 0;

  const latest = dateValue(meetings[0]);
  for (const match of meetings) {
    const weight = recencyWeight(dateValue(match), latest);
    totalWeight += weight;
    const homeIsTarget = match.homeTeam.id === homeId;
    const hg = match.score.fullTime.home;
    const ag = match.score.fullTime.away;
    if (hg === ag) draws += weight;
    else if ((homeIsTarget && hg > ag) || (!homeIsTarget && ag > hg)) homePoints += weight;
    else awayPoints += weight;
  }

  return {
    matches: meetings.length,
    homeShare: totalWeight ? homePoints / totalWeight : 0.5,
    drawShare: totalWeight ? draws / totalWeight : 0.25,
    awayShare: totalWeight ? awayPoints / totalWeight : 0.5,
  };
}

function normaliseProbabilities(home, draw, away) {
  const total = home + draw + away || 1;
  return {
    home: (home / total) * 100,
    draw: (draw / total) * 100,
    away: (away / total) * 100,
  };
}

function probabilityFromScoreMatrix(homeExpected, awayExpected, maxGoals) {
  const matrix = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;

  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const probability = poissonProbability(homeExpected, h) * poissonProbability(awayExpected, a);
      matrix.push({ home: h, away: a, probability });
      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;
      if (h + a > 1.5) over15 += probability;
      if (h + a > 2.5) over25 += probability;
      if (h + a > 3.5) over35 += probability;
      if (h > 0 && a > 0) btts += probability;
    }
  }

  return { matrix, homeWin, draw, awayWin, over15, over25, over35, btts };
}

export function predictMatch({ homeTeam, awayTeam, historicalMatches = [], maxGoals = 7 }) {
  const league = leagueAverages(historicalMatches);
  const table = buildTeamTable(historicalMatches);
  const elo = buildElo(historicalMatches);

  const homeForm = teamForm(homeTeam.id, historicalMatches, "home", 8);
  const awayForm = teamForm(awayTeam.id, historicalMatches, "away", 8);
  const homeAll = teamForm(homeTeam.id, historicalMatches, "all", 10);
  const awayAll = teamForm(awayTeam.id, historicalMatches, "all", 10);

  const hf = summarize(homeForm, league.homeGoals, league.awayGoals);
  const af = summarize(awayForm, league.awayGoals, league.homeGoals);
  const ha = summarize(homeAll, league.homeGoals, league.awayGoals);
  const aa = summarize(awayAll, league.awayGoals, league.homeGoals);

  // Bayesian shrinkage: with few matches, move team rates toward the league
  // instead of allowing one unusual result to dominate the prediction.
  const homeSampleFactor = clamp(hf.matches / 6, 0, 1);
  const awaySampleFactor = clamp(af.matches / 6, 0, 1);

  const homeAttackRaw = hf.scored * 0.72 + ha.scored * 0.28;
  const homeDefenceRaw = hf.conceded * 0.72 + ha.conceded * 0.28;
  const awayAttackRaw = af.scored * 0.72 + aa.scored * 0.28;
  const awayDefenceRaw = af.conceded * 0.72 + aa.conceded * 0.28;

  const homeAttack = homeAttackRaw * homeSampleFactor + league.homeGoals * (1 - homeSampleFactor);
  const homeDefence = homeDefenceRaw * homeSampleFactor + league.awayGoals * (1 - homeSampleFactor);
  const awayAttack = awayAttackRaw * awaySampleFactor + league.awayGoals * (1 - awaySampleFactor);
  const awayDefence = awayDefenceRaw * awaySampleFactor + league.homeGoals * (1 - awaySampleFactor);

  const homeAttackStrength = clamp(homeAttack / league.homeGoals, 0.45, 2.0);
  const awayDefenceStrength = clamp(awayDefence / league.homeGoals, 0.45, 2.0);
  const awayAttackStrength = clamp(awayAttack / league.awayGoals, 0.45, 2.0);
  const homeDefenceStrength = clamp(homeDefence / league.awayGoals, 0.45, 2.0);

  let homeExpected = league.homeGoals * homeAttackStrength * awayDefenceStrength;
  let awayExpected = league.awayGoals * awayAttackStrength * homeDefenceStrength;

  // Recent points and goal difference provide a form signal separate from
  // raw scoring averages.
  const homeFormStrength = clamp((hf.points - 0.5) * 0.18 + clamp(hf.goalDiff, -2, 2) * 0.035, -0.18, 0.18);
  const awayFormStrength = clamp((af.points - 0.5) * 0.18 + clamp(af.goalDiff, -2, 2) * 0.035, -0.18, 0.18);
  homeExpected *= 1 + homeFormStrength;
  awayExpected *= 1 + awayFormStrength;

  // Elo-style opponent-adjusted strength. This prevents a team looking elite
  // simply because its recent fixtures happened to be weak.
  const homeElo = elo.get(homeTeam.id) ?? 1500;
  const awayElo = elo.get(awayTeam.id) ?? 1500;
  const eloEdge = clamp((homeElo + 55 - awayElo) / 400, -0.75, 0.75);
  homeExpected *= 1 + clamp(eloEdge * 0.16, -0.12, 0.12);
  awayExpected *= 1 - clamp(eloEdge * 0.12, -0.10, 0.10);

  // Rolling table strength is intentionally a small adjustment because it is
  // calculated from the same match results as form/goals.
  const hs = teamStrength(homeTeam.id, table, league);
  const as = teamStrength(awayTeam.id, table, league);
  const ppgEdge = clamp((hs.pointsPerGame - as.pointsPerGame) / 3, -1, 1);
  homeExpected *= 1 + ppgEdge * 0.055;
  awayExpected *= 1 - ppgEdge * 0.035;

  // Home advantage is already represented by league home/away baselines; do
  // not add a large arbitrary boost on top of it.
  homeExpected = clamp(homeExpected, 0.20, 3.80);
  awayExpected = clamp(awayExpected, 0.15, 3.50);

  let matrixData = probabilityFromScoreMatrix(homeExpected, awayExpected, maxGoals);

  // Direct meetings can help break close calls, but only with enough evidence.
  const h2h = headToHead(homeTeam.id, awayTeam.id, historicalMatches);
  const h2hWeight = clamp(h2h.matches / 5, 0, 1) * 0.07;
  if (h2hWeight > 0) {
    matrixData.homeWin = matrixData.homeWin * (1 - h2hWeight) + h2h.homeShare * h2hWeight;
    matrixData.draw = matrixData.draw * (1 - h2hWeight) + h2h.drawShare * h2hWeight;
    matrixData.awayWin = matrixData.awayWin * (1 - h2hWeight) + h2h.awayShare * h2hWeight;
  }

  // Low-score correction: independent Poisson slightly underestimates common
  // 0-0/1-1 outcomes. Keep the adjustment modest to avoid making every game 1-1.
  const correctedMatrix = matrixData.matrix.map((entry) => {
    let factor = 1;
    if (entry.home === 0 && entry.away === 0) factor = 1.10;
    if (entry.home === 1 && entry.away === 1) factor = 1.08;
    if ((entry.home === 1 && entry.away === 0) || (entry.home === 0 && entry.away === 1)) factor = 0.98;
    return { ...entry, probability: entry.probability * factor };
  });

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;

  for (const entry of correctedMatrix) {
    if (entry.home > entry.away) homeWin += entry.probability;
    else if (entry.home === entry.away) draw += entry.probability;
    else awayWin += entry.probability;
    if (entry.home + entry.away > 1.5) over15 += entry.probability;
    if (entry.home + entry.away > 2.5) over25 += entry.probability;
    if (entry.home + entry.away > 3.5) over35 += entry.probability;
    if (entry.home > 0 && entry.away > 0) btts += entry.probability;
  }

  const probs = normaliseProbabilities(homeWin, draw, awayWin);
  const matrixTotal = correctedMatrix.reduce((sum, item) => sum + item.probability, 0) || 1;
  const mostLikelyScore = correctedMatrix.reduce((best, current) =>
    current.probability > best.probability ? current : best
  );

  // Confidence is based on sample size, probability separation, and whether
  // the two strength systems (goals + Elo) agree rather than just being a
  // fixed number.
  const sampleQuality = clamp((hf.matches + af.matches) / 14, 0, 1);
  const agreement = 1 - clamp(Math.abs((homeElo - awayElo) / 500 - (homeExpected - awayExpected) / 2), 0, 1);
  const spread = Math.max(probs.home, probs.draw, probs.away) -
    Math.min(probs.home, probs.draw, probs.away);
  const confidence = clamp(46 + sampleQuality * 24 + spread * 0.30 + agreement * 12, 45, 96);

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
    over15: Number(((over15 / matrixTotal) * 100).toFixed(1)),
    over25: Number(((over25 / matrixTotal) * 100).toFixed(1)),
    over35: Number(((over35 / matrixTotal) * 100).toFixed(1)),
    under25: Number(((1 - over25 / matrixTotal) * 100).toFixed(1)),
    bttsYes: Number(((btts / matrixTotal) * 100).toFixed(1)),
    bttsNo: Number(((1 - btts / matrixTotal) * 100).toFixed(1)),
    confidence: Number(confidence.toFixed(0)),
    dataMatchesHome: hf.matches,
    dataMatchesAway: af.matches,
    modelVersion: "v5",
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
