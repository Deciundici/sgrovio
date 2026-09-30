import { withSupabase } from 'npm:@supabase/server@^1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SGROVIO_NOTIFY_EMAIL = Deno.env.get('SGROVIO_NOTIFY_EMAIL')
const FROM_EMAIL = 'Sgrovio <notifiche@sgrovio.it>'
const REPLY_TO = 'info@sgrovio.it'
const PRO_AREA_URL = 'https://sgrovio.it/professionista.html'
const ADMIN_URL = 'https://sgrovio.it/admin.html'

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY non configurata')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      reply_to: REPLY_TO,
      subject,
      html,
    }),
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`Resend ${response.status}: ${body}`)
  return body
}

function layout(title: string, content: string, ctaText?: string, ctaUrl?: string) {
  const cta = ctaText && ctaUrl
    ? `<p style="margin:28px 0 8px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">${esc(ctaText)}</a></p>`
    : ''

  return `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Arial,sans-serif;color:#171717"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="font-size:25px;font-weight:800;margin-bottom:22px">Sgrovio</div><div style="background:#fff;border:1px solid #e4dfd6;border-radius:16px;padding:26px"><h1 style="font-size:25px;margin:0 0 16px">${esc(title)}</h1>${content}${cta}</div><p style="font-size:12px;color:#777;line-height:1.5;margin:16px 4px">Messaggio operativo automatico di Sgrovio · Viadana e dintorni</p></div></body></html>`
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })

    const payload = await req.json().catch(() => null)
    if (!payload || payload.type !== 'INSERT' || !payload.table || !payload.record) {
      return Response.json({ ok: true, skipped: 'Evento non gestito' })
    }

    const table = String(payload.table)
    const record = payload.record as Record<string, unknown>

    if (table === 'richieste' && SGROVIO_NOTIFY_EMAIL) {
      const subject = `🔔 Nuova richiesta Sgrovio — ${String(record.categoria ?? 'servizio')}`
      const html = layout(
        'Nuova richiesta cliente',
        `<p><strong>Servizio:</strong> ${esc(record.categoria)}</p><p><strong>Zona:</strong> ${esc(record.comune)} ${record.cap ? `(${esc(record.cap)})` : ''}</p><p><strong>Urgenza:</strong> ${esc(record.urgenza || 'Non indicata')}</p>`,
        'Apri Area Admin',
        ADMIN_URL,
      )
      await sendEmail(SGROVIO_NOTIFY_EMAIL, subject, html)
      return Response.json({ ok: true, sent: 'admin-richiesta' })
    }

    if (table === 'professionisti' && SGROVIO_NOTIFY_EMAIL) {
      const subject = `👷 Nuovo professionista Sgrovio — ${String(record.categoria ?? 'categoria')}`
      const html = layout(
        'Nuovo professionista registrato',
        `<p><strong>Attività:</strong> ${esc(record.attivita || record.nome)}</p><p><strong>Categoria:</strong> ${esc(record.categoria)}</p><p><strong>Zona:</strong> ${esc(record.comune)}</p>`,
        'Apri Area Admin',
        ADMIN_URL,
      )
      await sendEmail(SGROVIO_NOTIFY_EMAIL, subject, html)
      return Response.json({ ok: true, sent: 'admin-professionista' })
    }

    if (table === 'matching') {
      if (String(record.stato ?? '') !== 'proposto') {
        return Response.json({ ok: true, skipped: 'Matching non proposto' })
      }

      const professionistaId = String(record.professionista_id ?? '')
      const richiestaId = String(record.richiesta_id ?? '')
      if (!professionistaId || !richiestaId) {
        return Response.json({ ok: true, skipped: 'ID matching incompleti' })
      }

      const [{ data: pro, error: proError }, { data: richiesta, error: richiestaError }] = await Promise.all([
        ctx.supabaseAdmin
          .from('professionisti')
          .select('id,nome,attivita,email,categoria')
          .eq('id', professionistaId)
          .maybeSingle(),
        ctx.supabaseAdmin
          .from('richieste')
          .select('id,categoria,comune,cap,urgenza,budget,descrizione')
          .eq('id', richiestaId)
          .maybeSingle(),
      ])

      if (proError) throw proError
      if (richiestaError) throw richiestaError
      if (!pro?.email || !richiesta) {
        return Response.json({ ok: true, skipped: 'Professionista o richiesta non trovati' })
      }

      const nome = pro.attivita || pro.nome || 'professionista'
      const score = record.punteggio != null ? `${esc(record.punteggio)}%` : 'Compatibile'
      const zona = `${esc(richiesta.comune || 'Zona non indicata')}${richiesta.cap ? ` (${esc(richiesta.cap)})` : ''}`
      const tempistica = esc(richiesta.urgenza || 'Non indicata')
      const budget = richiesta.budget ? esc(richiesta.budget) : 'Non indicato'
      const subject = `Nuova richiesta Sgrovio · ${richiesta.categoria} · ${richiesta.comune}`

      const html = layout(
        'Nuova richiesta compatibile',
        `<p>Ciao <strong>${esc(nome)}</strong>,</p>
        <p>Abbiamo trovato una nuova richiesta che potrebbe essere adatta alla tua attività.</p>
        <div style="background:#f7f5f0;border:1px solid #e7e3dc;border-radius:14px;padding:18px;margin:20px 0">
          <div style="display:grid;gap:10px">
            <div><span style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Servizio</span><br><strong>${esc(richiesta.categoria)}</strong></div>
            <div><span style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Zona</span><br><strong>${zona}</strong></div>
            <div><span style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Tempistica</span><br><strong>${tempistica}</strong></div>
            <div><span style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Budget</span><br><strong>${budget}</strong></div>
            <div><span style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Compatibilità</span><br><strong>${score}</strong></div>
          </div>
        </div>
        <p><strong>Nessun obbligo di accettazione.</strong> Accedi alla tua Area Professionista per leggere i dettagli e decidere se valutarla.</p>
        <p style="font-size:13px;color:#666">La richiesta potrebbe essere stata proposta anche ad altri professionisti compatibili. I contatti del cliente vengono mostrati solo dopo l'accettazione.</p>`,
        'Visualizza la richiesta',
        PRO_AREA_URL,
      )

      await sendEmail(pro.email, subject, html)
      return Response.json({ ok: true, sent: 'professionista-matching', to: pro.email })
    }

    return Response.json({ ok: true, skipped: 'Tabella non gestita' })
  }),
}
