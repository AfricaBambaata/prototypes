# Drawings site: working agreements

Public GitHub Pages site with interactive 3D technical drawings: https://africabambaata.github.io/prototypes/
The owner works in Dutch; answer in Dutch unless asked otherwise. Commit with the owner's GitHub noreply
address (`41635148+AfricaBambaata@users.noreply.github.com`, name `AfricaBambaata`) and push to `main`.

## Layout

- `drawings.json`: the register (site address, then per drawing: number, title, description, lang, status `current`/`archived`, optional short `link`, revisions `{ rev, date, file, viewer, note }`).
- `drawings/<NUMBER>/<REV>.html`: one file per revision. Each file only loads the shared viewer and calls `DrawingViewer.create({...})` with title, title block, views and a `build(m)` function for geometry and dimensions.
- `drawings/<NUMBER>/index.html`, `trapleuning.html` etc.: generated short links to the latest revision. Never edit by hand.
- `viewer/1/`: the shared viewer (latest 1.x). `viewer/<x.y.z>/`: fixed copies. Built from the private repository `AfricaBambaata/3dViewer`; never edit here.
- `previews/`: link preview images, made by `tools/previews.mjs` (and the "Voorbeeldbeelden" workflow).
- `index.html`: register page, including the admin mode (GitHub token in the browser).

## Rules

- **A released revision is never changed.** Content changes always go into a new revision. Only the generated `<!-- link-preview -->` block in a revision file may change (written by `tools/register.mjs`).
- A new revision starts as a **draft** (`"status": "draft"` on the revision): only the signed-in owner sees it in the register; short links, previews and banners keep pointing at the latest *released* revision. The owner releases it on the register page (⋯ → Vrijgeven) or `node tools/register.mjs release <NUMBER>`; `discard` deletes a draft. Only the newest revision can be a draft.
- The latest released revision is the current one. Older revisions stay online and show a "superseded" banner.
- Drawing numbers look like `ABC-0123`; revisions are single letters A, B, C …
- After every change: `node tools/register.mjs check` (validates and rewrites short links and preview tags).

## New revision of an existing drawing

1. If the owner has not already made it via the register page (⋯ → Nieuwe revisie), run
   `node tools/register.mjs revise <NUMBER> --note "<what changes>"`. This copies the latest file to the next letter as a draft and updates number and register block.
2. Make the requested change in the **new** file only (geometry in `build(m)`, dimensions, title block values such as date).
3. Check it in the browser (see Testing), run `node tools/register.mjs check`, render previews, commit, push.
4. Leave it as a draft: the owner releases it after looking at it. Release it yourself only when asked to.

## New drawing

The owner usually brings a Claude artifact (a page fragment with three.js), a sketch, or a description.

1. Choose the number with the owner (prefix per family: MHB = muurhouder/leuning, SLV = sleeve, BRK = bracket; next free number).
2. Create `drawings/<NUMBER>/A.html` following an existing drawing as the model (`drawings/MHB-0102/A.html` for a part with section view, `drawings/MHB-0200/A.html` for an assembly with zoom-dependent dimension layers). Port only the part-specific code into `build(m)`: `m.part()`, `m.edgeLine()`, `m.section()`, `m.add()`, `m.dims()` (API in the 3dViewer README).
3. Include `register: { url: '../../drawings.json', number: '<NUMBER>', rev: 'A' }`, `number: '<NUMBER>-A'`, a title block with a `scale: true` cell, and `lang`.
4. Add the drawing to `drawings.json` (status `current`, revision A with today's date, `viewer: "1"`, note "Eerste uitgave", `"status": "draft"`). A short `link` is optional. As a draft it is invisible to visitors until the owner releases it.
5. Check, render previews, commit, push.

## Testing and previews

The viewer repository has the browser check (needs `npm install` there once):

```bash
cd ../3dViewer && node scripts/check.mjs ../prototypes drawings/<NUMBER>/<REV>.html
```

It tests desktop, iPad and iPhone sizes and prints both sheet layouts to PDF (`test-output/`). Look at the screenshots.
Preview images (`PREVIEW_THREE` only where cdnjs is not reachable):

```bash
PREVIEW_THREE=../3dViewer/node_modules/three/build/three.min.js node tools/previews.mjs
```

## Viewer changes

Viewer behaviour and look live in `AfricaBambaata/3dViewer`: change `src/`, raise the version, `npm run release -- ../prototypes`, test the drawings, commit both repositories. 1.x updates reach every drawing through `viewer/1/`.
