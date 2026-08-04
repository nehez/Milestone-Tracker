# Milestone Tracker

A client-side milestone tracker for Microsoft Project schedules. Export your
schedule from MS Project to Excel, drop the file in, and get a clean
one-page timeline you can scrub through snapshots of, zoom, customize, and
export as a PDF/PNG/JPG.

**Everything runs in your browser.** No file is ever uploaded anywhere — parsing,
storage, and export all happen locally. Uploaded snapshots are kept in your
browser's IndexedDB so you don't have to re-upload each visit; use "Clear data"
to wipe them.

## How it works

1. In Microsoft Project, export your schedule to Excel (any columns are fine —
   the tool only needs a Unique ID column to track items across files).
2. Drop the file into the tracker. The first time you use a given export
   layout, you'll map its columns (UID, Name, Date, etc.) once — that mapping
   is remembered for future exports with the same columns.
3. Optionally map a "Milestone flag" Yes/No column so only the rows you
   actually want on the timeline show up by default. Rows are also included
   automatically if they're 0-day tasks (Start = Finish), matching how MS
   Project itself defines a milestone, so a missed flag rarely hides one.
4. Optionally map a "Group / swimlane" column (phase, workstream, summary
   task — whatever you've got) to split a busy schedule into horizontal
   lanes instead of crowding everything onto one line.
5. Missed flagging something, or want to show a regular task alongside your
   milestones? Use "Manage milestones" to search for it and toggle it on —
   this overrides the spreadsheet flag per item, no re-upload needed.
6. Upload later exports of the same schedule to add more snapshots, then use
   the scrubber at the bottom to animate through how milestones moved.
7. Export the one-pager as PDF, PNG, or JPG.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
```

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages via
`.github/workflows/deploy.yml` (enable Pages → "GitHub Actions" as the source
in the repo settings). The site is still 100% client-side — Pages only serves
static files, and your Excel data never reaches a server.

## Versioning

The header shows the app's version (`src/version.ts`), bumped by hand on each
shipped change: MAJOR for a change that would require clearing stored data,
MINOR for a new feature, PATCH for a fix or polish with no new capability.

## Known limitation

Reading `.mpp` files directly isn't supported — there's no browser/WebAssembly
build of a `.mpp` parser available today (the common library, MPXJ, is
Java/.NET/Python/Ruby only). Export to Excel from MS Project as the input
format instead.
