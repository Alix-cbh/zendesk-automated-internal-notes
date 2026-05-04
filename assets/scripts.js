import { generateinternalnotescontainer, renderwrapupnotes } from './generateinternalnotes.js'
import { validateAndNotify, createDOMFallbackObserver } from './placeholder-guard.js'
import { validateWordGuard } from './word-guard.js'

/*document.addEventListener("DOMContentLoaded", () => {
  initApp();
});*/

const PENDING_ACTION_KEY = 'zendeskApp_pendingAction';

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const pendingActionJSON = sessionStorage.getItem(PENDING_ACTION_KEY);
    const client = ZAFClient.init();
    await client.invoke("resize", { width: "310px", height: "235px" });

    // Initialize Placeholder Guard - TOPS-1216
    initializePlaceholderGuard(client);

          if (pendingActionJSON) {
              console.log("Pending action found after reload. Resuming...");
              sessionStorage.removeItem(PENDING_ACTION_KEY);

              const pendingAction = JSON.parse(pendingActionJSON);
              
              if (pendingAction.action === 'PASTE_INTERNAL_NOTE') {
                  
                  const ticketID = pendingAction.data.ticketID; 
                  const agentId = pendingAction.data.agentId; 
                  const useremail = pendingAction.data.useremail;
                  const userfullname = pendingAction.data.userfullname;
                  const assigneegroupid = pendingAction.data.assigneegroupid;
                  const assigneegroupname = pendingAction.data.assigneegroupname;
                  const assigneeId = pendingAction.data.assigneeId;
                  const wrapupData = pendingAction.data.wrapupData;
                  const currentAgentId = pendingAction.data.currentAgentId;
                  const currentAgentEmail = pendingAction.data.currentAgentEmail;
                  const currentAgentName = pendingAction.data.currentAgentName;

                  await client.set('comment.type', 'internalNote');

                  await generateinternalnotescontainer(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName);
                  await renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname);
              }
          } else {
              console.log("No pending action. Performing initial app setup.");
              await initApp(client);
          }
  } catch (error) {
    console.error("❌ App initialization failed:", error);
    cwr('recordError', error); 
    Sentry.captureException(error);
  }

});

async function initApp(client) {
  const appLoadStart = performance.now();

  try {
    console.log("🔄 Initializing Internal Notes App");

    const context = await client.context();
    console.log("Context fetched:", context);

    const ticketID = context?.ticketId;

    const assingee = await client.get("ticket.assignee");
    console.log("Assigne fetched", assingee);

    const assigneegroupid = assingee["ticket.assignee"].group?.id;
    const assigneegroupname = assingee["ticket.assignee"].group?.name;
    const assigneeId = assingee["ticket.assignee"].user?.id;

    console.log("Ticket Assignee Group ID:", assigneegroupid);
    console.log("Ticket Assignee Group Name:", assigneegroupname);
    
    const requesterData = await client.get("ticket.requester");
    console.log("Requester fetched", requesterData);

    const user = requesterData["ticket.requester"];
    const agentId = user?.externalId;
    const useremail = user?.email;
    const userfullname = user?.name;

    // Get current logged-in agent (who is using the app)
    const currentAgentData = await client.get("currentUser");
    console.log("Current Agent Data fetched:", currentAgentData);
    const currentAgent = currentAgentData["currentUser"];
    const currentAgentId = currentAgent?.id;
    const currentAgentEmail = currentAgent?.email;
    const currentAgentName = currentAgent?.name;

    // Get current agent's group
    const currentAgentGroupData = await client.get("currentUser.groups");
    const currentAgentGroup = currentAgentGroupData["currentUser.groups"]?.[0];
    const currentAgentGroupId = currentAgentGroup?.id;
    const currentAgentGroupName = currentAgentGroup?.name;

    console.log("Current Agent ID:", currentAgentId);
    console.log("Current Agent Email:", currentAgentEmail);
    console.log("Current Agent Name:", currentAgentName);
    console.log("Current Agent Group ID:", currentAgentGroupId);
    console.log("Current Agent Group Name:", currentAgentGroupName);

    localStorage.setItem("ticketId", ticketID);
    localStorage.setItem("agentID", agentId);
    localStorage.setItem("useremail", useremail);
    localStorage.setItem("username", userfullname);
    localStorage.setItem("username", userfullname);
    localStorage.setItem("username", assigneegroupid);
    localStorage.setItem("assigneeId", assigneeId);
    console.log("Ticket Logged for session:", ticketID);
    console.log("Agent ID for session:", agentId);
    console.log("Email Logged for session:", useremail);
    console.log("User Fullname Logged for session:", userfullname);
    console.log("Group ID Logged for session:", assigneegroupid);
    console.log("Assignee ID Logged for session:", assigneeId);

    generateinternalnotescontainer(ticketID, client, agentId, useremail, userfullname, assigneegroupid, assigneegroupname, assigneeId, currentAgentId, currentAgentEmail, currentAgentName);

    const appLoadEnd = performance.now();
    const loadTime = appLoadEnd - appLoadStart;
    console.log(`✅ App initialized in ${loadTime.toFixed(2)} ms`);
    
    setTimeout(() => tryRecordPageEvent(ticketID, loadTime), 1000);
    
  } catch (error) {
    console.error("❌ App initialization failed:", error);
    cwr('recordError', error); 
    Sentry.captureException(error);
  }
}


function tryRecordPageEvent(ticketID, loadTime, attempts = 0) {
  const isCwrReady = typeof window.cwr === 'function';

  const data = {
    name: 'internal-notes-editor-load',
    duration: loadTime,
    ticketId: String(ticketID)
  };
  if (isCwrReady) {
    window.cwr('recordEvent', {
      type: "internal.notes-initialization",
      data: data
    });
    console.log("✅ AWS RUM event recorded", data);
  } else if (attempts < 5) {
    console.warn("⚠️ AWS RUM cwr not ready, retrying...");
    setTimeout(() => tryRecordPageEvent(ticketID, attempts + 1), 1000);
  } else {
    console.error("❌ Failed to record AWS RUM event: cwr not ready");
  }
}

/**
 * Initialize Placeholder Guard functionality
 * TOPS-1216: Configure Zendesk to prevent sending messages with unedited placeholders
 * @param {Object} client - ZAF client instance
 */
function initializePlaceholderGuard(client) {
  console.log('[PlaceholderGuard] Initializing placeholder detection safeguard...');

  // Set up ticket.save event handler - primary mechanism
  client.on('ticket.save', async function() {
    console.log('[PlaceholderGuard] ticket.save event fired - starting validation');
    
    try {
      // 0) Skip all validations for internal notes (only enforce on public replies)
      const visibility = await client.get(['ticket.comment.isPublic', 'comment.type']);
      const isPublic = visibility['ticket.comment.isPublic'];
      const commentType = visibility['comment.type'];
      const isInternal = (isPublic === false) || (String(commentType || '').toLowerCase() === 'internalnote');
      if (isInternal) {
        console.log('[Guards] ℹ️ Internal note detected — skipping validations');
        return Promise.resolve();
      }

      // 1) Placeholder validation
      const placeholdersOk = await validateAndNotify(client);
      

      // 2) Word guard validation (restricted/unprofessional)
      const wgResult = await validateWordGuard(client);
      if (!wgResult.isValid) {
        console.warn('[WordGuard] ❌ Blocking save due to restricted/unprofessional words:', wgResult.matches);
        return Promise.reject(new Error(wgResult.message));
      }

      if (!placeholdersOk) {
        console.warn('[PlaceholderGuard] ❌ Blocking save due to placeholders');
        const errorMessage = '⚠️ Message contains unedited placeholders. Please edit all placeholders before submitting.';
        return Promise.reject(new Error(errorMessage));
      }

      console.log('[Guards] ✅ All validations passed - allowing save');
      return Promise.resolve();
      
    } catch (error) {
      console.error('[PlaceholderGuard] ⚠️ Error during validation:', error);
      // On validation errors, allow submission to avoid breaking workflow
      return Promise.resolve();
    }
  });

  // Set up DOM fallback observer - secondary mechanism for edge cases
  const domObserver = createDOMFallbackObserver(client);
  
  // Store cleanup function for potential future use
  window.placeholderGuardCleanup = domObserver.cleanup;

  console.log('[PlaceholderGuard] Initialization complete - safeguard active');
}



