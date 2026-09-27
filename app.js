const SUPABASE_URL = 'https://nijsfyysxvqogjjfawrc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YBMEKwWJCtTZsiRBS45hGQ_sDogz1SE';

// Mantiene sincronizzati i servizi nei due menu senza dover duplicare la logica nell'HTML.
const SERVIZI_SGROVIO = [
  'Sgomberi e traslochi',
  'Giardinaggio',
  'Idraulico',
  'Elettricista',
  'Fabbro',
  'Muratore',
  'Imbianchino',
  'Manutenzione caldaie/climatizzatori',
  'Pulizie',
  'Tinteggiatura',
  'Piccoli lavori',
  'Altro'
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
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  } return true;
}

function value(fd, name) {
  const v = fd.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? 'Invio in corso…' : button.dataset.label;
}

function showResult(id, message, ok = true) {
  const box = document.getElementById(id);
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = ok
    ? `<b>✓ ${message}</b>`
    : `<b>Invio non riuscito.</b><br>${message}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const forms = document.querySelectorAll('form.formgrid');
const clientForm = document.querySelector('#richiesta form.formgrid');
const proForm = document.querySelector('#professionisti form.formgrid');

if (clientForm) {
  clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!clientForm.reportValidity()) return;
    setBusy(clientForm, true);
    const fd = new FormData(clientForm);
    try {
      const nuovaRichiesta = await insertSupabase('richieste', {
        nome_cliente: value(fd, 'Nome'),
        email: value(fd, 'email') || '',
        telefono: value(fd, 'Telefono') || null,
        categoria: value(fd, 'Servizio'),
        descrizione: value(fd, 'Descrizione'),
        comune: value(fd, 'Comune') || null,
        cap: value(fd, 'CAP'),
        provincia: 'MN',
        budget: value(fd, 'Budget') || null,
        urgenza: value(fd, 'Tempistica'),
        stato: 'nuova'
      });
      clientForm.reset();
      showResult('okC', 'Richiesta ricevuta. Abbiamo salvato i dati necessari per avviare la ricerca.');
    } catch (error) {
      console.error('Supabase richieste:', error);
      showResult('okC', 'ERRORE SUPABASE: ' + error.message, false);
    } finally {
      setBusy(clientForm, false);
    }
  });
}

if (proForm) {
  proForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!proForm.reportValidity()) return;
    setBusy(proForm, true);
    const fd = new FormData(proForm);
    try {
      await insertSupabase('professionisti', {
        nome_attivita: value(fd, 'Nome_attivita'),
        telefono: value(fd, 'Telefono'),
        email: value(fd, 'email'),
        servizio: value(fd, 'Servizio'),
        altri_servizi: value(fd, 'Altri_servizi') || null,
        zone_servite: value(fd, 'Zone_servite'),
        raggio_massimo: value(fd, 'Raggio_massimo'),
        disponibilita: value(fd, 'Disponibilita'),
        partita_iva: value(fd, 'Partita_IVA') || null,
        descrizione_attivita: value(fd, 'Descrizione_attivita') || null,
        consenso_contatto: fd.has('Consenso_contatto')
      });
      proForm.reset();
      showResult('okP', 'Candidatura ricevuta. La tua attività è stata salvata nella rete iniziale di Sgrovio.');
    } catch (error) {
      console.error('Supabase professionisti:', error);
      showResult('okP', 'Riprova tra poco. Se il problema continua, contatta Sgrovio.', false);
    } finally {
      setBusy(proForm, false);
    }
  });
}
