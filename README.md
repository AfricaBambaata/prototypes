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
| `viewer/<version>/` | Released builds of the shared viewer (source in the private `3dViewer` repository). Do not edit here |
| `tools/register.mjs` | Register tool, see below |

## Managing drawings (in the browser)

1. Open https://github.com/AfricaBambaata/prototypes/actions/workflows/register.yml
2. Click **Run workflow** (right).
3. Choose the action (**Nieuwe revisie**, **Archiveren**, **Terugzetten uit archief** or **Alleen controleren**), type the drawing number without revision letter (e.g. `MHB-0102`) and, for a new revision, what changed.
4. Click the green **Run workflow**. After about a minute the run shows a green tick and the site is updated.

Only people with write access to this repository see the **Run workflow** button.

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
