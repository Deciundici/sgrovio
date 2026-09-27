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

async function login(){
  message.textContent='';
  const email=emailInput.value.trim();
  const password=passwordInput.value;
  if(!email||!password){message.textContent='Inserisci email e password.';return;}
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){message.textContent='Accesso non riuscito: '+error.message;return;}
  await showAccount(data.user);
}

async function showAccount(user){
  loginView.style.display='none';
  accountView.style.display='block';
  accountEmail.textContent='Account: '+(user?.email||'');
  if(introText) introText.textContent='Qui trovi soltanto le richieste collegate al tuo account e, quando un professionista accetta, i suoi contatti.';
  await loadRequests(user.id);
}

async function acceptedProfessionals(richiestaId){
  const {data:matches,error:matchError}=await sb
    .from('matching')
    .select('professionista_id,punteggio,stato')
    .eq('richiesta_id',richiestaId)
    .eq('stato','accettato');

  if(matchError||!matches?.length) return [];

  const ids=[...new Set(matches.map(m=>m.professionista_id).filter(Boolean))];
  if(!ids.length) return [];

  const {data:pros,error:proError}=await sb
    .from('professionisti')
    .select('id,nome,attivita,telefono,email,categoria')
    .in('id',ids);

  if(proError||!pros?.length) return [];

  return pros.map(p=>({
    ...p,
    punteggio:matches.find(m=>m.professionista_id===p.id)?.punteggio??null
  }));
}

function renderProfessional(p){
  const tel=cleanPhone(p.telefono);
  const wa=waPhone(p.telefono);
  const nome=p.attivita||p.nome||'Professionista Sgrovio';
  return `
    <div style="margin-top:16px;padding:16px;border:1px solid #b9dec5;border-radius:12px;background:#edf8f0">
      <div style="font-weight:900;color:#176735">✓ Professionista disponibile</div>
      <h4 style="margin:10px 0 6px;font-size:18px">${esc(nome)}</h4>
      <p style="margin:6px 0"><strong>Servizio:</strong> ${esc(p.categoria||'Non indicato')}</p>
      ${p.punteggio!=null?`<p style="margin:6px 0"><strong>Compatibilità:</strong> ${esc(p.punteggio)}%</p>`:''}
      <p style="margin:6px 0"><strong>Telefono:</strong> ${esc(p.telefono||'Non indicato')}</p>
      <p style="margin:6px 0"><strong>Email:</strong> ${esc(p.email||'Non indicata')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        ${tel?`<a href="tel:${esc(tel)}" style="padding:10px 14px;border-radius:9px;background:#173f2c;color:#fff;text-decoration:none;font-weight:800">Chiama</a>`:''}
        ${wa?`<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener" style="padding:10px 14px;border-radius:9px;background:#173f2c;color:#fff;text-decoration:none;font-weight:800">WhatsApp</a>`:''}
        ${p.email?`<a href="mailto:${esc(p.email)}" style="padding:10px 14px;border-radius:9px;border:1px solid #173f2c;color:#173f2c;text-decoration:none;font-weight:800">Email</a>`:''}
      </div>
    </div>`;
}

async function loadRequests(userId){
  let panel=document.getElementById('clientRequests');
  if(!panel){
    panel=document.createElement('div');
    panel.id='clientRequests';
    panel.style.marginTop='22px';
    accountView.insertBefore(panel,document.getElementById('logoutBtn'));
  }
  panel.innerHTML='<p class="muted">Caricamento richieste…</p>';

  const {data,error}=await sb
    .from('richieste')
    .select('id,categoria,descrizione,comune,cap,budget,urgenza,stato,created_at')
    .eq('user_id',userId)
    .order('created_at',{ascending:false});

  if(error){
    panel.innerHTML='<p class="message">Errore nel caricamento: '+esc(error.message)+'</p>';
    return;
  }

  if(!data?.length){
    panel.innerHTML='<div style="margin:16px 0;padding:18px;border:1px solid #e4dfd6;border-radius:14px;background:#fff"><strong>Nessuna richiesta</strong><p class="muted" style="margin-bottom:0">Non ci sono ancora richieste collegate a questo account.</p></div>';
    return;
  }

  panel.innerHTML='<h2 style="margin:0 0 14px">Le tue richieste</h2>';

  for(const r of data){
    const pros=await acceptedProfessionals(r.id);
    const card=document.createElement('div');
    card.style.cssText='margin:0 0 14px;padding:18px;border:1px solid #e4dfd6;border-radius:14px;background:#fff';
    const stato=pros.length?'professionista trovato':(r.stato||'nuova');
    card.innerHTML=`
      <div style="display:inline-block;padding:5px 9px;border-radius:999px;background:#edf8f0;color:#176735;font-weight:800;font-size:13px">${esc(stato)}</div>
      <h3 style="margin:12px 0 8px">${esc(r.categoria||'Richiesta')}</h3>
      <p><strong>Zona:</strong> ${esc(r.comune||'')} ${r.cap?'('+esc(r.cap)+')':''}</p>
      <p><strong>Descrizione:</strong><br>${esc(r.descrizione||'')}</p>
      <p><strong>Urgenza:</strong> ${esc(r.urgenza||'Non indicata')}</p>
      <p><strong>Budget:</strong> ${esc(r.budget||'Non indicato')}</p>
      ${pros.length?pros.map(renderProfessional).join(''):'<p class="muted" style="margin-bottom:0">Sgrovio sta cercando un professionista compatibile. Quando qualcuno accetterà, comparirà qui.</p>'}`;
    panel.appendChild(card);
  }
}

function showLogin(){
  accountView.style.display='none';
  loginView.style.display='block';
  passwordInput.value='';
}

async function logout(){
  await sb.auth.signOut();
  showLogin();
}

(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) await showAccount(session.user);
})();