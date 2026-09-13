// StarZone v6 prediction engine.
//
// v6 builds on v5 with:
//   - recency-weighted goals, points and opponent-adjusted form
//   - home/away attacking and defensive splits
//   - opponent-adjusted Elo-style strength
//   - rolling competition strength
//   - modest head-to-head signal
//   - Poisson score distribution with low-score correction
//   - blended 1X2 probability from goal model + strength model + form model
//   - data-quality aware confidence
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

function recencyWeight(date, latestDate, halfLife = 35) {
  if (!date || !latestDate) return 1;
  const daysAgo = Math.max(0, (latestDate - date) / 86400000);
  return Math.exp(-Math.log(2) * daysAgo / halfLife);
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
      points: 0.5,
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
  const points = weightedMean(form.map((x) => x.points / 3), weights, 0.5);
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

function teamStrength(teamId, table) {
  const row = table.get(teamId);
  if (!row || !row.matches) return { pointsPerGame: 1.5, goalDiffPerGame: 0, sample: 0 };

  return {
    pointsPerGame: row.points / row.matches,
    goalDiffPerGame: (row.goalsFor - row.goalsAgainst) / row.matches,
    sample: row.matches,
  };
}

function opponentAdjustedForm(form, elo) {
  if (!form.length) {
    return { performance: 0.5, goalDiff: 0, sample: 0 };
  }

  const values = [];
  const weights = [];

  for (const item of form) {
    const opponentRating = elo.get(item.opponentId) ?? 1500;
    const opponentStrength = clamp((opponentRating - 1500) / 350, -1, 1);

    // Expected points fall as opponent strength rises. This gives credit for
    // good results against strong opponents and discounts easy fixtures.
    const expectedPoints = clamp(0.5 - opponentStrength * 0.18, 0.20, 0.80);
    const actualPoints = item.points / 3;
    const performance = clamp(0.5 + (actualPoints - expectedPoints) * 0.95, 0, 1);

    values.push(performance);
    weights.push(item.weight);
  }

  return {
    performance: weightedMean(values, weights, 0.5),
    goalDiff: weightedMean(
      form.map((item) => clamp(item.gf - item.ga, -3, 3)),
      weights,
      0
    ),
    sample: form.length,
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

  if (!meetings.length) {
    return { matches: 0, homeShare: 0.5, drawShare: 0.25, awayShare: 0.25 };
  }

  let homePoints = 0;
  let awayPoints = 0;
  let draws = 0;
  let totalWeight = 0;
  const latest = dateValue(meetings[0]);

  for (const match of meetings) {
    const weight = recencyWeight(dateValue(match), latest, 365);
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
    awayShare: totalWeight ? awayPoints / totalWeight : 0.25,
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

function scoreMatrixProbabilities(matrix) {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (const entry of matrix) {
    if (entry.home > entry.away) home += entry.probability;
    else if (entry.home === entry.away) draw += entry.probability;
    else away += entry.probability;
  }

  return normaliseProbabilities(home, draw, away);
}

function eloProbabilities(homeElo, awayElo) {
  const edge = (homeElo + 55 - awayElo) / 400;
  const home = 1 / (1 + Math.pow(10, -edge));
  const draw = clamp(0.29 - Math.abs(edge) * 0.08, 0.18, 0.30);
  const decisive = 1 - draw;

  if (home >= 0.5) {
    return normaliseProbabilities(
      home * decisive,
      draw,
      (1 - home) * decisive
    );
  }

  return normaliseProbabilities(
    home * decisive,
    draw,
    (1 - home) * decisive
  );
}

function formProbabilities(homeForm, awayForm, homeOppForm, awayOppForm) {
  const homeSignal = clamp(
    0.50 +
      (homeForm.points - 0.50) * 0.55 +
      (homeOppForm.performance - 0.50) * 0.30 +
      clamp(homeForm.goalDiff, -2, 2) * 0.025,
    0.05,
    0.90
  );

  const awaySignal = clamp(
    0.50 +
      (awayForm.points - 0.50) * 0.55 +
      (awayOppForm.performance - 0.50) * 0.30 +
      clamp(awayForm.goalDiff, -2, 2) * 0.025,
    0.05,
    0.90
  );

  const total = homeSignal + awaySignal + 0.42;
  return normaliseProbabilities(
    homeSignal / total,
    0.42 / total,
    awaySignal / total
  );
}

export function predictMatch({ homeTeam, awayTeam, historicalMatches = [], maxGoals = 7 }) {
  const validHistory = historicalMatches.filter(finished);
  const league = leagueAverages(validHistory);
  const table = buildTeamTable(validHistory);
  const elo = buildElo(validHistory);

  const homeForm = teamForm(homeTeam.id, validHistory, "home", 8);
  const awayForm = teamForm(awayTeam.id, validHistory, "away", 8);
  const homeAll = teamForm(homeTeam.id, validHistory, "all", 10);
  const awayAll = teamForm(awayTeam.id, validHistory, "all", 10);

  const hf = summarize(homeForm, league.homeGoals, league.awayGoals);
  const af = summarize(awayForm, league.awayGoals, league.homeGoals);
  const ha = summarize(homeAll, league.homeGoals, league.awayGoals);
  const aa = summarize(awayAll, league.awayGoals, league.homeGoals);

  const homeOppForm = opponentAdjustedForm(homeAll, elo);
  const awayOppForm = opponentAdjustedForm(awayAll, elo);

  // Bayesian shrinkage: small samples are pulled toward league baselines.
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

  // Recent points and goal difference.
  const homeFormStrength = clamp(
    (hf.points - 0.5) * 0.18 + clamp(hf.goalDiff, -2, 2) * 0.035,
    -0.18,
    0.18
  );
  const awayFormStrength = clamp(
    (af.points - 0.5) * 0.18 + clamp(af.goalDiff, -2, 2) * 0.035,
    -0.18,
    0.18
  );

  homeExpected *= 1 + homeFormStrength;
  awayExpected *= 1 + awayFormStrength;

  // Opponent-adjusted form adds a smaller, independent signal.
  homeExpected *= 1 + clamp((homeOppForm.performance - 0.5) * 0.10, -0.05, 0.05);
  awayExpected *= 1 + clamp((awayOppForm.performance - 0.5) * 0.10, -0.05, 0.05);

  // Elo opponent-adjusted strength.
  const homeElo = elo.get(homeTeam.id) ?? 1500;
  const awayElo = elo.get(awayTeam.id) ?? 1500;
  const eloEdge = clamp((homeElo + 55 - awayElo) / 400, -0.75, 0.75);

  homeExpected *= 1 + clamp(eloEdge * 0.16, -0.12, 0.12);
  awayExpected *= 1 - clamp(eloEdge * 0.12, -0.10, 0.10);

  // Rolling table strength, deliberately kept small because it overlaps with
  // the goal and form signals.
  const hs = teamStrength(homeTeam.id, table);
  const as = teamStrength(awayTeam.id, table);
  const ppgEdge = clamp((hs.pointsPerGame - as.pointsPerGame) / 3, -1, 1);

  homeExpected *= 1 + ppgEdge * 0.055;
  awayExpected *= 1 - ppgEdge * 0.035;

  // Defensive indicators provide a small extra correction.
  homeExpected *= 1 + clamp((af.failedToScore - hf.cleanSheet) * 0.08, -0.05, 0.05);
  awayExpected *= 1 + clamp((hf.failedToScore - af.cleanSheet) * 0.08, -0.05, 0.05);

  homeExpected = clamp(homeExpected, 0.20, 3.80);
  awayExpected = clamp(awayExpected, 0.15, 3.50);

  // Goal-distribution model.
  const rawMatrixData = probabilityFromScoreMatrix(homeExpected, awayExpected, maxGoals);

  // Mild Dixon-Coles-style low-score correction.
  const correctedMatrix = rawMatrixData.matrix.map((entry) => {
    let factor = 1;

    if (entry.home === 0 && entry.away === 0) factor = 1.08;
    if (entry.home === 1 && entry.away === 1) factor = 1.05;
    if ((entry.home === 1 && entry.away === 0) || (entry.home === 0 && entry.away === 1)) factor = 0.985;

    return { ...entry, probability: entry.probability * factor };
  });

  const goalProbs = scoreMatrixProbabilities(correctedMatrix);
  const eloProbs = eloProbabilities(homeElo, awayElo);
  const formProbs = formProbabilities(hf, af, homeOppForm, awayOppForm);

  // v6 blends three partially independent views. With limited data, the goal
  // model receives more weight; as samples grow, strength/form signals matter
  // more. This avoids one noisy component taking over the prediction.
  const totalTeamSample = hf.matches + af.matches;
  const dataQuality = clamp(totalTeamSample / 14, 0, 1);

  const goalWeight = 0.58 - dataQuality * 0.08;
  const eloWeight = 0.24 + dataQuality * 0.04;
  const formWeight = 1 - goalWeight - eloWeight;

  let homeWin = goalProbs.home * goalWeight + eloProbs.home * eloWeight + formProbs.home * formWeight;
  let draw = goalProbs.draw * goalWeight + eloProbs.draw * eloWeight + formProbs.draw * formWeight;
  let awayWin = goalProbs.away * goalWeight + eloProbs.away * eloWeight + formProbs.away * formWeight;

  // H2H is a tie-breaker, never the main driver.
  const h2h = headToHead(homeTeam.id, awayTeam.id, validHistory);
  const h2hWeight = clamp(h2h.matches / 5, 0, 1) * 0.055;

  if (h2hWeight > 0) {
    homeWin = homeWin * (1 - h2hWeight) + h2h.homeShare * 100 * h2hWeight;
    draw = draw * (1 - h2hWeight) + h2h.drawShare * 100 * h2hWeight;
    awayWin = awayWin * (1 - h2hWeight) + h2h.awayShare * 100 * h2hWeight;
  }

  const probs = normaliseProbabilities(homeWin, draw, awayWin);

  const matrixTotal = correctedMatrix.reduce((sum, item) => sum + item.probability, 0) || 1;
  const mostLikelyScore = correctedMatrix.reduce((best, current) =>
    current.probability > best.probability ? current : best
  );

  // Market probabilities come directly from the corrected score distribution.
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;

  for (const entry of correctedMatrix) {
    if (entry.home + entry.away > 1.5) over15 += entry.probability;
    if (entry.home + entry.away > 2.5) over25 += entry.probability;
    if (entry.home + entry.away > 3.5) over35 += entry.probability;
    if (entry.home > 0 && entry.away > 0) btts += entry.probability;
  }

  // Confidence rewards strong probability separation, good samples and
  // agreement between the goal and Elo models, but penalizes missing data.
  const maxProb = Math.max(probs.home, probs.draw, probs.away);
  const minProb = Math.min(probs.home, probs.draw, probs.away);
  const spread = maxProb - minProb;

  const goalVsEloAgreement =
    1 - clamp(
      Math.abs(goalProbs.home - eloProbs.home) / 100 +
      Math.abs(goalProbs.away - eloProbs.away) / 100,
      0,
      1
    );

  const sampleQuality = clamp(totalTeamSample / 14, 0, 1);
  const h2hQuality = clamp(h2h.matches / 4, 0, 1);

  const confidence = clamp(
    44 +
      sampleQuality * 22 +
      spread * 0.28 +
      goalVsEloAgreement * 12 +
      h2hQuality * 3,
    45,
    96
  );

  const pick =
    probs.home >= probs.draw && probs.home >= probs.away ? "1" :
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
    modelVersion: "v6",
  };
}

export function buildPredictions(matches, historyByCompetition) {
  return matches
    .map((match) => {
      const code = match.competition?.code;
      const history = historyByCompetition.get(code) || [];

      const prediction = predictMatch({
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        historicalMatches: history.filter(
          (h) => new Date(h.utcDate) < new Date(match.utcDate)
        ),
      });

      return { match, prediction };
    })
    .sort((a, b) => b.prediction.confidence - a.prediction.confidence);
}
