// Fuzzy matching and spelling correction utilities

/**
 * Calculate Levenshtein distance between two strings
 */
export const levenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }

  return dp[m][n];
};

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export const similarityRatio = (str1, str2) => {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
};

/**
 * Find best matches from a list of candidates
 */
export const findBestMatches = (query, candidates, threshold = 0.6, maxResults = 5) => {
  const matches = candidates
    .map(candidate => ({
      candidate,
      similarity: similarityRatio(query, candidate)
    }))
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);

  return matches.map(match => match.candidate);
};

/**
 * Get "Did you mean?" suggestion
 */
export const getDidYouMean = (query, candidates, threshold = 0.7) => {
  const matches = findBestMatches(query, candidates, threshold, 1);
  return matches.length > 0 ? matches[0] : null;
};

/**
 * Check if strings are similar enough to be considered a match
 */
export const areSimilar = (str1, str2, threshold = 0.8) => {
  return similarityRatio(str1, str2) >= threshold;
};
