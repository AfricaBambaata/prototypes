# Prototypes

Interactive 3D technical drawings, served with GitHub Pages. Start at `index.html`, the drawing register.

## Drawings

| Drawing | Title | Language | Short link |
| --- | --- | --- | --- |
| MHB-0200-A | Trapleuning met muurhouders | nl | `trapleuning.html` |
| MHB-0102-A | Muurhouder buis | nl | `muurhouder.html` |
| SLV-0101-A | Spacer sleeve | en | `spacer-sleeve.html` |
| BRK-0417-B | Bearing bracket | en | `bearing-bracket.html` |

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Register page: current drawings, revision history, archive. Reads `drawings.json` |
| `drawings.json` | The register: number, title, description, status (`current` or `archived`) and revisions per drawing |
| `drawings/<number>/<rev>.html` | One file per revision. A released revision is never edited again |
| `drawings/<number>/` | Always opens the latest revision |
| `trapleuning.html` etc. | Short links that forward to `drawings/<number>/` |
| `viewer/1/` | The shared viewer every drawing uses: always the latest 1.x release (source in the private `3dViewer` repository). Do not edit here |
| `viewer/<version>/` | Fixed copies of each release, for drawings that must never change |
| `previews/` | Link preview images, one per revision (made by `tools/previews.mjs`) |
| `tools/register.mjs` | Register tool, see below |

## Sharing a drawing

Use **Delen** in the viewer, or **⋯ → Delen…** on the register page. By default the link always opens the latest revision (`drawings/<number>/`); choose **Alleen revisie X** to share that one revision (`drawings/<number>/<rev>.html`). The share sheet shows a QR code, copies the link, and opens Mail, WhatsApp or (on iPhone, iPad and Mac) the system share sheet.

## Link previews

Shared links show a card with the drawing's name, number and a picture of the model in WhatsApp, Mail, iMessage, Teams and similar apps. The "Voorbeeldbeelden" workflow (`.github/workflows/previews.yml`) renders `previews/<number>-<rev>.jpg` with `tools/previews.mjs` after every new revision or change to a drawing or the viewer, and `tools/register.mjs check` writes the matching preview tags (between `<!-- link-preview -->` markers in each revision file, and in the short link pages). The tags only describe the page; the drawing is not changed. Apps cache previews, so a link already shared keeps its old card for a while.

## Managing drawings (on the register page)

Open the register page and click **Beheer**. The first time on a device, the page asks for a GitHub access token; the dialog explains how to make one (fine-grained, only the `prototypes` repository, *Actions* and *Contents* both *Read and write*). The token is stored only in that browser and is sent only to api.github.com.

Signed in, every drawing gets **Nieuwe revisie** and **Archiveren** (or **Terugzetten** in the archive), plus **Register controleren** at the top. Archiving and restoring change one line in `drawings.json`; the page saves that straight to the repository (a second or two). A new revision and the check start the "Tekeningen beheren" workflow (`.github/workflows/register.yml`), which runs `tools/register.mjs` on GitHub and commits the result (about half a minute); the page shows its progress. The public site follows about a minute after each change. Only accounts with write access to this repository can make changes.

The same workflow can also be started under **Actions → Tekeningen beheren → Run workflow**.

## Managing drawings (command line)

The same tool, run on a computer with Node.js:

```bash
node tools/register.mjs revise MHB-0102 --note "Langere klemstaaf"
```

Creates `drawings/MHB-0102/B.html` as a copy of the latest revision, with the drawing number and register block updated, and adds it to the register. Then edit the new file. Revision A stays online, and when someone opens it, it shows a "superseded" banner with a link to the current revision. Printouts of it carry "Vervallen" in the title block. Add `--viewer 1.1.0` to move the new revision to a newer viewer.

```bash
node tools/register.mjs archive SLV-0101
```

Moves a drawing to the archive section of the register. When opened, it shows an "archived" banner. `restore` brings it back.

```bash
node tools/register.mjs check
```

Checks that every revision file exists, uses a released viewer and matches the register. It also rewrites the short links. Run it before every commit.
