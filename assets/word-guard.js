/**
 * Word Guard Module
 * Prevents saving tickets when restricted or unprofessional words are present
 * Fetches settings dynamically from manifest parameters via client.metadata()
 */

// Mock defaults as fallback if settings not provided
const DEFAULT_RESTRICTED_WORDS = [
];

const DEFAULT_UNPROFESSIONAL_WORDS = [
];

function parseCommaSeparatedWords(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);
}

function buildSearchPatterns(words) {
  // Build case-insensitive regexes that match whole words; allow spaces in phrases
  return words.map(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(\\b${escaped}\\b)`, 'gi');
  });
}

async function getCommentText(client) {
  const data = await client.get([
    'ticket.comment.text',
    'ticket.comment.html',
    'ticket.comment.value',
    'comment.text',
    'comment.html',
    'comment.value'
  ]);

  return (
    data['ticket.comment.text'] ||
    data['ticket.comment.value'] ||
    data['ticket.comment.html'] ||
    data['comment.text'] ||
    data['comment.value'] ||
    data['comment.html'] ||
    ''
  );
}

function findMatches(text, patterns) {
  if (!text) return { matches: [], unique: [] };
  const found = [];
  patterns.forEach(re => {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) found.push(m[1]);
      if (re.lastIndex === m.index) re.lastIndex++; // avoid zero-length loops
    }
  });
  const normalizedToOriginal = new Map();
  found.forEach(w => {
    const key = w.toLowerCase();
    if (!normalizedToOriginal.has(key)) normalizedToOriginal.set(key, w);
  });
  return { matches: found, unique: Array.from(normalizedToOriginal.values()) };
}

async function applyHighlighting(client, originalText, patterns) {
  if (!originalText) return;
  let highlighted = originalText;

  // Replace using HTML span with yellow background and bold text
  patterns.forEach(re => {
    highlighted = highlighted.replace(re, '<span style="background-color:#ffeb3b; font-weight:bold;"><b>$1</b></span>');
  });

  try {
    await client.set('comment.html', highlighted);
  } catch (e) {
    // Fallback to plain text with bold markup
    let bolded = originalText;
    patterns.forEach(re => {
      bolded = bolded.replace(re, '<b>$1</b>');
    });
    try {
      await client.set('comment.text', bolded);
    } catch (e2) {
      // swallow; highlighting is best-effort
    }
  }
}

export async function validateWordGuard(client) {
  try {
    const metadata = await client.metadata();
    const settings = (metadata && metadata.settings) || {};

    const enabled = settings.enableWordGuard !== false; // default on
    if (!enabled) {
      return { isValid: true, matches: [], message: '' };
    }

    const restricted = parseCommaSeparatedWords(settings.restrictedWords).concat(DEFAULT_RESTRICTED_WORDS);
    const unprofessional = parseCommaSeparatedWords(settings.unprofessionalWords).concat(DEFAULT_UNPROFESSIONAL_WORDS);

    const allWords = Array.from(new Set([...restricted, ...unprofessional]));
    const patterns = buildSearchPatterns(allWords);
    console.log('[WordGuard] Active with words:', allWords);
    const text = await getCommentText(client);
    const { unique } = findMatches(text, patterns);
    if (unique.length > 0) {
      await applyHighlighting(client, text, patterns);
      const shown = unique.slice(0, 3).join(', ');
      const more = unique.length > 3 ? ` and ${unique.length - 3} more` : '';
      const message = `Cannot submit: Comment contains restricted/unprofessional words: ${shown}${more}. Please edit and try again.`;
      return { isValid: false, matches: unique, message };
    }
    return { isValid: true, matches: [], message: '' };
  } catch (error) {
    console.warn('[WordGuard] Validation error; allowing save:', error);
    return { isValid: true, matches: [], message: '' };
  }
}

// Backwards compatibility initializer (no longer used; kept in case)
export async function initializeWordGuard(client) {
  try {
    const metadata = await client.metadata();
    const settings = (metadata && metadata.settings) || {};

    const enabled = settings.enableWordGuard !== false; // default on
    if (!enabled) {
      console.log('[WordGuard] Disabled via settings');
      return;
    }

    const restricted = parseCommaSeparatedWords(settings.restrictedWords).concat(DEFAULT_RESTRICTED_WORDS);
    const unprofessional = parseCommaSeparatedWords(settings.unprofessionalWords).concat(DEFAULT_UNPROFESSIONAL_WORDS);

    // De-duplicate and build patterns
    const allWords = Array.from(new Set([...restricted, ...unprofessional]));
    const patterns = buildSearchPatterns(allWords);

    console.log('[WordGuard] Active with words:', allWords);

    client.on('ticket.save', async function() {
      try {
        const result = await validateWordGuard(client);
        if (!result.isValid) return Promise.reject(new Error(result.message));
        return Promise.resolve();
      } catch (err) {
        console.warn('[WordGuard] Validation error; allowing save:', err);
        return Promise.resolve();
      }
    });
  } catch (error) {
    console.error('[WordGuard] Initialization failed:', error);
  }
}


