/**
 * Configuration file for placeholder detection patterns
 * TOPS-1216: Configure Zendesk to prevent sending messages with unedited placeholders
 */

export const PLACEHOLDER_PATTERNS = {
  SQUARE_BRACKETS: /\[[^\]]*\]/g,
  BARE_LEFT_BRACKET: /\[/g,
  BARE_RIGHT_BRACKET: /\]/g,
  
  DUMMY_TOKENS: /\bXX+\b/gi,
  
  UNDERSCORE_PLACEHOLDERS: /__[A-Za-z0-9_]+__/g,
  
  CUSTOM_PATTERNS: [/\[.*?\]/g]
};

export const COMBINED_PLACEHOLDER_REGEX = new RegExp(
  [
    PLACEHOLDER_PATTERNS.SQUARE_BRACKETS.source,
    PLACEHOLDER_PATTERNS.BARE_LEFT_BRACKET.source,
    PLACEHOLDER_PATTERNS.BARE_RIGHT_BRACKET.source,
    PLACEHOLDER_PATTERNS.DUMMY_TOKENS.source,
    PLACEHOLDER_PATTERNS.UNDERSCORE_PLACEHOLDERS.source,
    ...PLACEHOLDER_PATTERNS.CUSTOM_PATTERNS.map(pattern => pattern.source || pattern)
  ].join('|'),
  'gi'
);

export const PLACEHOLDER_WHITELIST = [
];

/**
 * Configuration options for placeholder detection behavior
 */
export const PLACEHOLDER_CONFIG = {
  // Whether to block submission completely or just warn
  BLOCK_SUBMISSION: true,
  
  // Whether to show detailed error messages
  SHOW_DETAILED_ERRORS: true,
  
  // Whether to highlight detected placeholders in the message
  HIGHLIGHT_PLACEHOLDERS: true,
  
  // Timeout for DOM fallback observer (in milliseconds)
  DOM_OBSERVER_TIMEOUT: 30000,
  
  // Whether to log detection events for debugging
  ENABLE_LOGGING: true,
  
  // Whether to use Promise.reject() for blocking (true) or return false (false)
  // Promise.reject() shows ZAF error message, return false uses custom notification
  USE_PROMISE_REJECT: true
};
