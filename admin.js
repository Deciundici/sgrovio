const SUPABASE_URL='https://nijsfyysxvqogjjfawrc.supabase.co';
const SUPABASE_KEY='sb_publishable_YBMEKwWJCtTZsiRBS45hGQ_sDogz1SE';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginView=document.getElementById('loginView');
const dashboard=document.getElementById('dashboard');
const loginBtn=document.getElementById('loginBtn');
const logoutBtn=document.getElementById('logoutBtn');
const refreshBtn=document.getElementById('refreshBtn');
const loginMessage=document.getElementById('loginMessage');
const content=document.getElementById('content');
const searchInput=document.getElementById('search');
const updatedAt=document.getElementById('updatedAt');
let currentTab='richieste';
let data=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(v){try{return new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return'';}}
function badge(v){
  const s=String(v??'').toLowerCase();
  const cls=['accettato','completata','attivo','approvato'].includes(s)?'ok':['nuova','proposto','in_attesa','in_attesa_conferma_cliente'].includes(s)?'warn':['rifiutato','annullata','problema_segnalato'].includes(s)?'bad':'';
  return `<span class="badge ${cls}">${esc(v||'—')}</span>`;
}
function yesNo(v){return v?'<span class="badge ok">Sì</span>':'<span class="badge">No</span>';}
function contains(obj,q){return JSON.stringify(obj??{}).toLowerCase().includes(q.toLowerCase());}
function cleanPhone(v){return String(v||'').replace(/[^0-9+]/g,'');}
function waPhone(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10&&n.startsWith('3'))n='39'+n;return n;}
function contactActions(email,phone){
  const tel=cleanPhone(phone),wa=waPhone(phone);
  const links=[];
  if(tel)links.push(`<a class="primarylink" href="tel:${esc(tel)}">Chiama</a>`);
  if(wa)links.push(`<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`);
  if(email)links.push(`<a href="mailto:${esc(email)}">Email</a>`);
  return links.length?`<div class="actionlinks">${links.join('')}</div>`:'';
}

async function login(){
  loginMessage.textContent='';
  loginBtn.disabled=true;
  loginBtn.textContent='Accesso…';
  try{
    const email=document.getElementById('email').value.trim();
    const password=document.getElementById('password').value;
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error) throw error;
    await openDashboard();
  }catch(error){
    loginMessage.textContent='Accesso non riuscito: '+(error.message||error);
    await db.auth.signOut();
  }finally{
    loginBtn.disabled=false;
    loginBtn.textContent='Accedi';
  }
}

async function openDashboard(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){showLogin();return;}
  const {data:isAdmin,error:adminError}=await db.rpc('is_sgrovio_admin');
  if(adminError||!isAdmin){
    await db.auth.signOut();
    showLogin(false);
    loginMessage.textContent='Questo account non è autorizzato come amministratore Sgrovio.';
    return;
  }
  loginView.classList.add('hidden');
  dashboard.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  await loadData();
}

function showLogin(clear=true){
  dashboard.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  loginView.classList.remove('hidden');
  if(clear) loginMessage.textContent='';
}

async function loadData(){
  refreshBtn.disabled=true;
  refreshBtn.textContent='Aggiornamento…';
  content.innerHTML='<div class="empty">Caricamento dati…</div>';
  const {data:payload,error}=await db.rpc('admin_dashboard_data');
  refreshBtn.disabled=false;
  refreshBtn.textContent='↻ Aggiorna';
  if(error){
    content.innerHTML=`<div class="empty" style="color:#9b1c1c">Errore: ${esc(error.message)}</div>`;
    return;
  }
  data=payload||{};
  renderStats();
  renderTable();
  updatedAt.textContent='Aggiornato '+new Intl.DateTimeFormat('it-IT',{timeStyle:'short'}).format(new Date());
}

function renderStats(){
  const s=data?.stats||{};
  document.getElementById('sRichieste').textContent=s.richieste_totali??0;
  document.getElementById('sNuove').textContent=s.richieste_nuove??0;
  document.getElementById('sClienti').textContent=s.clienti??0;
  document.getElementById('sPro').textContent=s.professionisti_totali??0;
  document.getElementById('sAccettati').textContent=s.matching_accettati??0;
  document.getElementById('sProposti').textContent=s.matching_proposti??0;
  document.getElementById('sDisp').textContent=s.professionisti_disponibili??0;
  document.getElementById('sVerificati').textContent=s.professionisti_verificati??0;
  document.getElementById('sMatching').textContent=s.matching_totali??0;
  document.getElementById('sRecensioni').textContent=s.recensioni??0;
}

function renderTable(){
  if(!data){content.innerHTML='<div class="empty">Nessun dato.</div>';return;}
  const q=searchInput.value.trim();
  if(currentTab==='richieste') return renderRichieste((data.richieste_recenti||[]).filter(x=>!q||contains(x,q)));
  if(currentTab==='professionisti') return renderProfessionisti((data.professionisti_recenti||[]).filter(x=>!q||contains(x,q)));
  if(currentTab==='matching') return renderMatching((data.matching_recenti||[]).filter(x=>!q||contains(x,q)));
  return renderRecensioni((data.recensioni_recenti||[]).filter(x=>!q||contains(x,q)));
}

function renderRichieste(rows){
  if(!rows.length){content.innerHTML='<div class="empty">Nessuna richiesta.</div>';return;}
  content.innerHTML=`<table><thead><tr><th>Data</th><th>Cliente</th><th>Servizio</th><th>Zona</th><th>Descrizione</th><th>Urgenza</th><th>Budget</th><th>Stato</th><th>Contatti</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Data">${esc(fmtDate(r.created_at))}</td><td data-label="Cliente"><strong>${esc(r.nome_cliente||'—')}</strong></td><td data-label="Servizio">${esc(r.categoria||'—')}</td><td data-label="Zona">${esc(r.comune||'—')} ${r.cap?`(${esc(r.cap)})`:''}</td><td data-label="Descrizione" class="desc">${esc(r.descrizione||'')}</td><td data-label="Urgenza">${esc(r.urgenza||'—')}</td><td data-label="Budget">${esc(r.budget||'—')}</td><td data-label="Stato">${badge(r.stato)}</td><td data-label="Contatti">${esc(r.email||'—')}<br>${esc(r.telefono||'—')}${contactActions(r.email,r.telefono)}</td></tr>`).join('')}</tbody></table>`;
}

function renderProfessionisti(rows){
  if(!rows.length){content.innerHTML='<div class="empty">Nessun professionista.</div>';return;}
  content.innerHTML=`<table><thead><tr><th>Data</th><th>Professionista</th><th>Categoria</th><th>Zona</th><th>Raggio</th><th>Disponibile</th><th>Verificato</th><th>Stato</th><th>Contatti</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Data">${esc(fmtDate(r.created_at))}</td><td data-label="Professionista"><strong>${esc(r.attivita||r.nome||'—')}</strong></td><td data-label="Categoria">${esc(r.categoria||'—')}</td><td data-label="Zona">${esc(r.comune||'—')} ${r.provincia?`· ${esc(r.provincia)}`:''}</td><td data-label="Raggio">${r.raggio_km!=null?esc(r.raggio_km)+' km':'—'}</td><td data-label="Disponibile">${yesNo(r.disponibile)}</td><td data-label="Verificato">${yesNo(r.verificato)}</td><td data-label="Stato">${badge(r.stato)}</td><td data-label="Contatti">${esc(r.email||'—')}<br>${esc(r.telefono||'—')}${contactActions(r.email,r.telefono)}</td></tr>`).join('')}</tbody></table>`;
}

function renderMatching(rows){
  if(!rows.length){content.innerHTML='<div class="empty">Nessun matching.</div>';return;}
  content.innerHTML=`<table><thead><tr><th>Data</th><th>Servizio</th><th>Zona</th><th>Professionista</th><th>Compatibilità</th><th>Stato</th><th>Richiesta ID</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Data">${esc(fmtDate(r.created_at))}</td><td data-label="Servizio">${esc(r.categoria||'—')}</td><td data-label="Zona">${esc(r.comune||'—')}</td><td data-label="Professionista"><strong>${esc(r.professionista||'—')}</strong></td><td data-label="Compatibilità">${esc(r.punteggio??0)}%</td><td data-label="Stato">${badge(r.stato)}</td><td data-label="Richiesta ID" style="font-family:monospace;font-size:11px">${esc(r.richiesta_id||'')}</td></tr>`).join('')}</tbody></table>`;
}

function renderRecensioni(rows){
  if(!rows.length){content.innerHTML='<div class="empty">Nessuna recensione.</div>';return;}
  content.innerHTML=`<table><thead><tr><th>Data</th><th>Professionista</th><th>Voto</th><th>Commento</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Data">${esc(fmtDate(r.created_at))}</td><td data-label="Professionista"><strong>${esc(r.professionista||'—')}</strong></td><td data-label="Voto">${'★'.repeat(Math.max(0,Math.min(5,Number(r.voto)||0)))} ${esc(r.voto||'—')}/5</td><td data-label="Commento" class="desc">${esc(r.commento||'—')}</td></tr>`).join('')}</tbody></table>`;
}

loginBtn.onclick=login;
document.getElementById('password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
logoutBtn.onclick=async()=>{await db.auth.signOut();showLogin();};
refreshBtn.onclick=loadData;
searchInput.addEventListener('input',renderTable);
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
  currentTab=btn.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));
  renderTable();
});

(async()=>{const {data:{session}}=await db.auth.getSession();if(session)await openDashboard();})();