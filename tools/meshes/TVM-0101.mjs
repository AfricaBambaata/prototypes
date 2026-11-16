// Net voor TVM-0101 (houten blok onder de tv): exacte booleaanse bewerking met manifold-3d.
// Leest de maten uit het blok /* params */ van de tekening en schrijft het gesloten driehoeksnet en de
// doorsnede in het blok /* mesh */ van dezelfde tekening.
//
//   cd tools/meshes && npm i --no-save manifold-3d@3.5.5 && node TVM-0101.mjs ../../drawings/TVM-0101/A.html
//
// Alleen voor revisies in bewerking: een vrijgegeven revisie verandert nooit.
import { readFileSync, writeFileSync } from 'node:fs';
import Module from 'manifold-3d';

const file = process.argv[2];
if (!file) { console.error('gebruik: node TVM-0101.mjs <tekening.html>'); process.exit(1); }
let html = readFileSync(file, 'utf8');
const P = JSON.parse(html.match(/\/\* params \*\/([\s\S]*?)\/\* \/params \*\//)[1]);

const wasm = await Module(); wasm.setup();
const { Manifold, CrossSection } = wasm;
const { W, L, T, tilt, bevelLen, endT, gW, gLand, gDepth, gN, rW, rH, rY0, rDepth, rR, nW, nDepth, secX } = P;
const A = W / 2, tanT = Math.tan(tilt * Math.PI / 180);

// Plaatassen: x breedte (midden 0), y langs de plaat (voorste onderrand 0), z dikte (voorkant 0, achterkant -T).
// Bovenaanzicht (x, -z) met de afgeschuinde achterhoeken, langs y geëxtrudeerd.
// (punten als [x, afstand vanaf de voorkant]; aan het uiteinde blijft endT over, de schuine kant loopt tot de volle dikte)
const plan = [[-A, 0], [A, 0], [A, endT], [A - bevelLen, T], [-A + bevelLen, T], [-A, endT]];
let body = new CrossSection([plan], 'NonZero').extrude(L + 40).translate([0, 0, -20]).rotate([-90, 0, 0]);
body = body.trimByPlane([0, -1, 0], -L);                                  // bovenkant haaks op y = L
const n = [0, 1, -tanT], ln = Math.hypot(...n);
body = body.trimByPlane(n.map(v => v / ln), 0);                           // onderkant vlak op de vloer bij 90° + tilt

const cut = [];
// Bovenste groef langs de bovenrand; daaronder om de gLand een volgende.
for (let i = 0; i < gN; i++) {
  // 0,002 dieper dan opgegeven, zodat groefbodem en uitsparing niet exact samenvallen (geen vlies van dikte 0)
  cut.push(Manifold.cube([W + 100, gW, gDepth + 10]).translate([-A - 50, L - gW - i * (gW + gLand), -gDepth - 0.002]));
}
const pocket = CrossSection.square([rW - 2 * rR, rH - 2 * rR], true).offset(rR, 'Round', 2, 48).translate([0, rY0 + rH / 2]);
cut.push(pocket.extrude(rDepth + 10).translate([0, 0, -T - 10]));
cut.push(Manifold.cube([nW, nDepth + 10, T + 20]).translate([-nW / 2, L - nDepth, -T - 10]));
const part = body.subtract(Manifold.union(cut));

const mesh = part.getMesh();
const pos = Float32Array.from(mesh.vertProperties);
const nv = pos.length / 3;
const idx = nv < 65536 ? Uint16Array.from(mesh.triVerts) : Uint32Array.from(mesh.triVerts);
// Doorsnede op x = secX als veelhoeken [y, z]
const sec = part.rotate([0, -90, 0]).slice(secX).toPolygons()
  .map(p => p.map(([a, b]) => [+b.toFixed(3), +(-a).toFixed(3)]));
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const data = { pos: b64(pos), idx: b64(idx), idx32: idx instanceof Uint32Array, sec };

html = html.replace(/\/\* mesh \*\/[\s\S]*?\/\* \/mesh \*\//, `/* mesh */ ${JSON.stringify(data)} /* /mesh */`);
writeFileSync(file, html);
console.log(`${file}: ${nv} punten, ${idx.length / 3} driehoeken, genus ${part.genus()}, volume ${(part.volume() / 1e6).toFixed(2)} dm³`);
