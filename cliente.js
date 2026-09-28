const SUPABASE_URL='https://nijsfyysxvqogjjfawrc.supabase.co';
const SUPABASE_KEY='sb_publishable_YBMEKwWJCtTZsiRBS45hGQ_sDogz1SE';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginView=document.getElementById('loginView');
const accountView=document.getElementById('accountView');
const emailInput=document.getElementById('email');
const passwordInput=document.getElementById('password');
const message=document.getElementById('message');
const accountEmail=document.getElementById('accountEmail');
const introText=accountView.querySelector('.muted:not(#accountEmail)');

document.getElementById('loginBtn').addEventListener('click',login);
document.getElementById('logoutBtn').addEventListener('click',logout);
passwordInput.addEventListener('keydown',e=>{if(e.key==='Enter')login();});

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function cleanPhone(v){return String(v||'').replace(/[^0-9+]/g,'');}
function waPhone(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10&&n.startsWith('3'))n='39'+n;return n;}
function statoLabel(r,pros){
  if(r.stato==='completata')return'Completata';
  if(r.stato==='annullata')return'Annullata';
  if(r.stato==='in_attesa_conferma_cliente')return'Da confermare';
  if(r.stato==='problema_segnalato')return'Problema segnalato';
  if(pros.length)return'Professionista trovato';
  return'In attesa';
}
function statoInfo(r,pros){
  if(r.stato==='completata')return'Lavoro concluso e confermato. La richiesta resta nel tuo storico.';
  if(r.stato==='annullata')return'Questa richiesta è stata annullata.';
  if(r.stato==='in_attesa_conferma_cliente')return'Il professionista ha indicato il lavoro come eseguito. Conferma solo se il lavoro è davvero concluso.';
  if(r.stato==='problema_segnalato')return'Hai segnalato un problema. Il lavoro non è stato chiuso come completato.';
  if(pros.length)return'Un professionista ha accettato la richiesta. Puoi contattarlo qui sotto.';
  return'Sgrovio sta cercando un professionista compatibile.';
}
function fmtDate(v){try{return new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return'';}}

async function login(){message.textContent='';const email=emailInput.value.trim();const password=passwordInput.value;if(!email||!password){message.textContent='Inserisci email e password.';return;}const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){message.textContent='Accesso non riuscito: '+error.message;return;}await showAccount(data.user);}

async function showAccount(user){loginView.style.display='none';accountView.style.display='block';accountEmail.textContent='Account: '+(user?.email||'');if(introText)introText.textContent='Qui trovi le tue richieste e i professionisti che le hanno accettate.';ensureActions();await loadRequests(user.id);}

function ensureActions(){let bar=document.getElementById('clientActions');if(bar)return;bar=document.createElement('div');bar.id='clientActions';bar.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:18px 0';bar.innerHTML='<a href="./#richiesta" style="padding:11px 15px;border-radius:9px;background:#173f2c;color:white;text-decoration:none;font-weight:800">+ Nuova richiesta</a><button id="refreshRequests" style="margin:0;background:#fff;color:#173f2c;border:1px solid #173f2c">Aggiorna</button>';accountView.insertBefore(bar,document.getElementById('logoutBtn'));document.getElementById('refreshRequests').onclick=async()=>{const{data:{user}}=await sb.auth.getUser();if(user)await loadRequests(user.id);};}

async function acceptedProfessionals(richiestaId){const {data:matches,error:matchError}=await sb.from('matching').select('professionista_id,punteggio,stato').eq('richiesta_id',richiestaId).eq('stato','accettato');if(matchError||!matches?.length)return[];const ids=[...new Set(matches.map(m=>m.professionista_id).filter(Boolean))];if(!ids.length)return[];const {data:pros,error:proError}=await sb.from('professionisti').select('id,nome,attivita,telefono,email,categoria').in('id',ids);if(proError||!pros?.length)return[];return pros.map(p=>({...p,punteggio:matches.find(m=>m.professionista_id===p.id)?.punteggio??null}));}

function renderProfessional(p){const tel=cleanPhone(p.telefono),wa=waPhone(p.telefono),nome=p.attivita||p.nome||'Professionista Sgrovio';return `<div style="margin-top:16px;padding:16px;border:1px solid #b9dec5;border-radius:12px;background:#edf8f0"><div style="font-weight:900;color:#176735">✓ Professionista disponibile</div><h4 style="margin:10px 0 6px;font-size:18px">${esc(nome)}</h4><p style="margin:6px 0"><strong>Servizio:</strong> ${esc(p.categoria||'Non indicato')}</p>${p.punteggio!=null?`<p style="margin:6px 0"><strong>Compatibilità:</strong> ${esc(p.punteggio)}%</p>`:''}<p style="margin:6px 0"><strong>Telefono:</strong> ${esc(p.telefono||'Non indicato')}</p><p style="margin:6px 0"><strong>Email:</strong> ${esc(p.email||'Non indicata')}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${tel?`<a href="tel:${esc(tel)}" style="padding:10px 14px;border-radius:9px;background:#173f2c;color:#fff;text-decoration:none;font-weight:800">Chiama</a>`:''}${wa?`<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener" style="padding:10px 14px;border-radius:9px;background:#173f2c;color:#fff;text-decoration:none;font-weight:800">WhatsApp</a>`:''}${p.email?`<a href="mailto:${esc(p.email)}" style="padding:10px 14px;border-radius:9px;border:1px solid #173f2c;color:#173f2c;text-decoration:none;font-weight:800">Email</a>`:''}</div></div>`;}

async function confermaCompletamento(id){
  if(!confirm('Confermi che il lavoro è stato eseguito e può essere chiuso come completato?'))return;
  const{error}=await sb.rpc('conferma_completamento_cliente',{p_richiesta_id:id});
  if(error){alert('Errore: '+error.message);return;}
  const{data:{user}}=await sb.auth.getUser();
  if(user)await loadRequests(user.id);
}

async function segnalaProblema(id){
  if(!confirm('Vuoi segnalare che il lavoro non può ancora essere considerato completato?'))return;
  const{error}=await sb.rpc('segnala_problema_cliente',{p_richiesta_id:id});
  if(error){alert('Errore: '+error.message);return;}
  const{data:{user}}=await sb.auth.getUser();
  if(user)await loadRequests(user.id);
}
window.confermaCompletamento=confermaCompletamento;
window.segnalaProblema=segnalaProblema;

async function loadRequests(userId){
  let panel=document.getElementById('clientRequests');
  if(!panel){panel=document.createElement('div');panel.id='clientRequests';panel.style.marginTop='22px';accountView.insertBefore(panel,document.getElementById('clientActions')||document.getElementById('logoutBtn'));}
  panel.innerHTML='<p class="muted">Caricamento richieste…</p>';
  const {data,error}=await sb.from('richieste').select('id,categoria,descrizione,comune,cap,budget,urgenza,stato,created_at').eq('user_id',userId).order('created_at',{ascending:false});
  if(error){panel.innerHTML='<p class="message">Errore nel caricamento: '+esc(error.message)+'</p>';return;}
  if(!data?.length){panel.innerHTML='<div style="margin:16px 0;padding:20px;border:1px solid #e4dfd6;border-radius:14px;background:#fff"><strong>Nessuna richiesta</strong><p class="muted">Non hai ancora creato richieste.</p><a href="./#richiesta" style="font-weight:800;color:#173f2c">Crea la prima richiesta →</a></div>';return;}
  panel.innerHTML='<h2 style="margin:0 0 14px">Le tue richieste</h2>';
  for(const r of data){
    const pros=await acceptedProfessionals(r.id);
    const label=statoLabel(r,pros),info=statoInfo(r,pros);
    const card=document.createElement('div');
    card.style.cssText='margin:0 0 14px;padding:18px;border:1px solid #e4dfd6;border-radius:14px;background:#fff';
    const awaitingConfirmation=r.stato==='in_attesa_conferma_cliente'&&pros.length;
    const badgeBg=r.stato==='completata'?'#e8eefb':r.stato==='problema_segnalato'?'#fff0f0':r.stato==='in_attesa_conferma_cliente'?'#fff7df':'#edf8f0';
    const badgeColor=r.stato==='completata'?'#264b8f':r.stato==='problema_segnalato'?'#8b1e1e':r.stato==='in_attesa_conferma_cliente'?'#7a5a00':'#176735';
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-weight:800;font-size:13px">${esc(label)}</div><span class="muted" style="font-size:13px">${esc(fmtDate(r.created_at))}</span></div><h3 style="margin:12px 0 6px">${esc(r.categoria||'Richiesta')}</h3><p class="muted" style="margin-top:0">${esc(info)}</p><p><strong>Zona:</strong> ${esc(r.comune||'')} ${r.cap?'('+esc(r.cap)+')':''}</p><p><strong>Descrizione:</strong><br>${esc(r.descrizione||'')}</p><p><strong>Urgenza:</strong> ${esc(r.urgenza||'Non indicata')}</p><p><strong>Budget:</strong> ${esc(r.budget||'Non indicato')}</p>${pros.length?pros.map(renderProfessional).join(''):''}${awaitingConfirmation?`<div style="margin-top:16px;padding:16px;border-radius:12px;background:#fff7df;border:1px solid #ead596"><strong>Il professionista ha indicato il lavoro come eseguito.</strong><p style="margin:8px 0 12px">Conferma il completamento solo se sei soddisfatto del lavoro svolto.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button onclick="confermaCompletamento('${esc(r.id)}')" style="background:#173f2c;color:#fff">Conferma completamento</button><button onclick="segnalaProblema('${esc(r.id)}')" style="background:#fff;color:#8b1e1e;border:1px solid #8b1e1e">Segnala un problema</button></div></div>`:''}`;
    panel.appendChild(card);
  }
}

function showLogin(){accountView.style.display='none';loginView.style.display='block';passwordInput.value='';}
async function logout(){await sb.auth.signOut();showLogin();}
(async()=>{const{data:{session}}=await sb.auth.getSession();if(session?.user)await showAccount(session.user);})();