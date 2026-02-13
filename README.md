# Festivalportalen

Rapporteringsportal for norske festivaler. Samler data fra billettsystemer, økonomi og sponsorer i ett grensesnitt — og gjør rapportering til kommune, sponsorer og regnskapsfører automatisk.

**Første kunde:** Tysnesfest (pilot juli 2026)

## Tech Stack

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | React 18 + TypeScript, Tailwind CSS, Vite |
| Backend/DB | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| Grafer | Recharts |
| PDF | jsPDF + jspdf-autotable |
| i18n | i18next (nb, nn, en) |
| PWA | vite-plugin-pwa |
| Hosting | Vercel (frontend), Supabase (backend) |
| Billettsystem | TicketCo API |

## Prosjektstruktur

```
src/
├── components/layout/   # AppLayout (sidebar + nav)
├── contexts/            # AuthContext (session, profile, festival)
├── hooks/               # useRealtimeTable, useTicketSales
├── lib/                 # supabase, i18n, export-csv, report-pdf, sales-utils
├── pages/               # Alle sidekomponenter
│   ├── LoginPage        # E-post + passord, gløymt passord, magisk lenke
│   ├── SetPasswordPage  # Sett passord etter første innlogging
│   ├── DashboardPage    # Nøkkeltall, sparkline, budsjett vs faktisk
│   ├── SalesPage        # Billettsalg + F&B med grafer og CSV-eksport
│   ├── EconomyPage      # Inntekter/kostnader CRUD, MVA-oversikt
│   ├── SponsorsPage     # Sponsor CRUD, leveranser, statuspipeline
│   ├── ReportsPage      # Regnskapseksport, sponsor- og årsrapport (PDF)
│   ├── SettingsPage     # Festivalinnstillingar + brukaradmin
│   └── SponsorPortalPage # Sponsorens sjølvbetening
└── types/               # TypeScript-typar (database.ts)

supabase/
├── migrations/          # SQL-migrasjoner (full skjema)
└── functions/           # Edge Functions
    ├── invite-user/     # Inviter brukar (admin)
    ├── toggle-user/     # Deaktiver/reaktiver brukar (admin)
    └── ticketco-sync/   # Synkroniser salg frå TicketCo API

public/locales/          # i18n-filer (nb, nn, en)
```

## Byggjefasar

| Fase | Skildring | Status |
|------|-----------|--------|
| 0 | Fundament (repo, auth, PWA, i18n) | Ferdig |
| 1 | Innstillingar + brukaradmin | Ferdig |
| 2 | TicketCo-integrasjon + billettsalg | Ferdig |
| 3 | Dashboard med nøkkeltall | Ferdig |
| 4 | Økonomimodul | Ferdig |
| 5 | Sponsormodul + sponsorportal | Ferdig |
| 6 | Regnskapseksport (CSV) | Ferdig |
| 7 | Rapportgenerator (PDF) | Ferdig |
| 8 | Polish, testing, Tysnesfest-konfig | Ikkje starta |

## Utvikling

```bash
npm install
npm run dev        # Start utviklingsserver
npm run build      # Bygg for produksjon
```

### Miljøvariablar

Lag `.env` i prosjektrota:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Kun for edge functions
```

### Databasmigrasjon

```bash
supabase db push --include-all
```

Docker er ikkje tilgjengeleg lokalt — bruk `supabase db push` mot remote.

## Arkitektur

### Multitenant

Alle tabellar har `festival_id`. RLS-policies sikrar at brukarar berre ser data for eigen festival.

### Brukarroller

| Rolle | Tilgang |
|-------|---------|
| `admin` | Full tilgang, konfigurasjon, brukaradmin |
| `board` | Dashboard, rapportar, økonomi (les) |
| `crew` | Dashboard |
| `sponsor` | Kun eigen sponsorside |
| `accountant` | Økonomi, billettsalg, eksport |

### Autentisering

1. Admin sender invitasjon via e-post (Edge Function)
2. Brukar klikkar magic link → set passord
3. Neste gong: e-post + passord innlogging
4. Gløymt passord → Supabase reset-flyt

### Sikkerheit

- **RLS** (Row Level Security) på alle tabellar
- Admin-only skrivepolicies, dobbel sjekk med `isAdmin` i frontend
- Service role key aldri eksponert til frontend (`VITE_`-prefix mangler med vilje)
- Ingen `dangerouslySetInnerHTML`, ingen rå SQL
- CSV-eksport med formel-sanitering mot CSV-injection

## GDPR og personvern

### Implementert

- Dataminimering: ingen lagring av publikumsdata utover aggregert statistikk
- RLS hindrar tilgang til andre festivalar sine data
- Generiske feilmeldingar (lekker ikkje om e-post finst)
- `.env` i `.gitignore`, aldri committa

### Gjenstår (Phase 8)

- [ ] Personvernerklæring / privacy policy
- [ ] Samtykkemekanisme ved registrering
- [ ] Tilgangslogg (`access_log`-tabell for GDPR audit trail)
- [ ] Rett til sletting (brukar + sponsorkontakt)
- [ ] Databehandlaravtale-mal
- [ ] Data retention policy
- [ ] CORS-innstramming på Edge Functions (bort frå wildcard `*`)
- [ ] Styrka passordkrav (kompleksitet utover 8 teikn)

## Lisens

Proprietary — Kulturkontoret AS
