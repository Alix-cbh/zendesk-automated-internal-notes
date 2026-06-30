import { generateinternalnotescontainer, renderwrapupnotes } from './generateinternalnotes.js'
import { validateAndNotify, createDOMFallbackObserver } from './placeholder-guard.js'
import { validateWordGuard } from './word-guard.js'

const PENDING_ACTION_KEY = 'zendeskApp_pendingAction';

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const pendingActionJSON = sessionStorage.getItem(PENDING_ACTION_KEY);
    const client = ZAFClient.init();
    await client.invoke("resize", { width: "310px", height: "235px" });

    // Initialize Placeholder Guard - TOPS-1216
    initializePlaceholderGuard(client);

    // --- Fetch accepted_groups from app metadata (same logic as main app) ---
    const metadata = await client.metadata();
    const rawGroups = metadata.settings.accepted_groups || "";
    const acceptedGroups = rawGroups
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));
    console.log("Allowed Groups from Admin Config:", acceptedGroups);

    if (pendingActionJSON) {
      console.log("Pending action found after reload. Resuming...");
      sessionStorage.removeItem(PENDING_ACTION_KEY);

      const pendingAction = JSON.parse(pendingActionJSON);

      if (pendingAction.action === 'PASTE_INTERNAL_NOTE') {
        const ticketID           = pendingAction.data.ticketID;
        const agentId            = pendingAction.data.agentId;
        const useremail          = pendingAction.data.useremail;
        const userfullname       = pendingAction.data.userfullname;
        const assigneegroupid    = pendingAction.data.assigneegroupid;
        const assigneegroupname  = pendingAction.data.assigneegroupname;
        const assigneeId         = pendingAction.data.assigneeId;
        const wrapupData         = pendingAction.data.wrapupData;
        const currentAgentId     = pendingAction.data.currentAgentId;
        const currentAgentEmail  = pendingAction.data.currentAgentEmail;
        const currentAgentName   = pendingAction.data.currentAgentName;

        // Re-evaluate accepted group using the freshly fetched acceptedGroups list.
        const isacceptedgroup = acceptedGroups.includes(assigneegroupid);
        console.log("Pending action — group access granted:", isacceptedgroup);

        if (!isacceptedgroup) {
          console.warn("⛔ Pending action aborted — assignee group not in accepted groups list.");
          return;
        }

        await client.set('comment.type', 'internalNote');

        await generateinternalnotescontainer(
          ticketID, client, agentId, useremail, userfullname,
          assigneegroupid, assigneegroupname, assigneeId,
          currentAgentId, currentAgentEmail, currentAgentName,
          isacceptedgroup
        );
        await renderwrapupnotes(ticketID, client, wrapupData, agentId, useremail, userfullname);
      }
    } else {
      console.log("No pending action. Performing initial app setup.");
      await initApp(client, acceptedGroups);
    }
  } catch (error) {
    console.error("❌ App initialization failed:", error);
    cwr('recordError', error);
    Sentry.captureException(error);
  }
});

async function initApp(client, acceptedGroups) {
  const appLoadStart = performance.now();

  try {
    console.log("🔄 Initializing Internal Notes App");

    const context = await client.context();
    console.log("Context fetched:", context);

    const ticketID = context?.ticketId;

    const assingee = await client.get("ticket.assignee");
    console.log("Assignee fetched", assingee);

    const assigneegroupid   = assingee["ticket.assignee"].group?.id;
    const assigneegroupname = assingee["ticket.assignee"].group?.name;
    const assigneeId        = assingee["ticket.assignee"].user?.id;

    console.log("Ticket Assignee Group ID:", assigneegroupid);
    console.log("Ticket Assignee Group Name:", assigneegroupname);

    // --- Accepted group check (mirrors main app logic) ---
    const isacceptedgroup = acceptedGroups.includes(assigneegroupid);
    console.log("Group access granted:", isacceptedgroup);

    const requesterData = await client.get("ticket.requester");
    console.log("Requester fetched", requesterData);

    const user        = requesterData["ticket.requester"];
    const agentId     = user?.externalId;
    const useremail   = user?.email;
    const userfullname = user?.name;

    // Get current logged-in agent (who is using the app)
    const currentAgentData = await client.get("currentUser");
    console.log("Current Agent Data fetched:", currentAgentData);
    const currentAgent      = currentAgentData["currentUser"];
    const currentAgentId    = currentAgent?.id;
    const currentAgentEmail = currentAgent?.email;
    const currentAgentName  = currentAgent?.name;

    // Get current agent's group
    const currentAgentGroupData  = await client.get("currentUser.groups");
    const currentAgentGroup      = currentAgentGroupData["currentUser.groups"]?.[0];
    const currentAgentGroupId    = currentAgentGroup?.id;
    const currentAgentGroupName  = currentAgentGroup?.name;

    console.log("Current Agent ID:", currentAgentId);
    console.log("Current Agent Email:", currentAgentEmail);
    console.log("Current Agent Name:", currentAgentName);
    console.log("Current Agent Group ID:", currentAgentGroupId);
    console.log("Current Agent Group Name:", currentAgentGroupName);

    localStorage.setItem("ticketId",    ticketID);
    localStorage.setItem("agentID",     agentId);
    localStorage.setItem("useremail",   useremail);
    localStorage.setItem("username",    userfullname);
    localStorage.setItem("username",    assigneegroupid);
    localStorage.setItem("assigneeId",  assigneeId);

    console.log("Ticket Logged for session:", ticketID);
    console.log("Agent ID for session:", agentId);
    console.log("Email Logged for session:", useremail);
    console.log("User Fullname Logged for session:", userfullname);
    console.log("Group ID Logged for session:", assigneegroupid);
    console.log("Assignee ID Logged for session:", assigneeId);

    generateinternalnotescontainer(
      ticketID, client, agentId, useremail, userfullname,
      assigneegroupid, assigneegroupname, assigneeId,
      currentAgentId, currentAgentEmail, currentAgentName,
      isacceptedgroup
    );

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
    setTimeout(() => tryRecordPageEvent(ticketID, loadTime, attempts + 1), 1000);
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

  client.on('ticket.save', async function() {
    console.log('[PlaceholderGuard] ticket.save event fired - starting validation');

    try {
      // 0) Skip all validations for internal notes (only enforce on public replies)
      const visibility  = await client.get(['ticket.comment.isPublic', 'comment.type']);
      const isPublic    = visibility['ticket.comment.isPublic'];
      const commentType = visibility['comment.type'];
      const isInternal  = (isPublic === false) || (String(commentType || '').toLowerCase() === 'internalnote');
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
        return Promise.reject(new Error('⚠️ Message contains unedited placeholders. Please edit all placeholders before submitting.'));
      }

      console.log('[Guards] ✅ All validations passed - allowing save');
      return Promise.resolve();

    } catch (error) {
      console.error('[PlaceholderGuard] ⚠️ Error during validation:', error);
      return Promise.resolve();
    }
  });

  const domObserver = createDOMFallbackObserver(client);
  window.placeholderGuardCleanup = domObserver.cleanup;

  console.log('[PlaceholderGuard] Initialization complete - safeguard active');
}