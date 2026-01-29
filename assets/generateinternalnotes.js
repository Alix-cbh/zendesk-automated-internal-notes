
import { fetchWithTimeoutAndRetry } from "./utils.js";
import { apiKey, apiUrl } from "./config.js";

const PENDING_ACTION_KEY = 'zendeskApp_pendingAction';

/**
 * Maps assignee group IDs to team names
 * @param {number} groupId - The assignee group ID
 * @returns {string|null} Team name or null if not mapped
 */
function getTeamFromGroupId(groupId) {
  const teamMapping = {
    17837467796759: 'docs', // Tier 1 - Documents Chat
    29725263631127: 'docs'  // Tier 1 - Documents Voice
  };

  return teamMapping[groupId] || null;
}

async function generateinternalnotescontainer(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneeId, currentAgentId, currentAgentEmail, currentAgentName, currentAgentGroupId, currentAgentGroupName){
    const aiinternalnotebuttoncontainer = document.getElementById("ctaexternalcontiner"); 
    console.log(assigneegroupid);
 
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

    /*if (assigneegroupid === 28949203098007 || assigneegroupid === 29725263631127) {
        console.log("Voice Channel Ticket. Deactivating Button");
        const internalNoteButton = document.getElementById("cta-generate-internal-note");
        const infospan = document.getElementById("info-span");
        const infospandisabled = document.getElementById("info-span-disbale");

        if (internalNoteButton) {
            internalNoteButton.disabled = true;
            internalNoteButton.title = "This feature is not available for the current assignee group.";
            infospan.style.display = "none";
            infospandisabled.style.display = "block";
        }
    } else {
      console.log("Non-Voice Ticket, procedding.")
    }*/

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
    button.onclick = () => fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneeId, currentAgentId, currentAgentEmail, currentAgentName, currentAgentGroupId, currentAgentGroupName);

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

async function fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneeId, currentAgentId, currentAgentEmail, currentAgentName, currentAgentGroupId, currentAgentGroupName){
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
                currentAgentGroupId: String(currentAgentGroupId || 'unknown'),
                currentAgentGroupName: String(currentAgentGroupName || 'unknown'),
                ticketId: String(ticketID),
                assigneeId: String(assigneeId || 'unknown'),
                assigneeGroupId: String(assigneegroupid || 'unknown'),
                team: String(getTeamFromGroupId(assigneegroupid) || 'unknown'),
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
            data: { ticketID, wrapupData, agentId, useremail, userfullname, assigneegroupid, assigneeId, currentAgentId, currentAgentEmail, currentAgentName, currentAgentGroupId, currentAgentGroupName }
        };

        sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(actionData));
        console.log("Data saved to sessionStorage. Switching editor view...");

        await client.set('comment.type', 'internalNote');

        await new Promise(resolve => setTimeout(resolve, 100));

        const commentObject = await client.get('comment.text');
        const internalNoteText = commentObject['comment.text'];
        console.log("Content of internal note:", internalNoteText);

        /*await client.get(['comment.text', 'comment.public']).then(function(data) {
          if (!data['comment.public']) {
            const internalNoteText = data['comment.text'];
            console.log('Internal Note Text:', internalNoteText);
          }
        });*/

        //Poll to confirm the change has been applied before proceeding.
        /*let switched = false;

        for (let i = 0; i < 40; i++) { // Poll for up to 2 seconds (20 * 100ms)
            const currenttpyeinit = await client.get('comment.type');
            const currentType = currenttpyeinit['comment.type'];
            console.log("Current comment type:", currentType);
            if (currentType === 'internalNote') {
                console.log('Comment type successfully switched to internalNote.');
                switched = true;
                break;
            }
            // Wait 100ms before the next check.
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!switched) {
            console.warn('Comment type did not switch in time, but proceeding with rendering anyway.');
        }*/
        
          try {
            const loadstart = performance.now();
            const eventmodule = "wrap-up-notes-initialization";

            renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname, null, contactid, internalNoteText, assigneegroupid, currentAgentId, currentAgentEmail, currentAgentGroupId, currentAgentGroupName);

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

async function renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname, flag, contactid, internalNoteText, assigneegroupid, currentAgentId, currentAgentEmail, currentAgentGroupId, currentAgentGroupName) {
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
      // Ticket editor insert end

      await setCurrentTimeToField(client);

      // Track successful note creation
      if (typeof window.cwr === 'function') {
          try {
              const submissionData = {
                  action: 'internal-note-submitted',
                  currentAgentId: String(currentAgentId || 'unknown'),
                  currentAgentEmail: String(currentAgentEmail || 'unknown'),
                  currentAgentGroupId: String(currentAgentGroupId || 'unknown'),
                  currentAgentGroupName: String(currentAgentGroupName || 'unknown'),
                  ticketId: String(ticket_id),
                  team: String(getTeamFromGroupId(assigneegroupid) || 'unknown'),
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