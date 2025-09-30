/**
 * Placeholder Guard Module
 * TOPS-1216: Configure Zendesk to prevent sending messages with unedited placeholders
 * 
 * This module provides functionality to detect and prevent submission of messages
 * containing unedited placeholders like [Name], {{variable}}, XX, __PLACEHOLDER__, etc.
 */

import { 
  COMBINED_PLACEHOLDER_REGEX, 
  PLACEHOLDER_WHITELIST, 
  PLACEHOLDER_CONFIG 
} from './placeholder-config.js';

/**
 * Detects placeholders in the given text
 * @param {string} text - The text to analyze
 * @returns {Object} Detection result with found placeholders and validation status
 */
export function detectPlaceholders(text) {
  if (!text || typeof text !== 'string') {
    return { isValid: true, placeholders: [], cleanText: text };
  }

  // Strip HTML tags for analysis
  const cleanText = text.replace(/<[^>]+>/g, '').trim();
  
  if (!cleanText) {
    return { isValid: true, placeholders: [], cleanText };
  }

  // Find all potential placeholders
  const matches = cleanText.match(COMBINED_PLACEHOLDER_REGEX) || [];
  
  // Filter out whitelisted patterns
  const actualPlaceholders = matches.filter(match => {
    return !PLACEHOLDER_WHITELIST.some(whitelistPattern => 
      whitelistPattern.test(match)
    );
  });

  const isValid = actualPlaceholders.length === 0;

  if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
    console.log('[PlaceholderGuard] Detection result:', {
      originalText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      cleanText: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''),
      foundMatches: matches,
      actualPlaceholders,
      isValid
    });
  }

  return {
    isValid,
    placeholders: actualPlaceholders,
    cleanText,
    originalText: text
  };
}

/**
 * Validates ticket comment text for placeholders
 * @param {Object} client - ZAF client instance
 * @returns {Promise<Object>} Validation result
 */
export async function validateTicketComment(client) {
  try {
    // Try to get comment text from multiple possible sources
    const data = await client.get([
      'ticket.comment.text',
      'ticket.comment.html', 
      'ticket.comment.value',
      'comment.text',
      'comment.html',
      'comment.value'
    ]);
    console.log('[PlaceholderGuard] Retrieved comment data:', data);
    if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
      console.log('[PlaceholderGuard] Retrieved comment data keys:', Object.keys(data));
    }

    // Choose the first available field from multiple possible sources
    const rawText = data['ticket.comment.text'] || 
                   data['ticket.comment.value'] || 
                   data['ticket.comment.html'] ||
                   data['comment.text'] ||
                   data['comment.value'] ||
                   data['comment.html'] || '';

    console.log('[PlaceholderGuard] 🔍 Raw comment text:', rawText ? `"${rawText.substring(0, 100)}${rawText.length > 100 ? '...' : ''}"` : 'EMPTY');

    const detection = detectPlaceholders(rawText);
    
    console.log('[PlaceholderGuard] 📊 Detection result:', {
      isValid: detection.isValid,
      placeholderCount: detection.placeholders.length,
      placeholders: detection.placeholders
    });
    
    return {
      success: true,
      ...detection,
      source: rawText ? Object.keys(data).find(key => data[key] === rawText) : 'none'
    };

  } catch (error) {
    console.error('[PlaceholderGuard] Error validating comment:', error);
    return {
      success: false,
      error: error.message,
      isValid: true, // Default to valid on error to avoid blocking legitimate submissions
      placeholders: [],
      cleanText: '',
      originalText: ''
    };
  }
}

/**
 * Highlights placeholders in text with HTML styling
 * @param {string} text - The original text
 * @param {Array} placeholders - Array of detected placeholders
 * @returns {string} HTML text with highlighted placeholders
 */
export function highlightPlaceholders(text, placeholders) {
  if (!text || !placeholders || placeholders.length === 0) {
    return text;
  }

  let highlightedText = text;
  
  // Sort placeholders by length (longest first) to avoid partial replacements
  const sortedPlaceholders = [...placeholders].sort((a, b) => b.length - a.length);
  
  sortedPlaceholders.forEach(placeholder => {
    // Escape special regex characters in the placeholder
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPlaceholder})`, 'gi');
    
    highlightedText = highlightedText.replace(regex, 
      `<span class="placeholder-highlight" style="background-color: #ffeb3b; color: #d84315; font-weight: bold; padding: 1px 3px; border-radius: 3px; border: 1px solid #ff9800;"><b>$1</b></span>`
    );
  });
  
  return highlightedText;
}

/**
 * Applies highlighting to the comment editor using ZAF client
 * @param {Object} client - ZAF client instance
 * @param {string} originalText - Original comment text
 * @param {Array} placeholders - Array of detected placeholders
 */
export async function applyPlaceholderHighlighting(client, originalText, placeholders) {
  if (!PLACEHOLDER_CONFIG.HIGHLIGHT_PLACEHOLDERS || !placeholders || placeholders.length === 0) {
    return;
  }

  try {
    console.log('[PlaceholderGuard] 🎨 Applying placeholder highlighting using ZAF client...');
    
    // Method 1: Try to highlight using ZAF comment manipulation
    try {
      // First, try to set HTML content if supported
      const highlightedHTML = highlightPlaceholders(originalText, placeholders);
      await client.set('comment.html', highlightedHTML);
      console.log('[PlaceholderGuard] ✅ Applied HTML highlighting via ZAF comment.html');
      return; // Success, no need to try other methods
    } catch (htmlError) {
      console.log('[PlaceholderGuard] comment.html not supported, trying comment.text with indicators');
      
      // Try to add bold styling to placeholders using HTML tags
      let textWithBold = originalText;
      const sortedPlaceholders = [...placeholders].sort((a, b) => b.length - a.length);
      
      sortedPlaceholders.forEach(placeholder => {
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedPlaceholder})`, 'gi');
        textWithBold = textWithBold.replace(regex, `<b>$1</b>`);
      });
      
      try {
        await client.set('comment.text', textWithBold);
        console.log('[PlaceholderGuard] ✅ Applied bold styling via ZAF comment.text');
        return; // Success with bold styling
      } catch (textError) {
        console.log('[PlaceholderGuard] comment.text modification failed, trying DOM approach');
      }
    }
    
    // Method 3: Create a visual indicator using ZAF client notifications
    const placeholderList = placeholders.slice(0, 3).join(', ');
    const additionalCount = placeholders.length > 3 ? ` and ${placeholders.length - 3} more` : '';
    
    // Method 3.5: Try to use ZAF's editor focus capabilities
    try {
      await client.invoke('editor.focus');
      console.log('[PlaceholderGuard] ✅ Focused editor via ZAF');
    } catch (focusError) {
      console.log('[PlaceholderGuard] ZAF editor.focus not available');
    }
    
    // Method 4: Use ZAF to manipulate the comment editor directly via DOM
    const editorManipulationScript = `
      (function() {
        try {
          console.log('[PlaceholderGuard] 🔍 Searching for comment editor...');
          
          // Find comment editor using multiple selectors
          const editorSelectors = [
            '[data-test-id="comment-body-editor"]',
            '.editor textarea',
            '.comment-editor textarea',
            'textarea[name="comment"]',
            '#comment_body',
            '.zendesk-editor__body',
            '[contenteditable="true"]'
          ];
          
          let editor = null;
          for (const selector of editorSelectors) {
            editor = document.querySelector(selector);
            if (editor) {
              console.log('[PlaceholderGuard] 📝 Found editor:', selector);
              break;
            }
          }
          
          if (!editor) {
            console.warn('[PlaceholderGuard] ❌ No comment editor found');
            return;
          }
          
          // Get current text
          const currentText = editor.value || editor.textContent || editor.innerHTML || '';
          console.log('[PlaceholderGuard] 📄 Current editor text:', currentText.substring(0, 100) + '...');
          
          // Apply highlighting by wrapping placeholders
          const placeholders = ${JSON.stringify(placeholders)};
          let highlightedContent = currentText;
          
          // Sort by length to avoid partial replacements
          const sortedPlaceholders = [...placeholders].sort((a, b) => b.length - a.length);
          
          sortedPlaceholders.forEach(placeholder => {
            // Simple string replacement to avoid regex escaping issues in template strings
            const searchStr = placeholder;
            const replaceStr = editor.tagName.toLowerCase() === 'textarea' ? 
              '<b>' + placeholder + '</b>' : 
              '<span class="zendesk-placeholder-highlight"><b>' + placeholder + '</b></span>';
            
            // Use simple string replacement instead of regex
            while (highlightedContent.includes(searchStr)) {
              highlightedContent = highlightedContent.replace(searchStr, replaceStr);
            }
          });
          
          // Apply the highlighting
          if (editor.tagName.toLowerCase() === 'textarea') {
            editor.value = highlightedContent;
            console.log('[PlaceholderGuard] ✅ Applied bold text styling to placeholders');
          } else if (editor.contentEditable === 'true') {
            editor.innerHTML = highlightedContent;
            console.log('[PlaceholderGuard] ✅ Applied HTML highlighting to contenteditable');
          }
          
          // Add CSS for highlighting
          if (!document.getElementById('placeholder-highlighting-css')) {
            const style = document.createElement('style');
            style.id = 'placeholder-highlighting-css';
            style.textContent = 
              '.zendesk-placeholder-highlight {' +
                'background-color: #ffeb3b !important;' +
                'color: #d84315 !important;' +
                'font-weight: bold !important;' +
                'padding: 1px 3px !important;' +
                'border-radius: 3px !important;' +
                'border: 1px solid #ff9800 !important;' +
                'box-shadow: 0 1px 3px rgba(255, 152, 0, 0.3) !important;' +
                'animation: zendesk-placeholder-pulse 2s ease-in-out infinite !important;' +
              '}' +
              '@keyframes zendesk-placeholder-pulse {' +
                '0%, 100% {' + 
                  'background-color: #ffeb3b;' +
                  'box-shadow: 0 1px 3px rgba(255, 152, 0, 0.3);' +
                '}' +
                '50% {' + 
                  'background-color: #fff176;' +
                  'box-shadow: 0 1px 6px rgba(255, 152, 0, 0.6);' +
                '}' +
              '}';
            document.head.appendChild(style);
          }
          
          // Focus the editor to draw attention
          editor.focus();
          
          // Select the first placeholder if possible
          if (placeholders.length > 0 && editor.setSelectionRange) {
            const firstPlaceholder = placeholders[0];
            const startIndex = highlightedContent.indexOf(firstPlaceholder);
            if (startIndex !== -1) {
              editor.setSelectionRange(startIndex, startIndex + firstPlaceholder.length);
            }
          }
          
        } catch (error) {
          console.error('[PlaceholderGuard] Error in editor manipulation:', error);
        }
      })();
    `;
    
    // Execute the script using ZAF
    try {
      await client.invoke('instances.create', {
        location: 'modal',
        url: `data:text/html,<script>${editorManipulationScript}</script>`
      });
    } catch (instanceError) {
      // Fallback: Try direct execution if available
      console.log('[PlaceholderGuard] ZAF instance creation failed, trying direct execution');
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            eval(editorManipulationScript);
          } catch (evalError) {
            console.error('[PlaceholderGuard] Direct script execution failed:', evalError);
          }
        }, 200);
      }
    }
    
  } catch (error) {
    console.error('[PlaceholderGuard] Error in applyPlaceholderHighlighting:', error);
  }
}

/**
 * Shows notification to agent about placeholder detection
 * @param {Object} client - ZAF client instance
 * @param {Array} placeholders - Array of detected placeholders
 * @param {boolean} isBlocking - Whether this is a blocking error or warning
 */
export function showPlaceholderNotification(client, placeholders, isBlocking = true) {
  const type = isBlocking ? 'error' : 'alert';
  const icon = isBlocking ? '🚫' : '⚠️';
  
  let message;
  
  if (PLACEHOLDER_CONFIG.SHOW_DETAILED_ERRORS && placeholders.length > 0) {
    const placeholderList = placeholders.slice(0, 3).join(', '); // Show max 3 examples
    const additional = placeholders.length > 3 ? ` and ${placeholders.length - 3} more` : '';
    
    message = `${icon} Cannot submit: Message contains unedited placeholders: ${placeholderList}${additional}. Please edit all placeholders before sending.`;
  } else {
    message = `${icon} Cannot submit: Message contains unedited placeholders (e.g. [Name], {{...}}, XX). Please edit all placeholders before sending.`;
  }
  console.log('[PlaceholderGuard] Showing notification:', message);
  // client.invoke('notify', message, type);
  
  if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
    console.warn(`[PlaceholderGuard] ${isBlocking ? 'Blocking' : 'Warning'} notification shown:`, {
      placeholders,
      message
    });
  }
}

/**
 * Main validation function that handles the complete placeholder check workflow
 * @param {Object} client - ZAF client instance
 * @returns {Promise<boolean>} True if valid (allow submission), false if invalid (block submission)
 */
export async function validateAndNotify(client) {
  console.log('[PlaceholderGuard] 🚀 Starting validateAndNotify...');
  
  try {
    const validation = await validateTicketComment(client);
    
    console.log('[PlaceholderGuard] 📋 Validation complete:', {
      success: validation.success,
      isValid: validation.isValid,
      placeholderCount: validation.placeholders?.length || 0
    });
    
    if (!validation.success) {
      // If validation failed due to error, log but don't block
      console.error('[PlaceholderGuard] ❌ Validation failed:', validation.error);
      return true; // Don't block on technical errors - allow submission
    }

    if (!validation.isValid && validation.placeholders.length > 0) {
      console.log('[PlaceholderGuard] 🚫 BLOCKING SUBMISSION - Placeholders found:', validation.placeholders);
      
      // Apply highlighting if enabled
      if (PLACEHOLDER_CONFIG.HIGHLIGHT_PLACEHOLDERS) {
        await applyPlaceholderHighlighting(client, validation.originalText, validation.placeholders);
      }
      
      
      if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
        console.log('[PlaceholderGuard] Placeholders detected:', validation.placeholders);
        console.log('[PlaceholderGuard] Original text:', validation.originalText?.substring(0, 200) + '...');
      }
      
      // Return false to indicate blocking should occur
      return false;
    }

    console.log('[PlaceholderGuard] ✅ ALLOWING SUBMISSION - No placeholders detected');
    return true; // Allow submission - no placeholders found
    
  } catch (error) {
    console.error('[PlaceholderGuard] ⚠️ Unexpected error in validateAndNotify:', error);
    return true; // Don't block on unexpected errors - allow submission
  }
}

/**
 * Creates a DOM observer to watch for submit button clicks as fallback
 * @param {Object} client - ZAF client instance
 * @returns {Object} Observer instance with cleanup method
 */
export function createDOMFallbackObserver(client) {
  let observer = null;
  let timeout = null;

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const startObserver = () => {
    // Look for common Zendesk submit button selectors
    const submitSelectors = [
      '[data-test-id="submit-button"]',
      'button[type="submit"]',
      '.js-submit',
      '[data-test-id="submit_button-button"]',
      'button:contains("Submit")',
      'button:contains("Send")',

    ];

    const handleSubmitClick = async (event) => {
      if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
        console.log('[PlaceholderGuard] DOM fallback: Submit button clicked', event.target);
      }

      try {
        const isValid = await validateAndNotify(client);
        
        if (!isValid) {
          // Prevent the form submission
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          // Also disable the button temporarily to prevent rapid clicking
          const button = event.target;
          const originalDisabled = button.disabled;
          button.disabled = true;
          
          setTimeout(() => {
            button.disabled = originalDisabled;
          }, 2000); // Re-enable after 2 seconds
          
          if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
            console.log('[PlaceholderGuard] DOM fallback: Blocked submission due to placeholders');
          }
          
          return false;
        }
      } catch (error) {
        console.error('[PlaceholderGuard] DOM fallback error:', error);
        // Allow submission on error to avoid breaking the workflow
      }
    };

    // Create mutation observer to watch for submit buttons
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node or its children contain submit buttons
              submitSelectors.forEach(selector => {
                try {
                  const buttons = node.matches && node.matches(selector) ? [node] : 
                                 node.querySelectorAll ? Array.from(node.querySelectorAll(selector)) : [];
                  
                  buttons.forEach(button => {
                    button.addEventListener('click', handleSubmitClick, true);
                    if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
                      console.log('[PlaceholderGuard] DOM fallback: Attached listener to button', button);
                    }
                  });
                } catch (e) {
                  // Ignore selector errors
                }
              });
            }
          });
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also attach to existing buttons
    submitSelectors.forEach(selector => {
      try {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
          button.addEventListener('click', handleSubmitClick, true);
          if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
            console.log('[PlaceholderGuard] DOM fallback: Attached listener to existing button', button);
          }
        });
      } catch (e) {
        // Ignore selector errors
      }
    });

    // Set timeout to cleanup observer
    timeout = setTimeout(() => {
      if (PLACEHOLDER_CONFIG.ENABLE_LOGGING) {
        console.log('[PlaceholderGuard] DOM fallback: Observer timeout reached, cleaning up');
      }
      cleanup();
    }, PLACEHOLDER_CONFIG.DOM_OBSERVER_TIMEOUT);
  };

  // Start the observer
  startObserver();

  return { cleanup };
}
