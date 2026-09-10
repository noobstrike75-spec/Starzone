// Simple Poisson-distribution prediction model — the same core idea
// Forebet-style sites use: estimate each team's expected goals from
// recent form, then turn that into win/draw/loss probabilities.

function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function poissonProbability(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// avgGoalsScored / avgGoalsConceded should come from each team's
// last ~10 games, split home vs away.
export function predictMatch({
  homeAvgScored,
  homeAvgConceded,
  awayAvgScored,
  awayAvgConceded,
  maxGoals = 6,
}) {
  // Expected goals for each side, blending their attack vs the
  // opponent's defense.
  const homeExpected = (homeAvgScored + awayAvgConceded) / 2;
  const awayExpected = (awayAvgScored + homeAvgConceded) / 2;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  const scoreProbabilities = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p =
        poissonProbability(homeExpected, h) *
        poissonProbability(awayExpected, a);

      scoreProbabilities.push({ home: h, away: a, probability: p });

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }

  const mostLikelyScore = scoreProbabilities.reduce((best, curr) =>
    curr.probability > best.probability ? curr : best
  );

  return {
    homeExpectedGoals: Number(homeExpected.toFixed(2)),
    awayExpectedGoals: Number(awayExpected.toFixed(2)),
    homeWinProbability: Number((homeWin * 100).toFixed(1)),
    drawProbability: Number((draw * 100).toFixed(1)),
    awayWinProbability: Number((awayWin * 100).toFixed(1)),
    mostLikelyScore: `${mostLikelyScore.home}-${mostLikelyScore.away}`,
  };
       }
