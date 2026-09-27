const SUPABASE_URL = 'https://nijsfyysxvqogjjfawrc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YBMEKwWJCtTZsiRBS45hGQ_sDogz1SE';

const SERVIZI_SGROVIO = [
  'Sgomberi e traslochi','Giardinaggio','Idraulico','Elettricista','Fabbro','Muratore',
  'Imbianchino','Manutenzione caldaie/climatizzatori','Pulizie','Tinteggiatura','Piccoli lavori','Altro'
];

function aggiornaMenuServizi() {
  document.querySelectorAll('select[name="Servizio"]').forEach((select) => {
    const valoreAttuale = select.value;
    select.innerHTML = '<option value="">Seleziona</option>' +
      SERVIZI_SGROVIO.map(servizio => `<option>${servizio}</option>`).join('');
    if (SERVIZI_SGROVIO.includes(valoreAttuale)) select.value = valoreAttuale;
  });
}
aggiornaMenuServizi();

function aggiungiAccessoProfessionista() {
  const nav = document.querySelector('.nav');
  const navPro = nav?.querySelector('.navlink');
  if (nav && navPro) {
    navPro.textContent = 'Area Professionista';
    navPro.href = 'professionista.html';
  }
  if (nav && !nav.querySelector('a[href="cliente.html"]')) {
    const navCliente = document.createElement('a');
    navCliente.className = 'navlink nav-client-link';
    navCliente.href = 'cliente.html';
    navCliente.textContent = 'Area Cliente';
    if (navPro) nav.insertBefore(navCliente, navPro);
    else nav.appendChild(navCliente);
  }

  const heroActions = document.querySelector('.hero .actions');
  if (heroActions) {
    const candidatura = [...heroActions.querySelectorAll('a')].find(a => a.getAttribute('href') === '#professionisti');
    if (candidatura) candidatura.textContent = 'Candidati come professionista';

    if (!heroActions.querySelector('a[href="cliente.html"]')) {
      const loginCliente = document.createElement('a');
      loginCliente.className = 'btn secondary';
      loginCliente.href = 'cliente.html';
      loginCliente.textContent = 'Accedi all’Area Cliente';
      heroActions.appendChild(loginCliente);
    }

    if (!heroActions.querySelector('a[href="professionista.html"]')) {
      const login = document.createElement('a');
      login.className = 'btn secondary';
      login.href = 'professionista.html';
      login.textContent = 'Accedi all’Area Professionista';
      heroActions.appendChild(login);
    }
  }
  const proPanel = document.querySelector('#professionisti .panel');
  const proHead = proPanel?.querySelector('.panelhead');
  if (proPanel && proHead && !proPanel.querySelector('.pro-login-link')) {
    const box = document.createElement('div');
    box.className = 'pro-login-link';
    box.style.cssText = 'margin:0 0 22px;padding:16px 18px;border:1px solid #e4dfd6;border-radius:14px;background:#f7f5f0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    box.innerHTML = '<span><b>Sei già registrato?</b> Accedi per vedere le richieste compatibili.</span><a class="btn secondary" href="professionista.html">Accedi all’Area Professionista</a>';
    proPanel.insertBefore(box, proHead);
  }
}
aggiungiAccessoProfessionista();

async function insertSupabase(table, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
}

async function insertSupabaseAutenticato(table, payload, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
}

async function creaAccountProfessionista(email,password) {
  const response=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.msg||data.message||data.error_description||'Creazione account non riuscita');
  if(!data.user||!data.user.id) throw new Error('Account creato ma ID utente non disponibile');
  return data.user;
}

async function loginCliente(email,password) {
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.msg||data.message||data.error_description||'Credenziali non valide');
  if(!data.user?.id||!data.access_token) throw new Error('Sessione cliente non disponibile');
  return data;
}

async function creaCliente(email,password) {
  const response=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.msg||data.message||data.error_description||'Creazione account cliente non riuscita');
  if(!data.user?.id) throw new Error('Account cliente non creato');
  if(!data.access_token) throw new Error('Account creato, ma la sessione non è ancora attiva. Accedi dall’Area Cliente.');
  return data;
}

async function creaOAccediCliente(email,password) {
  try {
    return await loginCliente(email,password);
  } catch (loginError) {
    try {
      return await creaCliente(email,password);
    } catch (signupError) {
      const msg=String(signupError.message||signupError);
      if(msg.toLowerCase().includes('already')||msg.toLowerCase().includes('registered')||msg.toLowerCase().includes('exists')) {
        throw new Error('Esiste già un account con questa email, ma la password inserita non è corretta. Usa la password dell’Area Cliente.');
      }
      throw signupError;
    }
  }
}

function value(fd,name){const v=fd.get(name);return typeof v==='string'?v.trim():'';}
function parseRaggio(raw){const match=String(raw||'').match(/\d+/);return match?Number(match[0]):20;}
function setBusy(form,busy,label='Creazione account…'){
  const button=form.querySelector('button[type="submit"]');
  if(!button)return;
  if(!button.dataset.label)button.dataset.label=button.textContent;
  button.disabled=busy;
  button.textContent=busy?label:button.dataset.label;
}
function showResult(id,message,ok=true){
  const box=document.getElementById(id);
  if(!box)return;
  box.style.display='block';
  box.innerHTML=ok?`<b>✓ ${message}</b>`:`<b>Invio non riuscito.</b><br>${message}`;
  box.scrollIntoView({behavior:'smooth',block:'center'});
}
function showClientSuccess(){
  const box=document.getElementById('okC');
  if(!box)return;
  box.style.display='block';
  box.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">
      <div><b>✓ Richiesta ricevuta e collegata al tuo account.</b><br><span>Puoi seguirne lo stato dalla tua Area Cliente.</span></div>
      <a href="cliente.html" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#171717;color:#fff;text-decoration:none;font-weight:800">Vai all’Area Cliente</a>
    </div>`;
  box.scrollIntoView({behavior:'smooth',block:'center'});
}

const clientForm=document.querySelector('#richiesta form.formgrid');
const proForm=document.querySelector('#professionisti form.formgrid');

if(clientForm&&!clientForm.querySelector('[name="Password_cliente"]')) {
  const emailInput=clientForm.querySelector('[name="email"]');
  if(emailInput) emailInput.required=true;

  const consenso=clientForm.querySelector('.check');
  const row=document.createElement('div');
  row.className='row';
  row.innerHTML=`
    <label>Password Area Cliente
      <input type="password" name="Password_cliente" minlength="8" autocomplete="current-password" required placeholder="Minimo 8 caratteri">
    </label>
    <label>Conferma password
      <input type="password" name="Conferma_password_cliente" minlength="8" autocomplete="current-password" required placeholder="Ripeti la password">
    </label>`;
  clientForm.insertBefore(row,consenso);

  const note=document.createElement('div');
  note.className='small';
  note.innerHTML='Se è la tua prima richiesta, Sgrovio crea automaticamente il tuo account cliente. Se hai già un account, usa la stessa email e password. <a href="cliente.html">Vai all’Area Cliente</a>.';
  clientForm.insertBefore(note,consenso);
}

if(proForm&&!proForm.querySelector('[name="Password"]')){
  const consenso=proForm.querySelector('.check');
  const row=document.createElement('div');
  row.className='row';
  row.innerHTML=`<label>Password per Area Professionista<input type="password" name="Password" minlength="8" autocomplete="new-password" required placeholder="Minimo 8 caratteri"></label><label>Conferma password<input type="password" name="Conferma_password" minlength="8" autocomplete="new-password" required placeholder="Ripeti la password"></label>`;
  proForm.insertBefore(row,consenso);
  const note=document.createElement('div');
  note.className='small';
  note.textContent='Queste credenziali serviranno per accedere alla tua Area Professionista.';
  proForm.insertBefore(note,consenso);
}

if(clientForm){
  clientForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!clientForm.reportValidity())return;
    const fd=new FormData(clientForm);
    const email=value(fd,'email').toLowerCase();
    const password=value(fd,'Password_cliente');
    const conferma=value(fd,'Conferma_password_cliente');

    if(!email){showResult('okC','Inserisci un indirizzo email valido.',false);return;}
    if(password!==conferma){showResult('okC','Le due password non coincidono.',false);return;}
    if(password.length<8){showResult('okC','La password deve contenere almeno 8 caratteri.',false);return;}

    setBusy(clientForm,true,'Invio richiesta…');
    try{
      const session=await creaOAccediCliente(email,password);
      await insertSupabaseAutenticato('richieste',{
        user_id:session.user.id,
        nome_cliente:value(fd,'Nome'),
        email,
        telefono:value(fd,'Telefono')||null,
        categoria:value(fd,'Servizio'),
        descrizione:value(fd,'Descrizione'),
        comune:value(fd,'Comune')||null,
        cap:value(fd,'CAP'),
        provincia:'MN',
        budget:value(fd,'Budget')||null,
        urgenza:value(fd,'Tempistica'),
        stato:'nuova'
      },session.access_token);
      clientForm.reset();
      showClientSuccess();
    }catch(error){
      const msg=String(error.message||error);
      showResult('okC',msg,false);
    }finally{
      setBusy(clientForm,false);
    }
  });
}

if(proForm){
  proForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!proForm.reportValidity())return;
    const fd=new FormData(proForm);
    const password=value(fd,'Password'),conferma=value(fd,'Conferma_password');
    if(password!==conferma){showResult('okP','Le due password non coincidono.',false);return;}
    if(password.length<8){showResult('okP','La password deve contenere almeno 8 caratteri.',false);return;}
    setBusy(proForm,true);
    try{
      const nome=value(fd,'Nome_attivita'),email=value(fd,'email').toLowerCase(),user=await creaAccountProfessionista(email,password);
      await insertSupabase('professionisti',{
        nome,email,telefono:value(fd,'Telefono')||null,attivita:nome,
        categoria:value(fd,'Servizio'),comune:value(fd,'Zone_servite'),provincia:'MN',
        raggio_km:parseRaggio(value(fd,'Raggio_massimo')),disponibile:true,
        verificato:false,stato:'in_attesa',user_id:user.id
      });
      proForm.reset();
      showResult('okP','Candidatura e account creati. Ora puoi accedere all’Area Professionista con email e password.');
    }catch(error){
      const msg=String(error.message||error);
      showResult('okP',msg.toLowerCase().includes('already')||msg.toLowerCase().includes('registered')?'Questa email risulta già registrata. Usa un’altra email per il test oppure accedi all’Area Professionista.':msg,false);
    }finally{setBusy(proForm,false);}
  });
}
