const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'damn', 'dick',
  'pussy', 'cock', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut',
  'idiot', 'moron', 'stupid', 'scam', 'fraud', 'fake', 'cheat',
];

/**
 * Returns the first banned word found in any of the provided strings,
 * or null if none found.
 */
function findBannedWord(...texts) {
  const combined = texts.join(' ').toLowerCase();
  return BANNED_WORDS.find((word) => combined.includes(word)) ?? null;
}

/**
 * Throws AppError 400 if any banned word is found.
 * Import AppError lazily to avoid circular deps.
 */
function assertNoProfanity(...texts) {
  const { AppError } = require('./AppError');
  const found = findBannedWord(...texts);
  if (found) {
    throw new AppError(400, 'Inappropriate content detected', 'profanity_filter');
  }
}

module.exports = { findBannedWord, assertNoProfanity };
