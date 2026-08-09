import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInAnonymously}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getDatabase,limitToLast,onChildAdded,onDisconnect,onValue,push,query,ref,serverTimestamp,set}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const ROOT="bridge/wake-poc/v1";
const requests=new Map(),responses=new Map();
const sessionId=crypto.randomUUID();
let db,user,listenersStarted=false;
const el=id=>document.getElementById(id);
el("session-id").textContent=sessionId.slice(0,8);

function escapeHtml(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(title,detail,online=false){el("status-title").textContent=title;el("status-detail").textContent=detail;el("status-dot").classList.toggle("online",online);}
function stamp(){el("last-sync").textContent=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"});}
function when(value){return new Date(value||Date.now()).toLocaleString([],{dateStyle:"short",timeStyle:"medium"});}

function render(){
  const items=[...requests.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  el("request-count").textContent=`${items.length} request${items.length===1?"":"s"}`;
  if(!items.length){el("feed").innerHTML='<p class="empty">Waiting for the first isolated V2 request.</p>';return;}
  el("feed").innerHTML=items.map(item=>{
    const response=responses.get(item.correlationId);
    const request=`<article><div class="meta"><strong>${escapeHtml(item.sender)} → ${escapeHtml(item.target)}</strong><span>${escapeHtml(when(item.createdAt))}</span></div><p>${escapeHtml(item.message)}</p><div class="tags"><span class="tag ${escapeHtml(item.status||"queued")}">${escapeHtml((item.status||"queued").toUpperCase())}</span><span class="tag">ID ${escapeHtml(item.correlationId)}</span></div></article>`;
    if(!response)return request;
    return request+`<article class="response"><div class="meta"><strong>${escapeHtml(response.worker||item.target)} RESPONSE</strong><span>${escapeHtml(when(response.createdAt))}</span></div><p>${escapeHtml(response.message)}</p><div class="tags"><span class="tag ${escapeHtml(response.status||"completed")}">${escapeHtml((response.status||"completed").toUpperCase())}</span><span class="tag">MATCHED ${escapeHtml(response.correlationId)}</span></div></article>`;
  }).join("");
  el("feed").scrollTop=el("feed").scrollHeight;
}

async function sendRequest(message,sender,target){
  if(!db||!user)throw new Error("V2 is not connected yet.");
  const correlationId=crypto.randomUUID();
  await push(ref(db,`${ROOT}/requests`),{correlationId,sender,target,message,status:"queued",sessionId,uid:user.uid,createdAt:Date.now(),serverCreatedAt:serverTimestamp(),schemaVersion:1});
  return correlationId;
}

el("wake-form").addEventListener("submit",async event=>{
  event.preventDefault();const button=el("send"),message=el("message").value.trim();if(!message)return;
  button.disabled=true;
  try{const id=await sendRequest(message,el("sender").value,el("target").value);el("message").value="";setStatus("REQUEST QUEUED",`Correlation ${id.slice(0,8)} · awaiting worker`,true);}
  catch(error){setStatus("V2 BACKEND BLOCKED",error.message,false);alert(`Wake request not sent: ${error.message}`);}
  finally{button.disabled=false;}
});

async function connect(){
  if(!window.__FIREBASE_CONFIG__)throw new Error("Firebase runtime configuration is unavailable.");
  const app=initializeApp(window.__FIREBASE_CONFIG__);const auth=getAuth(app);db=getDatabase(app);
  onAuthStateChanged(auth,async current=>{
    if(!current)return;user=current;
    try{
      const presence=ref(db,`${ROOT}/presence/${sessionId}`);
      await onDisconnect(presence).remove();
      await set(presence,{uid:user.uid,online:true,connectedAt:serverTimestamp()});
      setStatus("V2 QUEUE CONNECTED","Isolated Firebase namespace authenticated",true);
      if(listenersStarted)return;listenersStarted=true;
      onValue(ref(db,".info/connected"),snapshot=>setStatus(snapshot.val()?"V2 QUEUE CONNECTED":"RECONNECTING",snapshot.val()?"Isolated Firebase namespace authenticated":"Waiting for Firebase…",Boolean(snapshot.val())));
      onChildAdded(query(ref(db,`${ROOT}/requests`),limitToLast(100)),snapshot=>{requests.set(snapshot.key,{key:snapshot.key,...snapshot.val()});render();stamp();},error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
      onChildAdded(query(ref(db,`${ROOT}/responses`),limitToLast(100)),snapshot=>{const value=snapshot.val();if(value?.correlationId)responses.set(value.correlationId,{key:snapshot.key,...value});render();stamp();},error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
    }catch(error){setStatus("V2 BACKEND BLOCKED",error.message,false);}
  });
  await signInAnonymously(auth);
}

render();connect().catch(error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
