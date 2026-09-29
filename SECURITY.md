# Sicurezza di Sgrovio

Per segnalare in modo responsabile una possibile vulnerabilità di Sgrovio, scrivi a **info@sgrovio.it**.

Non pubblicare in issue GitHub password, token, dati personali di clienti/professionisti, screenshot dell'Area Admin o dettagli che rendano una vulnerabilità immediatamente sfruttabile.

## Principi del progetto

- Nessuna chiave `service_role`, secret key o password deve essere inserita nel repository.
- Nel frontend può comparire soltanto la chiave Supabase **publishable/anon**, protetta dalle policy RLS del database.
- Le operazioni che modificano dati sensibili devono richiedere una sessione autenticata.
- L'Area Admin deve autorizzare l'utente lato database, non soltanto nascondere elementi nell'interfaccia.
- I segreti delle funzioni server/Edge Function devono restare nei secret manager del relativo servizio.

Sito di produzione: https://sgrovio.it
