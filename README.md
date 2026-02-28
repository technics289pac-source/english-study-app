# English Practice Notebook

Japanese to English translation, TTS audio generation, and optional Supabase sync.

## Setup

```powershell
cd C:\Users\user\english-study-app
npm.cmd install
Copy-Item .env.example .env
# Edit .env and set OPENAI_API_KEY
npm.cmd start
```

Open `http://127.0.0.1:3000`.

## Install As App (PWA)

- Chrome/Edge (Android/PC): open the app URL and use `Install app` from browser menu.
- iPhone (Safari): open the app URL, tap Share, then `Add to Home Screen`.
- If old files remain cached, reload once after restarting server.

## Deploy To Render (Use Outside Home Wi-Fi)

1. Push this folder to a GitHub repository.
2. In Render, choose `New +` -> `Blueprint`.
3. Select that GitHub repository (it will read `render.yaml`).
4. In Render environment variables, set `OPENAI_API_KEY`.
5. Deploy and open your `https://...onrender.com` URL.

After deploy, install from that HTTPS URL on phone:
- Android Chrome: browser menu -> `Install app`
- iPhone Safari: Share -> `Add to Home Screen`

## Environment Variables

Set these in `.env` (recommended) or OS environment variables:

```env
OPENAI_API_KEY=sk-...
OPENAI_TRANSLATE_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
PORT=3000
```

## Supabase (Optional)

Create table:

```sql
create table if not exists public.study_sentences (
  id text primary key,
  user_id text not null,
  english text not null,
  japanese text not null,
  audio_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.study_sentences enable row level security;

create policy "allow anon read/write for demo"
on public.study_sentences
for all
to anon
using (true)
with check (true);
```
