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
  if(introText) introText.textContent='Qui trovi soltanto le richieste collegate al tuo account.';
  await loadRequests(user.id);
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

  panel.innerHTML='<h2 style="margin:0 0 14px">Le tue richieste</h2>'+data.map(r=>`
    <div style="margin:0 0 14px;padding:18px;border:1px solid #e4dfd6;border-radius:14px;background:#fff">
      <div style="display:inline-block;padding:5px 9px;border-radius:999px;background:#edf8f0;color:#176735;font-weight:800;font-size:13px">${esc(r.stato||'nuova')}</div>
      <h3 style="margin:12px 0 8px">${esc(r.categoria||'Richiesta')}</h3>
      <p><strong>Zona:</strong> ${esc(r.comune||'')} ${r.cap?'('+esc(r.cap)+')':''}</p>
      <p><strong>Descrizione:</strong><br>${esc(r.descrizione||'')}</p>
      <p><strong>Urgenza:</strong> ${esc(r.urgenza||'Non indicata')}</p>
      <p style="margin-bottom:0"><strong>Budget:</strong> ${esc(r.budget||'Non indicato')}</p>
    </div>`).join('');
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