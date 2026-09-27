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

async function insertSupabase(table, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
}

async function creaAccountProfessionista(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || 'Creazione account non riuscita');
  if (!data.user || !data.user.id) throw new Error('Account creato ma ID utente non disponibile');
  return data.user;
}

function value(fd, name) {
  const v = fd.get(name);
  return typeof v === 'string' ? v.trim() : '';
}
function parseRaggio(raw) {
  const match = String(raw || '').match(/\d+/);
  return match ? Number(match[0]) : 20;
}
function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? 'Creazione account…' : button.dataset.label;
}
function showResult(id, message, ok = true) {
  const box = document.getElementById(id);
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = ok ? `<b>✓ ${message}</b>` : `<b>Invio non riuscito.</b><br>${message}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const clientForm = document.querySelector('#richiesta form.formgrid');
const proForm = document.querySelector('#professionisti form.formgrid');

// Aggiunge al form professionista le credenziali necessarie per l'Area Professionista.
if (proForm && !proForm.querySelector('[name="Password"]')) {
  const consenso = proForm.querySelector('.check');
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <label>Password per Area Professionista
      <input type="password" name="Password" minlength="8" autocomplete="new-password" required placeholder="Minimo 8 caratteri">
    </label>
    <label>Conferma password
      <input type="password" name="Conferma_password" minlength="8" autocomplete="new-password" required placeholder="Ripeti la password">
    </label>`;
  proForm.insertBefore(row, consenso);

  const note = document.createElement('div');
  note.className = 'small';
  note.textContent = 'Queste credenziali serviranno per accedere alla tua Area Professionista.';
  proForm.insertBefore(note, consenso);
}

if (clientForm) {
  clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!clientForm.reportValidity()) return;
    setBusy(clientForm, true);
    const fd = new FormData(clientForm);
    try {
      await insertSupabase('richieste', {
        nome_cliente: value(fd,'Nome'), email: value(fd,'email') || '', telefono: value(fd,'Telefono') || null,
        categoria: value(fd,'Servizio'), descrizione: value(fd,'Descrizione'), comune: value(fd,'Comune') || null,
        cap: value(fd,'CAP'), provincia: 'MN', budget: value(fd,'Budget') || null,
        urgenza: value(fd,'Tempistica'), stato: 'nuova'
      });
      clientForm.reset();
      showResult('okC','Richiesta ricevuta. Abbiamo salvato i dati necessari per avviare la ricerca.');
    } catch (error) {
      console.error('Supabase richieste:', error);
      showResult('okC','ERRORE SUPABASE: ' + error.message,false);
    } finally { setBusy(clientForm,false); }
  });
}

if (proForm) {
  proForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!proForm.reportValidity()) return;
    const fd = new FormData(proForm);
    const password = value(fd,'Password');
    const conferma = value(fd,'Conferma_password');
    if (password !== conferma) {
      showResult('okP','Le due password non coincidono.',false);
      return;
    }
    if (password.length < 8) {
      showResult('okP','La password deve contenere almeno 8 caratteri.',false);
      return;
    }

    setBusy(proForm,true);
    try {
      const nome = value(fd,'Nome_attivita');
      const email = value(fd,'email').toLowerCase();
      const user = await creaAccountProfessionista(email,password);

      await insertSupabase('professionisti', {
        nome, email, telefono: value(fd,'Telefono') || null, attivita: nome,
        categoria: value(fd,'Servizio'), comune: value(fd,'Zone_servite'), provincia: 'MN',
        raggio_km: parseRaggio(value(fd,'Raggio_massimo')), disponibile: true,
        verificato: false, stato: 'in_attesa', user_id: user.id
      });

      proForm.reset();
      showResult('okP','Candidatura e account creati. Ora puoi accedere all’Area Professionista con email e password.');
    } catch (error) {
      console.error('Registrazione professionista:', error);
      const msg = String(error.message || error);
      showResult('okP', msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')
        ? 'Questa email risulta già registrata. Usa un’altra email per il test oppure accedi all’Area Professionista.'
        : msg, false);
    } finally { setBusy(proForm,false); }
  });
}
