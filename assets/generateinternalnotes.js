import { fetchWithTimeoutAndRetry } from "./utils.js";
import { apiKey, apiUrl } from "./config.js";

const PENDING_ACTION_KEY = 'zendeskApp_pendingAction';

/**
 * Isolates text between "Request:" and "Outcome:" 
 * and strips HTML tags for a clean plain-text output.
 */
function extractRequestDetails(text) {
  if (!text) return "";

  // 1. Isolate the Request block
  const regex = /Request:(.*?)(?=Outcome:|$)/s;
  const match = text.match(regex);
  
  if (match && match[1]) {
    let extracted = match[1];

    // 2. Remove HTML tags (e.g., </strong>, <br>, <div>)
    extracted = extracted.replace(/<[^>]*>/g, '');

    // 3. Clean up markdown bold artifacts
    extracted = extracted.replace(/\*\*/g, '');

    // 4. Decode HTML entities
    const decoded = extracted
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    return decoded.trim();
  }
  
  return "";
}

/**
 * Maps assignee group IDs to team names
 * @param {number} groupId - The assignee group ID
 * @returns {string|null} Team name or null if not mapped
 */
function getTeamFromGroupId(groupId) {
  const teamMapping = {
      // Documents Teams
      17837467796759: 'docs',                  // Tier 1 - Documents Chat
      29725263631127: 'docs',                  // Tier 1 - Documents Voice
      360003969074: 'docs_escalations',        // Documents Escalations
      20551054863127: 'docs_sme_tier2',        // Documents SME Tier 2
      5478204477591: 'docs_submissions',       // Documents Submissions Team

      // Payments & Trust & Safety
      25283847854615: 'fraud_payments_sv',     // Fraud - Payments and SV
      23396899013015: 'payments_dsat_review',  // Payments DSAT Review
      19885671675543: 'payments_quality',      // Payments Quality
      5693990715159: 'trust_and_safety',       // Trust and Safety
      36723969809303: 'stripe_sme',            // Stripe SME

      // Onboarding & Cohort
      31970000316183: 'white_glove_onboarding',// White Glove Onboarding
      27826875425559: 'zendesk_app_test_cohort',// Zendesk App Test Cohort

      // WOPs (Workplace Ops) Teams
      22520477933335: 'wops_ai',               // WOPs - AI
      1500006549841: 'wops_bug_review',        // WOPs - Bug Review
      17837476387479: 'wops_chats',            // WOPs - Chats
      8246548761623: 'wops_escalations',       // WOPs - Escalations
      23487073749015: 'wops_high_priority',    // WOPs - High Priority [New]
      23337268764567: 'wops_leadership',       // WOPs - Leadership
      26163539451671: 'wops_phone_callback',   // WOPs - Phone Callback
      22384034608407: 'wops_qia',              // WOPs - QIA
      18739690950551: 'wops_quality',          // WOPs - Quality
      23501747794071: 'wops_regular_priority', // WOPs - Regular Priority Queue [New]
      24286963634071: 'wops_sme_consult',      // WOPs - SME Consult
      27540296849175: 'wops_training',         // WOPs - Training
      11409744858391: 'wops_urgent_shifts',    // WOPs - Urgent Shifts
      28949203098007: 'wops_voice_agents',     // WOPs - Voice Channel Agents
      5495272772503: 'wops_web',               // WOPs - Web
      26674826273687: 'wops_tech_support',     // Workplace Ops Tech Support
      6086670320791: 'wpl_suport'              // Workplace Support  
  };

  return teamMapping[groupId] || null;
}

async function generateinternalnotescontainer(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName, isacceptedgroup){
    const aiinternalnotebuttoncontainer = document.getElementById("ctaexternalcontiner"); 
    console.log(assigneegroupid);

    // STAGE 1: HARD BLOCK ACCESS IF ISACCEPTEDGROUP IS FALSE
    if (isacceptedgroup === false) {
        console.log("🛑 Internal Notes Tool stopped: isacceptedgroup is false.");

        const handleBlockUI = () => {
            const targetContainer = document.getElementById("ctaexternalcontiner") || document.body;
            if (targetContainer) {
                targetContainer.innerHTML = `
                    <div class="generate-internal-notes-wrapper" id="generate-internal-notes-wrapper-main">
                        <div class="button-top-header" style="background-color: #fca5a5; color: #991b1b;">
                            Automated Internal Notes Tool — Restricted
                        </div>
                        <hr class="divider">
                        <div style="padding: 20px; text-align: center; background-color: #FFF; border-radius: 8px; margin: 12px; border: 1px solid #fca5a5;">
                            <svg style="width: 40px; height: 40px; color: #ef4444; margin: 0 auto 10px auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                            <h3 style="color: #991b1b; font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">Feature Restricted</h3>
                            <p style="color: #57534e; font-size: 11px; margin: 0; line-height: 1.4;">Your assigned agent group does not have permission to utilize the Automated Internal Notes tool on this ticket.</p>
                        </div>
                    </div>
                `;
            }
        };

        // Align with Zendesk template rendering lifecycle
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", handleBlockUI);
        } else {
            setTimeout(handleBlockUI, 50);
        }

        // Absolute Halt: Terminate this initialization thread immediately
        return;
    }
 
    aiinternalnotebuttoncontainer.innerHTML = `
    <div class="generate-internal-notes-wrapper" id="generate-internal-notes-wrapper-main">
        <div class="button-top-header">Automated Internal Notes Tool
        <span id="closeButton">&times;</span>
        </div>
        <hr class="divider">
            <div id="inner-wraper">
                <div id="button-inner-container" class="generate-internal-notes-contianer inner-content">
                <div id="spinner"></div>
                    <button id="cta-generate-internal-note" title="Generate Internal Note Summary" class="generate-internal-notes-button-cta">
                        <span class="button-text">Generate <strong>Internal Note</strong></span>
                        <span class="lightning-icon"></span>
                    </button>
                </div>
            </div>
        <span class="info-span" id="info-span">Please ensure that relevant ticket fields are updated before generating internal note.</span>
        <span class="info-span-disable" id="info-span-disbale">This feature is currently not available for this Channel Group.</span>

    <div>
        
    `;

    if (assigneegroupid === 28949203098007 || assigneegroupid === 29725263631127) {
        console.log("Voice Channel Ticket detected");
        const wrappercontainer = document.getElementById("generate-internal-notes-wrapper-main")
        wrappercontainer.innerHTML += `
          <div class="voice-indicator" id="voice-indicator-container"> 
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="voice-svg"><path d="M21.384,17.752a2.108,2.108,0,0,1-.522,3.359,7.543,7.543,0,0,1-5.476.642C10.5,20.523,3.477,13.5,2.247,8.614a7.543,7.543,0,0,1,.642-5.476,2.108,2.108,0,0,1,3.359-.522L8.333,4.7a2.094,2.094,0,0,1,.445,2.328A3.877,3.877,0,0,1,8,8.2c-2.384,2.384,5.417,10.185,7.8,7.8a3.877,3.877,0,0,1,1.173-.781,2.092,2.092,0,0,1,2.328.445Z"/></svg>
          Voice Contact
          </div>
        `;
        
    } else {
      console.log("Non-Voice Ticket, procedding.")
    }

    if (closeButton) {
    closeButton.addEventListener('click', () => {
        if (typeof client !== 'undefined' && client) {
        client.invoke('app.close') 
            .then(() => {
            console.log('App Closed');
            })
            .catch(error => {
            console.error('Error invoking app close action:', error);
            });
        } else {
        console.error('ZAF client is not available or not initialized.');
        }
    });
    } else {
    console.error('Close button (#myAppCloseButton) not found after setting innerHTML.');
    }

    const button = document.getElementById("cta-generate-internal-note");
    // Remove all old click handlers and add only one
    button.onclick = () => fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName);

}

/**
 * Makes a secure API request using ZAF's client.request with retry logic.
 * @param {object} client - The ZAF client object.
 * @param {number} ticketID - The requesting ticket id.
 * @param {string} agentId - The users external ID.
 * @param {string} useremail - The email of the ticket requester.
 * @param {string} userfullname - The full name of the ticket requester.
 * @param {number} assigneegroupid - The assigned group id.
 * @param {number} assigneeId - The ID of the ZD agent
 * @returns {Promise<any>} A promise that resolves with the response data.
 */

async function fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName){
    const loadstart = performance.now();
    const eventmodule = "fetch-internal-notes-main";
    const aiinternalnotebutton = document.getElementById("cta-generate-internal-note");
    const spinner = document.getElementById("spinner");

    // Track which agent is using the app
    if (typeof window.cwr === 'function') {
        try {
            const analyticsData = {
                action: 'generate-internal-note-clicked',
                currentAgentId: String(currentAgentId || 'unknown'),
                currentAgentEmail: String(currentAgentEmail || 'unknown'),
                ticketId: String(ticketID),
                assigneeId: String(assigneeId || 'unknown'),
                assigneeGroupId: String(assigneegroupid || 'unknown'),
                assigneeGroupName: String(assigneegroupname || 'unknown'),
                isAssignedToClickingAgent: Boolean(currentAgentId === assigneeId)
            };

            window.cwr('recordEvent', {
                type: "analytics.agent-button-click",
                data: analyticsData
            });
            console.log("✅ AWS RUM event recorded: analytics.agent-button-click", analyticsData);
        } catch (err) {
            console.error("❌ Error recording RUM event:", err);
        }
    } else {
        console.error("❌ window.cwr is not available - RUM not loaded!");
    }

    aiinternalnotebutton.style.display = "none";
    spinner.style.display = "block";

    let requestticketinfo; 
    let requestpayloadBytesize; 

    let contactid;
    let shiftID;
    const team = getTeamFromGroupId(assigneegroupid);
    console.log("Team mapped from group ID:", team);

    await client.get("ticket.customField:custom_field_24673769964823").then((data) => {
      contactid = data["ticket.customField:custom_field_24673769964823"];
      if ((assigneegroupid === 28949203098007 || assigneegroupid === 29725263631127) && !contactid) {
        console.warn("⚠️ No Contact ID found, field is empty.");
        renderwrapupnotes(null, null, null, null, null, null, "nocontactid", null)
        throw new Error ("No contact id found for contact. Unable to compile");
      } else {
        console.log("✅ Contact ID:", contactid);
      } 
    })
    await client.get("ticket.customField:custom_field_6603666641559").then((data) => {
      shiftID = data["ticket.customField:custom_field_6603666641559"];
      if (shiftID === "" || typeof shiftID === "undefined") shiftID = null; // normalize
      console.log("✅ Shift ID:", shiftID);
    }).catch((err) => {
      console.warn("⚠️ Unable to load shift_id custom field:", err);
      shiftID = null; // fail safe
    });

    
    const conversation = await client.get('ticket.conversation');
    console.log("Ticket Convo:", conversation);

    //Extract conversation messages and report byte size
    if (conversation) {
      console.log("Pre Request extracted info:", conversation);

      requestticketinfo = conversation["ticket.conversation"];
      console.log("Request extracted info:", requestticketinfo);

      const jsonString = JSON.stringify(requestticketinfo);
      const encoder = new TextEncoder(); 
      const byteArray = encoder.encode(jsonString);
      requestpayloadBytesize = byteArray.length; 

    console.log(`📦 Request payload (JSON stringified) approximate byte size: ${requestpayloadBytesize} bytes`);       
    } else {
        console.warn("No conversation logs found for ticket");
        throw new Error ("Unable to load conversations");
    }

    // fetch start 
    try {
        let wrapupData;
        let responseSizeBytes;


        try {
            wrapupData = await fetchWithTimeoutAndRetry(client, apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                body: JSON.stringify({ messages : requestticketinfo, ticket_id : ticketID, contact_id: contactid, shift_id: shiftID, team: team, assignee: assigneeId})
            });

            // Calculate response size from the returned data
            if (wrapupData) {
                const responseText = JSON.stringify(wrapupData);
                responseSizeBytes = new Blob([responseText]).size;
                console.log(`📦 Response payload size: ${responseSizeBytes} bytes`);
            }

        } catch (error) {
          const status = error.status || 'No response';
          const statusText = error.statusText || 'Unknown error';
          const errorMsg = `Error fetching shift data: ${status} ${statusText}`;
          console.error("Fetch with retry failed:", errorMsg);
          Sentry.captureMessage(errorMsg);
          cwr('recordError', errorMsg);
          throw new Error(`Error fetching internal notes: ${errorMsg}`);
        } 

        // Check for empty body
        if (!wrapupData) {
            throw new Error(`No response data found: ${wrapupData}`);
        }

        const actionData = {
            action: 'PASTE_INTERNAL_NOTE',
            data: { ticketID, wrapupData, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName }
        };

        sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(actionData));
        console.log("Data saved to sessionStorage. Switching editor view...");

        await client.set('comment.type', 'internalNote');

        await new Promise(resolve => setTimeout(resolve, 100));

        const commentObject = await client.get('comment.text');
        const internalNoteText = commentObject['comment.text'];
        console.log("Content of internal note:", internalNoteText);

          try {
            const loadstart = performance.now();
            const eventmodule = "wrap-up-notes-initialization";

            renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname, null, contactid, internalNoteText, assigneegroupid, assigneegroupname, currentAgentId, currentAgentEmail);

            const loadend = performance.now();
            const loadtime = loadend - loadstart; 
            console.log(`Wrap up notes generated and posted in ${loadtime.toFixed(2)} ms`);

            setTimeout(() => tryRecordPageEvent(eventmodule, loadtime), 1000); 

          } catch (err) {
            console.error("Wrap up notes rendering error:", err);
            Sentry.captureException(err);
            cwr('recordError', err);
            throw new Error("Issue with Internal Notes rendering");
          }
        
        const loadend = performance.now();
        const loadtime = loadend - loadstart;  
        const rumsticketid = ticketID;
        console.log(`Fetch wrap up notes and render completed in ${loadtime.toFixed(2)} ms`);

        setTimeout(() => recordApiEvent(loadtime, rumsticketid, eventmodule, responseSizeBytes, requestpayloadBytesize), 1000);

    } catch (error) {
        console.error("Internal Notes Fetch and rendering error:", error);
        Sentry.captureException(error);
        renderwrapupnotes(null);
        cwr('recordError', error);   
    } finally {
        spinner.style.display = "none";
        aiinternalnotebutton.style.display = "inline-flex";
    }
}

function tryRecordPageEvent(eventmodule, loadtime) {
  const isCwrReady = typeof window.cwr === 'function';

  const data = {
    name: eventmodule,
    duration: loadtime
  };

  if (isCwrReady) {
    window.cwr('recordEvent', {
      type: 'generate-internal-notes-moduleLoad',
      data: data
    });
    console.log(`✅ AWS RUM event recorded (${eventmodule})`, data);
  } else if (attempts < 5) {
    console.warn(`⚠️ AWS RUM cwr not ready for ${eventmodule}, retrying...`);
    setTimeout(() => tryRecordPageEvent(eventmodule, loadtime, attempts + 1), 1000);
  } else {
    console.error(`❌ Failed to record AWS RUM event (${eventmodule}): cwr not ready`);
  }
}

function recordApiEvent(loadtime, rumsticketid, eventmodule, responseSizeBytes, requestpayloadBytesize, attempts = 0) {
  const isCwrReady = typeof window.cwr === 'function';

  const notesfetchrumdata = {
  name: eventmodule,
  duration: loadtime, 
  ticketId: rumsticketid, 
  responseBytesize: responseSizeBytes, 
  requestedBytesize: requestpayloadBytesize
  };

  if (isCwrReady) {
    window.cwr('recordEvent', {
      type: "api.get-internal-notes-resource",
      data: notesfetchrumdata
    });
    console.log("✅ AWS RUM event recorded", notesfetchrumdata);
  } else if (attempts < 5) {
    console.warn(`⚠️ AWS RUM cwr not ready for ${eventmodule}, retrying in 1s...`);
    setTimeout(() => recordApiEvent(loadtime, rumsticketid, eventmodule, responseSizeBytes, requestpayloadBytesize, attempts + 1), 1000);
  } else {
    console.error("❌ Failed to record AWS RUM event: cwr not ready");
  }
}

async function setCurrentTimeToField(client) {
  const now = new Date();

  // Format the time in Pacific Time with date + time
  const formattedTime = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  client.set('ticket.customField:custom_field_34818453277591', formattedTime)
    .then(() => {
      console.log(`Pacific Time set successfully: ${formattedTime}`);
    })
    .catch(err => {
      console.error("Error setting time field:", err);
    });
}

/**
 * Reads and parses the Oracle Co-pilot cache blob from localStorage for a ticket.
 * Centralized so all cache-derived lookups (shift date, shift ids, facility info)
 * share the same parse/error-handling path.
 * @param {string|number} ticketID
 * @returns {object|null} Parsed cache object, or null if unavailable/unparseable.
 */
function getOracleCacheData(ticketID) {
  try {
    const cached = localStorage.getItem(`ai_copilot_${ticketID}`);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.warn('getOracleCacheData: failed to read/parse cache', err);
    return null;
  }
}

/**
 * Reads Oracle full data from localStorage and extracts the formatted shift date.
 * Falls back to null if data is unavailable or unparseable.
 * @param {string|number} ticketID
 * @returns {string|null} Formatted shift date e.g. "05/20 NOC" or null
 */
function getShiftDateFromOracleCache(ticketID) {
  try {
    const data = getOracleCacheData(ticketID);
    if (!data) return null;

    const shiftStartTime = data?.shift_data?.shift_start_time;
    if (!shiftStartTime) return null;

    // Re-use Oracle's existing format helper logic inline
    const commaMatch = shiftStartTime.match(
      /^(\d{4})-(\d{2})-(\d{2})\s*,\s*\d{1,2}:\d{2}\s*(AM|PM)$/i
    );
    if (commaMatch) {
      const [, , month, day, modifier] = commaMatch;
      return `${month}/${day} ${modifier.toUpperCase()}`;
    }

    const isoMatch = shiftStartTime.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):/
    );
    if (isoMatch) {
      const [, , month, day, hourStr] = isoMatch;
      const hour = parseInt(hourStr, 10);
      if (isNaN(hour) || hour < 0 || hour > 23) return null;
      const meridiem = hour < 12 ? 'AM' : 'PM';
      return `${month}/${day} ${meridiem}`;
    }

    return null;
  } catch (err) {
    console.warn('getShiftDateFromOracleCache: failed to read cache', err);
    return null;
  }
}

/**
 * Reads the shift_ids_in_field array from the Oracle cache to determine
 * whether any shift IDs were actually returned/attached for this ticket.
 * @param {string|number} ticketID
 * @returns {Array} Array of shift ids, or empty array if none/unavailable.
 */
function getShiftIdsFromOracleCache(ticketID) {
  try {
    const data = getOracleCacheData(ticketID);
    if (!data) return [];

    const shiftIds = data?.shift_ids_in_field;
    return Array.isArray(shiftIds) ? shiftIds : [];
  } catch (err) {
    console.warn('getShiftIdsFromOracleCache: failed to read cache', err);
    return [];
  }
}

/**
 * Reads the ca_msa_facility flag from the Oracle cache's facility_information block
 * to determine whether the facility is a CA facility.
 * @param {string|number} ticketID
 * @returns {boolean} True if ca_msa_facility === "Yes", false otherwise.
 */
function isCaMsaFacilityFromOracleCache(ticketID) {
  try {
    const data = getOracleCacheData(ticketID);
    if (!data) return false;

    const caMsaFacility = data?.facility_information?.ca_msa_facility;
    return caMsaFacility === "Yes";
  } catch (err) {
    console.warn('isCaMsaFacilityFromOracleCache: failed to read cache', err);
    return false;
  }
}

async function renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname, flag, contactid, internalNoteText, assigneegroupid, assigneegroupname, currentAgentId, currentAgentEmail) {
  const loadstart = performance.now();
  const ticket_id = ticketID;
  const agent_id = agentId;
  const user_email = useremail;
  const user_fullname = userfullname;
  const innercontainer = document.getElementById("inner-wraper");
  const internalnotesfill = wrapupData?.notes;
  const currentDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });

  
  if (flag === "nocontactid"){
    const alertmessage = `
        <div id="error-alert">
            <span onclick="document.getElementById('error-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: #39434b; font-weight: 500;">&times;</span>
                Error! No Contact ID found for voice contact. Please ensure you attach the call to this ticket from the Amazon Connect Control Panel before generating note. 
        </div>
    `;    
    innercontainer.insertAdjacentHTML('beforeEnd', alertmessage);
    return; 
  }

  if (contactid) {
    if (!innercontainer.querySelector('.contact-id-container')) {
      const contactidui = `
          <div class="contact-id-container">
              Contact ID(s) - ${contactid}
          </div>
      `;    
      innercontainer.insertAdjacentHTML('beforeEnd', contactidui);
    }
  }

  if (!wrapupData) {
        const alertmessage = `
            <div id="error-alert">
                <span onclick="document.getElementById('error-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: #39434b; font-weight: 500;">&times;</span>
                    Error! No Conversation found/returned for ticket.
            </div>
        `;    
        innercontainer.insertAdjacentHTML('beforeEnd', alertmessage);        
  } else {
    try {

        console.log("🔄 Rendering Internal Notes");

      const fullnotecontent = `
          <strong>Date:</strong> ${currentDate}<br>
          <strong>ZD Ticket:</strong> ${ticket_id || ticketID}<br>   
          <strong>Name:</strong> ${user_fullname || userfullname} | <strong>External ID:</strong> ${agent_id || agentId} <br>  
          <strong>Email:</strong> ${user_email || useremail}
          <hr>
          ${internalnotesfill}<br><br>
          ${internalNoteText || ''}
      `;

      await client.set('comment.text', fullnotecontent);

      // ── Custom field updates ─────────────────────────────────────────────

      // Field IDs
      const REQUEST_FIELD_ID        = 40159708815895;
      const WORKPLACE_NAME_FIELD    = 40043812430871;
      const SHIFT_DATE_FIELD        = 40043862821399;
      const SHIFT_TYPE_DEFAULT_FIELD = 33639935129751; // dropdown — defaulted when no shift id is found
      const CA_FACILITY_SHIFT_FIELD  = 36343028656663; // checkbox — checked/unchecked based on ca_msa_facility flag (no default value)

      // Default dropdown value/tag used when no shift id is found for the ticket.
      // NOTE: confirm this matches the exact option tag/value configured on the
      // 33639935129751 dropdown field in Zendesk.
      const DEFAULT_SHIFT_TYPE_VALUE = 'Flex::Long-Term Care';

      // Request text — extracted from note content as before
      const requestText = extractRequestDetails(internalnotesfill);

      // Workplace name and shift date/type — read directly from API response payload.
      // Lambda returns: facility_name (string), shift_date ("MM/DD"), shift_type ("AM"/"PM"/"NOC").
      // Shift date field format: "MM/DD TYPE" e.g. "05/20 NOC" — matches existing convention.
      const workplaceName = wrapupData.facility_name || '';
      // Prefer Oracle localStorage cache for shift date — falls back to wrapupData fields
      const cachedShiftDate = getShiftDateFromOracleCache(ticket_id || ticketID);
      const shiftDateRaw    = wrapupData.shift_date  || '';
      const shiftType       = (wrapupData.shift_type || '').toUpperCase();
      const wrapupShiftDate = shiftDateRaw && shiftType
        ? `${shiftDateRaw} ${shiftType}`
        : shiftDateRaw || '';
      const shiftDate =  wrapupShiftDate || cachedShiftDate || '';

      console.log("📋 Extracted Request:",          requestText    || "(none)");
      console.log("🏥 API Workplace Name:",         workplaceName  || "(none)");
      console.log("📅 Oracle Cache Shift Date:",    cachedShiftDate || "(not found)");
      console.log("📅 Wrapup API Shift Date:",      wrapupShiftDate || "(none)");
      console.log("📅 Final Shift Date Used:",      shiftDate      || "(none)");

      // Build the custom_fields array — only include fields that have a value
      const customFieldUpdates = [];

      if (requestText) {
        customFieldUpdates.push({ id: REQUEST_FIELD_ID, value: requestText });
      }
      if (workplaceName) {
        customFieldUpdates.push({ id: WORKPLACE_NAME_FIELD, value: workplaceName });
      }
      if (shiftDate) {
        customFieldUpdates.push({ id: SHIFT_DATE_FIELD, value: shiftDate });
      }

      // ── Shift ID default / CA facility logic ───────────────────────────
      // "Shift id empty" is determined from the Oracle cache's shift_ids_in_field
      // array rather than the ticket custom field alone — if that array is empty
      // (or missing), no shift ids were actually returned/attached for the ticket.
      const shiftIdsInField = getShiftIdsFromOracleCache(ticket_id || ticketID);
      const hasShiftIds = shiftIdsInField.length > 0;

      console.log("🆔 Shift IDs found in cache:", shiftIdsInField.length ? shiftIdsInField : "(none)");

      if (!hasShiftIds) {
        console.log(`⚠️ No shift ids found — defaulting field ${SHIFT_TYPE_DEFAULT_FIELD} to "${DEFAULT_SHIFT_TYPE_VALUE}"`);
        customFieldUpdates.push({ id: SHIFT_TYPE_DEFAULT_FIELD, value: DEFAULT_SHIFT_TYPE_VALUE });

        const isCaMsaFacility = isCaMsaFacilityFromOracleCache(ticket_id || ticketID);
        console.log("🏥 CA MSA facility flag from cache:", isCaMsaFacility);

        // Checkbox field — just reflects whether this is a CA facility, no default value involved.
        customFieldUpdates.push({ id: CA_FACILITY_SHIFT_FIELD, value: isCaMsaFacility });
      }
      // ── End shift id default / CA facility logic ────────────────────────

      // Single API call for all custom field updates
      if (customFieldUpdates.length > 0) {
        try {
          await client.request({
            url: `/api/v2/tickets/${ticket_id || ticketID}.json`,
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
              ticket: { custom_fields: customFieldUpdates }
            })
          });
          console.log("✅ Custom fields updated successfully:", customFieldUpdates);
        } catch (fieldErr) {
          console.error("❌ Failed to update custom fields:", fieldErr);
        }
      } else {
        console.warn("⚠️ No custom field values extracted — skipping field update.");
      }

      // ── End custom field updates ─────────────────────────────────────────
      
      await setCurrentTimeToField(client);

      // Track successful note creation
      if (typeof window.cwr === 'function') {
          try {
              const submissionData = {
                  action: 'internal-note-submitted',
                  currentAgentId: String(currentAgentId || 'unknown'),
                  currentAgentEmail: String(currentAgentEmail || 'unknown'),
                  ticketId: String(ticket_id),
                  assigneeGroupId: String(assigneegroupid || 'unknown'),
                  assigneeGroupName: String(assigneegroupname || 'unknown'),
                  noteLength: Number(fullnotecontent.length),
                  hasContactId: Boolean(contactid)
              };

              window.cwr('recordEvent', {
                  type: "analytics.agent-note-submitted",
                  data: submissionData
              });
              console.log("✅ AWS RUM event recorded: analytics.agent-note-submitted", submissionData);
          } catch (err) {
              console.error("❌ Error recording RUM event:", err);
          }
      } else {
          console.error("❌ window.cwr is not available - RUM not loaded!");
      }

      //Success alert message
      const alertmessage = `
          <div id="success-alert">
              <span onclick="document.getElementById('success-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: #39434b; font-weight: 500;">&times;</span>
                  Successfully generated Internal Note!
          </div>
      `;    
      innercontainer.insertAdjacentHTML('beforeEnd', alertmessage); 

      const loadend = performance.now();
      const loadtime = loadend - loadstart;      
      console.log(`Internal Notes rendered to editor in ${loadtime.toFixed(2)} ms`);
      sessionStorage.removeItem(PENDING_ACTION_KEY);
        
    } catch (error) {
        console.error("Internal Notes render to editor error:", error);
        Sentry.captureException(error);
        cwr('recordError', error); 
        sessionStorage.removeItem(PENDING_ACTION_KEY);
        const alertmessage = `
            <div id="error-main-alert">
                <span onclick="document.getElementById('error-main-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: #39434b; font-weight: 500;">&times;</span>
                    Error! Internal Note Generation Failed.
            </div>
        `;    
        innercontainer.insertAdjacentHTML('beforeEnd', alertmessage); 
    } finally {
        setTimeout(() => {client.invoke('app.close');}, 6000);
    }
  }
}


export {generateinternalnotescontainer, renderwrapupnotes};