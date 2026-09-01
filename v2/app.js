import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInAnonymously}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getDatabase,limitToLast,onChildAdded,onChildChanged,onDisconnect,onValue,push,query,ref,serverTimestamp,set,update}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const ROOT="bridge/wake-poc/v1";
const WORKER_URL="https://moonshadow-wake-relay-poc.joshcomstock9777.workers.dev";
const requests=new Map(),responses=new Map();
const sessionId=crypto.randomUUID();
let db,user,listenersStarted=false;
const el=id=>document.getElementById(id);
el("session-id").textContent=sessionId.slice(0,8);

function escapeHtml(value=""){return String(value).replace(/[&<>'\"]/g,c=>({"&":"&","<":"<",">":">","'":"&#39;",'"':'"'}[c]));}
function setStatus(title,detail,online=false){el("status-title").textContent=title;el("status-detail").textContent=detail;el("status-dot").classList.toggle("online",online);}
function stamp(){el("last-sync").textContent=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"});}
function when(value){return new Date(value||Date.now()).toLocaleString([],{dateStyle:"short",timeStyle:"medium"});}

function setBanner(title,detail){
  const banner=el("truth-banner");
  if(!banner)return;
  const strong=banner.querySelector("strong");
  const span=banner.querySelector("span");
  if(strong)strong.textContent=title;
  if(span)span.textContent=detail;
}

async function pingWorker(){
  try{
    const health=await fetch(WORKER_URL,{headers:{accept:"application/json"}}).then(r=>r.json());
    if(!health?.ok){
      setBanner("WORKER UNREACHABLE","Health check did not return ok.");
      return;
    }
    const probe=await fetch(WORKER_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({correlationId:crypto.randomUUID(),sender:"Josh",target:"Amber",message:"health probe",schemaVersion:1})
    }).then(r=>r.json()).catch(()=>({ok:false,error:"probe failed"}));
    if(probe.ok){
      setBanner("WAKE RELAY LIVE",`${health.service} · agents ${ (health.agents||[]).length } · LLM responding`);
    }else{
      setBanner("WORKER UP · LLM DEAD",`${health.service} is running. Model providers failed. Queue will mark wakes failed until a real key is set on the worker.`);
    }
  }catch(error){
    setBanner("WORKER UNREACHABLE",String(error?.message||error));
  }
}

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
  const requestRef=push(ref(db,`${ROOT}/requests`));

  await set(requestRef,{
    correlationId,sender,target,message,status:"queued",sessionId,
    uid:user.uid,createdAt:Date.now(),serverCreatedAt:serverTimestamp(),schemaVersion:1
  });

  try{
    await update(requestRef,{status:"processing",processingAt:Date.now()});

    const workerResponse=await fetch(WORKER_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({correlationId,sender,target,message,schemaVersion:1})
    });

    const result=await workerResponse.json().catch(()=>({}));
    if(!workerResponse.ok||!result.ok){
      throw new Error(result.error||`Worker failed with status ${workerResponse.status}`);
    }
    if(result.correlationId!==correlationId){
      throw new Error("Worker returned a mismatched correlation ID.");
    }

    await push(ref(db,`${ROOT}/responses`),{
      correlationId,
      requestKey:requestRef.key,
      worker:result.worker||target,
      message:result.message,
      model:result.model||"unknown",
      status:"completed",
      createdAt:result.createdAt||Date.now(),
      serverCreatedAt:serverTimestamp(),
      schemaVersion:1
    });

    await update(requestRef,{
      status:"completed",
      completedAt:Date.now(),
      serverCompletedAt:serverTimestamp()
    });

    return correlationId;
  }catch(error){
    await update(requestRef,{
      status:"failed",
      failedAt:Date.now(),
      error:String(error?.message||error).slice(0,240)
    }).catch(()=>{});
    throw error;
  }
}

el("wake-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=el("send"),message=el("message").value.trim();
  if(!message)return;
  button.disabled=true;
  setStatus("WORKER PROCESSING","Request queued · calling API worker",true);
  try{
    const id=await sendRequest(message,el("sender").value,el("target").value);
    el("message").value="";
    setStatus("RESPONSE RETURNED",`Correlation ${id.slice(0,8)} · completed`,true);
  }catch(error){
    setStatus("WAKE RELAY FAILED",error.message,false);
    alert(`Wake request failed: ${error.message}`);
  }finally{
    button.disabled=false;
  }
});

async function connect(){
  if(!window.__FIREBASE_CONFIG__)throw new Error("Firebase runtime configuration is unavailable.");
  const app=initializeApp(window.__FIREBASE_CONFIG__);
  const auth=getAuth(app);
  db=getDatabase(app);

  onAuthStateChanged(auth,async current=>{
    if(!current)return;
    user=current;
    try{
      const presence=ref(db,`${ROOT}/presence/${sessionId}`);
      await onDisconnect(presence).remove();
      await set(presence,{uid:user.uid,online:true,connectedAt:serverTimestamp()});
      setStatus("V2 QUEUE CONNECTED","Isolated Firebase namespace authenticated",true);
      if(listenersStarted)return;
      listenersStarted=true;

      onValue(ref(db,".info/connected"),snapshot=>{
        setStatus(
          snapshot.val()?"V2 QUEUE CONNECTED":"RECONNECTING",
          snapshot.val()?"Isolated Firebase namespace authenticated":"Waiting for Firebase…",
          Boolean(snapshot.val())
        );
      });

      const requestQuery=query(ref(db,`${ROOT}/requests`),limitToLast(100));
      const storeRequest=snapshot=>{
        requests.set(snapshot.key,{key:snapshot.key,...snapshot.val()});
        render();stamp();
      };
      onChildAdded(requestQuery,storeRequest,error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
      onChildChanged(requestQuery,storeRequest,error=>setStatus("V2 BACKEND BLOCKED",error.message,false));

      onChildAdded(query(ref(db,`${ROOT}/responses`),limitToLast(100)),snapshot=>{
        const value=snapshot.val();
        if(value?.correlationId)responses.set(value.correlationId,{key:snapshot.key,...value});
        render();stamp();
      },error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
    }catch(error){
      setStatus("V2 BACKEND BLOCKED",error.message,false);
    }
  });

  await signInAnonymously(auth);
}

render();
pingWorker();
connect().catch(error=>setStatus("V2 BACKEND BLOCKED",error.message,false));
