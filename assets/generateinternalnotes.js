
import { fetchWithTimeoutAndRetry } from "./utils.js";
import { apiKey, apiUrl } from "./config.js";

const PENDING_ACTION_KEY = 'zendeskApp_pendingAction';

async function generateinternalnotescontainer(ticketID, client, agentId, useremail, userfullname, assigneegroupid){
    const aiinternalnotebuttoncontainer = document.getElementById("ctaexternalcontiner"); 
    console.log(assigneegroupid);
 
    aiinternalnotebuttoncontainer.innerHTML = `
    <div class="generate-internal-notes-wrapper">
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
    button.onclick = () => fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid);   

}

async function fetchinternalwrapupnotes(ticketID, client, agentId, useremail, userfullname, assigneegroupid){
    const loadstart = performance.now(); 
    const eventmodule = "fetch-internal-notes-main";
    const aiinternalnotebutton = document.getElementById("cta-generate-internal-note"); 
    const spinner = document.getElementById("spinner");

    aiinternalnotebutton.style.display = "none";
    spinner.style.display = "block";

    let requestticketinfo; 
    let requestpayloadBytesize; 

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
        
        let response;

        try {
            response = await fetchWithTimeoutAndRetry(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },  
                body: JSON.stringify({ messages : requestticketinfo, ticket_id : ticketID })
            });
          } catch (error) {
            console.error("Fetch with retry failed:", error);
            Sentry.captureException(error);
            cwr('recordError', error); 
          } 
          
          console.log(response);

          let status; 
          let statusText;
          let errorMsg; 

          status = response?.status || 'No response';
          statusText = response?.statusText || 'Unknown error';
          errorMsg = `Error fetching wrap-up notes: ${status} ${statusText}`;

        if (!response || !response.ok) { 
          Sentry.captureMessage(errorMsg);
          cwr('recordError', errorMsg);
          throw new Error(`Error fetching wrap up notes data: ${errorMsg}`);
        }

        if (response?.status === 204) { 
          throw new Error("No Conversation Data Scenario/No Content Returned.");
        }

        // Parse the JSON response
        const responseClone = response?.clone(); 
        const blob = await responseClone?.blob();
        
        const responseSizeBytes = blob?.size;
        console.log(`📦 Response payload size: ${responseSizeBytes} bytes`);
        
        // Check for empty body
        const text = await response?.text();
        if (!text) { 
            throw new Error("Not 204 Returned; Empty response body fetched");     
        }

        // Parse only if there's content
        const wrapupData  = JSON.parse(text);

        if (!wrapupData) {
            throw new Error(`No response data found: ${wrapupData}`);
        }

        const actionData = {
            action: 'PASTE_INTERNAL_NOTE',
            data: { ticketID, wrapupData, agentId, useremail, userfullname, assigneegroupid }
        };

        sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(actionData));
        console.log("Data saved to sessionStorage. Switching editor view...");

        await client.set('comment.type', 'internalNote');

        try {
        const loadstart = performance.now();
        const eventmodule = "wrap-up-notes-initialization";

        renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname); 

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

async function renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname) {
  const loadstart = performance.now();
  const ticket_id = ticketID;
  const agent_id = agentId;
  const user_email = useremail;
  const user_fullname = userfullname;
  const innercontainer = document.getElementById("inner-wraper");
  const internalnotesfill = wrapupData?.notes;
  const currentDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });

  if (!wrapupData) {
        const alertmessage = `
            <div id="error-alert">
                <span onclick="document.getElementById('error-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: white; font-weight: 500;">&times;</span>
                    Error! No Conversation found/returned for ticket.
            </div>
        `;    
        innercontainer.insertAdjacentHTML('beforeEnd', alertmessage);        
  } else {
    try {

        console.log("🔄 Rendering Internal Notes");

        // Start - Get custom field data for Internal Note fill (For any additional ticket fields requried)
        
        /*const hexRegex = /^[a-fA-F0-9]{24}$/;
        let shiftIdString; 
        let atLeastOneIdIsValid = false; // Flag to indicate if at least one ID is valid
        let shiftIdsArray;
        let validShiftIds = []; // Array to store only the valid Shift IDs


        await client.get("ticket.customField:custom_field_6603666641559").then((data) => {
        shiftIdString = data ? data["ticket.customField:custom_field_6603666641559"] : null;

              if (!shiftIdString || shiftIdString.trim() === '') {
                  console.warn("Shift ID field is empty.");
                  atLeastOneIdIsValid = false;
              } else {
                  console.log("Fetched Shift ID string:", shiftIdString);

              //Regex Compiler
              shiftIdsArray = shiftIdString.split(/[^a-fA-F0-9]+/).filter(id => id);

              if (shiftIdsArray.length === 0) {
                  console.warn("No potential Shift IDs found after splitting the string.");
                  atLeastOneIdIsValid = false;
                  return; // Exit if no IDs are found
              }
                  
              console.log("Found potential IDs to check:", shiftIdsArray);

                // 2. Use Array.every() to ensure ALL extracted parts are valid.
                validShiftIds = shiftIdsArray.filter(id => {
                  const isValid = hexRegex.test(id);
                    if (!isValid) {
                        console.warn(`❌ Invalid Shift ID found: "${id}"`);
                    }
                    return isValid; 
                });

              atLeastOneIdIsValid = validShiftIds.length > 0;

              if (atLeastOneIdIsValid) {
                  console.log("✅ At least one valid Shift ID was found.");
                  console.log("Array of valid Shift IDs:", validShiftIds);
              } else {
                  console.error("No valid Shift IDs were found in the list.");
              }
            }
        });*/


        // Placoholder command to add response data and fill internal notes to editor and set editor space to internal notes
        // const shiftid = String(validShiftIds);
        // console.log("Final Shift id string:", shiftid);

        /*await client.set('comment.type', 'internalNote').then(() => {
          // This block runs only after client.set has successfully completed
          console.log("Editor switched to internalNote. Now inserting text.");
          
          // Return the next promise in the chain
          client.invoke('ticket.editor.insert', `
              <strong>Date:</strong> ${currentDate}<br>
              <strong>ZD Ticket:</strong> ${ticket_id}<br>  
              <strong>Name:</strong> ${user_fullname} | <strong>External ID:</strong> ${agent_id} <br>  
              <strong>Email:</strong> ${user_email}
              <hr>
              ${internalnotesfill}`);
        }).then(() => {
          // This block runs only after client.invoke has successfully completed
          console.log("Text successfully inserted.");
        }).catch((error) => {
          // This .catch() block will handle any errors from either client.set or client.invoke
          console.error("An error occurred during the set or insert operation:", error);
        });*/

      //await client.set('comment.type', 'internalNote');
      await client.invoke('ticket.editor.insert', `
          <strong>Date:</strong> ${currentDate}<br>
          <strong>ZD Ticket:</strong> ${ticket_id || ticketID}<br>   
          <strong>Name:</strong> ${user_fullname || userfullname} | <strong>External ID:</strong> ${agent_id || agentId} <br>  
          <strong>Email:</strong> ${user_email || useremail}
          <hr>
          ${internalnotesfill}`);
      // Ticket editor insert end
      
      //Success alert message
      const alertmessage = `
          <div id="success-alert">
              <span onclick="document.getElementById('success-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: white; font-weight: 500;">&times;</span>
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
                <span onclick="document.getElementById('error-main-alert').remove();" style="position: absolute; top: 5px; right: 10px; cursor: pointer; font-weight: bold; color: white; font-weight: 500;">&times;</span>
                    Error! Internal Note Generation Failed.
            </div>
        `;    
        innercontainer.insertAdjacentHTML('beforeEnd', alertmessage); 
    } finally {
        setTimeout(() => {client.invoke('app.close');}, 5000);
    }
  }
}


export {generateinternalnotescontainer, renderwrapupnotes}; 