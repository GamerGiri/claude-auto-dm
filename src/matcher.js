const { loadRules } = require('./store');

/**
 * Given a comment's text and the media (reel) ID it was posted on,
 * returns the DM message to send, or null if no rule matches.
 *
 * Priority:
 *   1. Reel-specific rule (if this media ID is configured)
 *   2. Global rule (fallback)
 */
function matchComment(commentText, mediaId) {
  const rules = loadRules();
  const text = commentText.toLowerCase().trim();

  // ── 1. Check reel-specific rules first ────────────────────────────
  const reelRule = rules.reels.find(r => r.mediaId === mediaId && r.active !== false);
  if (reelRule) {
    const matched = reelRule.keywords.find(kw =>
      text.includes(kw.toLowerCase())
    );
    if (matched) {
      return { dm: reelRule.dm, matchedKeyword: matched, source: 'reel', reelTitle: reelRule.title };
    }
  }

  // ── 2. Fall back to global rule ───────────────────────────────────
  if (rules.global && rules.global.active) {
    const matched = rules.global.keywords.find(kw =>
      text.includes(kw.toLowerCase())
    );
    if (matched) {
      return { dm: rules.global.dm, matchedKeyword: matched, source: 'global', reelTitle: null };
    }
  }

  return null;
}

/**
 * Replace {{name}} placeholder in DM template
 */
function renderDM(template, name) {
  return template.replace(/\{\{name\}\}/gi, name);
}

module.exports = { matchComment, renderDM };
