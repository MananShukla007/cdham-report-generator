# Weekly Report Generator

Generates professional iOS development weekly reports as downloadable PDFs, matching the exact format of your sample reports. Uses GPT-4o to convert casual notes into polished report language. Stores all reports as JSON in a GitHub repo for week-over-week context.

## Setup

```bash
cp .env.example .env.local
# Fill in the four env vars (see below)
npm install
npm run dev
```

## Env Vars

| Variable | Description |
|---|---|
| `VITE_OPENAI_KEY` | OpenAI API key (GPT-4o) |
| `VITE_GITHUB_TOKEN` | GitHub PAT with `repo:contents` read + write |
| `VITE_GITHUB_REPO` | `owner/repo` e.g. `manan/weekly-reports` |
| `VITE_GITHUB_FILE` | Path in repo e.g. `data/weekly-reports.json` |

## Sample PDFs

The sample PDFs were analyzed to extract the exact format:
- **Colors**: Title `#0c2340` (navy), Subtitle `#f15a22` (orange), Body `#333333`
- **Layout**: Header box with title/subtitle/label-value pairs, numbered sections, Upcoming Tasks table, footer
- **Fonts**: Title 22pt bold, Subtitle 14pt bold orange, Section headings 14pt navy, Body 10.5pt

To update the template, add new samples to `public/sample-reports/` and run **Template Setup → Auto-extract**.

## App Flow

**New Report**
1. Set week start/end dates and projects name
2. Add numbered sections with titles and casual notes
3. Click **Polish with GPT-4o** → all sections rewritten in professional report language
4. Toggle Raw/Polished per section to compare and edit
5. Add Upcoming Tasks rows and any Attached Reports
6. **Download PDF** → exact-match PDF
7. **Save to GitHub** → JSON saved to your repo for future context

**History** — view all past reports, preview inline, or load back into the editor

**Template** — edit org details (title, subtitle, name, supervisor, footer) or auto-extract from a new sample

## Deploy to Vercel

```bash
npx vercel
```

Add the four env vars in Vercel dashboard → Settings → Environment Variables. Subsequent `git push` will auto-deploy.
