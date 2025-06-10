import { generateinternalnotescontainer } from './generateinternalnotes.js'

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  const appLoadStart = performance.now();

  try {
    console.log("🔄 Initializing Internal Notes App");
    
    const client = ZAFClient.init();
    await client.invoke("resize", { width: "310px", height: "235px" });


    const context = await client.context();
    console.log("Context fetched:", context);

    const ticketID = context?.ticketId;

    const assingee = await client.get("ticket.assignee");
    console.log("Assigne fetched", assingee);

    const assigneegroupid = assingee["ticket.assignee"].group?.id;
    
    const requesterData = await client.get("ticket.requester");
    console.log("Requester fetched", requesterData);

    const user = requesterData["ticket.requester"];
    const agentId = user?.externalId;
    const useremail = user?.email;
    const userfullname = user?.name;

    localStorage.setItem("ticketId", ticketID);
    localStorage.setItem("agentID", agentId);
    localStorage.setItem("useremail", useremail);
    localStorage.setItem("username", userfullname);
    localStorage.setItem("username", userfullname);
    localStorage.setItem("username", assigneegroupid);
    console.log("Ticket Logged for session:", ticketID);
    console.log("Agent ID for session:", agentId);
    console.log("Email Logged for session:", useremail);
    console.log("User Fullname Logged for session:", userfullname);
    console.log("Group ID Logged for session:", assigneegroupid);

    const ticketchannel = await client.get('ticket.via'); 
    console.log("Ticket Channel:", ticketchannel);

    generateinternalnotescontainer(ticketID, client, ticketchannel, agentId, useremail, userfullname, assigneegroupid);

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



