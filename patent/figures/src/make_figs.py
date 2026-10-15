"""Generate IDF-B Fig. 1 (architecture) and Fig. 2 (registration sequence) as SVG.

Usage: python make_figs.py <output dir>   (e.g. patent/figures)
"""
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1])
INK, QUIET, RULE, EDGE = "#1f2328", "#57606a", "#d0d7de", "#6e7781"
ACC, ACC_BG, BAD, OK = "#1f6feb", "#ddf4ff", "#cf222e", "#1a7f37"
FONT = 'font-family="Helvetica, Arial, sans-serif"'


def head(w, h, title, sub):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" {FONT}>',
            '<defs>'
            f'<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{EDGE}"/></marker>'
            f'<marker id="arb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{BAD}"/></marker>'
            f'<marker id="ara" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{ACC}"/></marker>'
            '</defs>',
            f'<rect width="{w}" height="{h}" fill="#ffffff"/>',
            f'<text x="40" y="44" font-size="20" font-weight="700" fill="{INK}">{title}</text>',
            f'<text x="40" y="70" font-size="14" fill="{QUIET}">{sub}</text>']


def box(x, y, w, h, name, lines, accent=False):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{ACC_BG if accent else "#ffffff"}" '
           f'stroke="{ACC if accent else EDGE}" stroke-width="{2 if accent else 1.25}"/>',
           f'<text x="{x + w / 2}" y="{y + 24}" font-size="14" font-weight="700" fill="{INK}" text-anchor="middle">{name}</text>']
    for i, t in enumerate(lines):
        out.append(f'<text x="{x + w / 2}" y="{y + 42 + i * 16}" font-size="12" fill="{INK}" text-anchor="middle">{t}</text>')
    return out


def fig1():
    W, H = 920, 580
    s = head(W, H, "Fig. 1. System architecture",
             "Exact boundaries and fine cells stay with the registrar; the chain enforces non-overlap through the proof.")
    # Containers
    s += [f'<rect x="40" y="96" width="400" height="450" rx="10" fill="none" stroke="{RULE}" stroke-width="1.5"/>',
          f'<text x="60" y="122" font-size="15" font-weight="700" fill="{INK}">Registrar (off-chain, private)</text>',
          f'<rect x="560" y="96" width="320" height="450" rx="10" fill="none" stroke="{RULE}" stroke-width="1.5"/>',
          f'<text x="580" y="122" font-size="15" font-weight="700" fill="{INK}">Public chain (EVM)</text>']
    # Registrar side
    s.append(f'<text x="240" y="150" font-size="13" fill="{QUIET}" text-anchor="middle">Certified parcel polygon (GeoJSON)</text>')
    s.append(f'<line x1="240" y1="158" x2="240" y2="176" stroke="{EDGE}" stroke-width="1.25" marker-end="url(#ar)"/>')
    s += box(70, 178, 340, 72, "Geo pipeline", ["Polygon to fine H3 cells (private, res 12)",
                                                 "and coarse parent cells (public, res 9)"])
    s.append(f'<line x1="240" y1="250" x2="240" y2="288" stroke="{EDGE}" stroke-width="1.25" marker-end="url(#ar)"/>')
    s.append(f'<text x="250" y="273" font-size="12" fill="{QUIET}">fine cells</text>')
    s += box(70, 290, 340, 72, "Occupied-cell sparse Merkle tree", ["Key Poseidon(cell), value 1, depth 32",
                                                                     "Insert into an occupied slot fails"])
    s.append(f'<line x1="240" y1="362" x2="240" y2="400" stroke="{EDGE}" stroke-width="1.25" marker-end="url(#ar)"/>')
    s.append(f'<text x="250" y="385" font-size="12" fill="{QUIET}">old and new roots, siblings</text>')
    s += box(70, 402, 340, 72, "Groth16 prover (Circom circuit)", ["Cells match the salted commitment;",
                                                                   "each cell went into an empty slot"])
    s.append(f'<text x="240" y="508" font-size="12.5" fill="{BAD}" text-anchor="middle">Never leaves the registrar:</text>')
    s.append(f'<text x="240" y="526" font-size="12.5" fill="{BAD}" text-anchor="middle">exact polygon, fine cells, salt</text>')
    # Chain side
    s += box(580, 178, 280, 72, "Groth16Verifier", ["verifyProof(a, b, c,", "[oldRoot, newRoot, commitment])"])
    s += box(580, 318, 280, 136, "LandRegistry (ERC-721)", [
        "Checks, in order:", "1 caller has REGISTRAR_ROLE", "2 coarse cells not empty",
        "3 oldRoot equals occupiedRoot", "4 commitment unused, 5 proof valid",
        "Then: root = newRoot, mint to owner"], accent=True)
    s.append(f'<line x1="720" y1="318" x2="720" y2="252" stroke="{EDGE}" stroke-width="1.25" marker-end="url(#ar)"/>')
    s.append(f'<text x="730" y="289" font-size="12" fill="{QUIET}">verifyProof</text>')
    s.append(f'<text x="720" y="496" font-size="12.5" fill="{OK}" text-anchor="middle">Public: roots, commitment,</text>')
    s.append(f'<text x="720" y="514" font-size="12.5" fill="{OK}" text-anchor="middle">coarse cells, owner, token ID</text>')
    # Cross arrow
    s.append(f'<line x1="410" y1="438" x2="578" y2="438" stroke="{ACC}" stroke-width="1.75" marker-end="url(#ara)"/>')
    for i, t in enumerate(["registerParcel:", "proof, 3 public", "signals, coarse", "cells, owner"]):
        s.append(f'<text x="500" y="{372 + i * 15}" font-size="11.5" fill="{ACC}" text-anchor="middle">{t}</text>')
    s.append("</svg>")
    (OUT / "fig1_architecture.svg").write_text("\n".join(s) + "\n")


def fig2():
    W, H = 940, 760
    s = head(W, H, "Fig. 2. Registration sequence",
             "A parcel is minted only if every fine cell enters an empty slot and the contract verifies the proof.")
    xs = {"sur": 100, "reg": 290, "tree": 490, "lr": 690, "ver": 860}
    names = {"sur": ["Surveyor or", "land office"], "reg": ["Registrar", "service"], "tree": ["Occupied-cell", "tree"],
             "lr": ["LandRegistry", "contract"], "ver": ["Groth16", "Verifier"]}
    top, bottom = 140, H - 30
    for k, x in xs.items():
        s.append(f'<line x1="{x}" y1="{top}" x2="{x}" y2="{bottom}" stroke="{RULE}" stroke-width="1.5" stroke-dasharray="5 4"/>')
        s.append(f'<rect x="{x - 75}" y="96" width="150" height="44" rx="8" fill="#ffffff" stroke="{EDGE}" stroke-width="1.25"/>')
        for i, t in enumerate(names[k]):
            s.append(f'<text x="{x}" y="{114 + i * 16}" font-size="13" font-weight="700" fill="{INK}" text-anchor="middle">{t}</text>')

    def msg(a, b, y, label, color=EDGE, dashed=False, marker="ar", tcol=INK):
        x1, x2 = xs[a], xs[b]
        pad = 2 if x2 > x1 else -2
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        s.append(f'<line x1="{x1}" y1="{y}" x2="{x2 - pad}" y2="{y}" stroke="{color}" stroke-width="1.5"{dash} marker-end="url(#{marker})"/>')
        s.append(f'<text x="{(x1 + x2) / 2}" y="{y - 7}" font-size="12" fill="{tcol}" text-anchor="middle" stroke="#ffffff" stroke-width="4" paint-order="stroke">{label}</text>')

    def note(k, y, lines, w=200, color=EDGE, bg="#ffffff"):
        x = xs[k] - w / 2
        h = 14 + 16 * len(lines)
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{bg}" stroke="{color}" stroke-width="1.25"/>')
        for i, t in enumerate(lines):
            s.append(f'<text x="{xs[k]}" y="{y + 19 + i * 16}" font-size="12" fill="{INK}" text-anchor="middle">{t}</text>')
        return y + h

    def step(n, y):
        s.append(f'<circle cx="24" cy="{y - 4}" r="11" fill="{INK}"/>')
        s.append(f'<text x="24" y="{y}" font-size="11.5" font-weight="700" fill="#ffffff" text-anchor="middle">{n}</text>')

    y = 182; step(1, y); msg("sur", "reg", y, "certified polygon")
    y = 204; step(2, y + 22); note("reg", y, ["Fine + coarse cells,", "random salt, commitment"])
    y = 278; step(3, y); msg("reg", "tree", y, "insert each fine cell")
    y = 318; step(4, y); msg("tree", "reg", y, "old root, siblings, new root", dashed=True)
    # Overlap frame
    s.append(f'<rect x="180" y="334" width="420" height="58" rx="4" fill="none" stroke="{BAD}" stroke-width="1.25"/>')
    s.append(f'<rect x="180" y="334" width="190" height="20" fill="{BAD}"/>')
    s.append(f'<text x="188" y="348" font-size="11.5" font-weight="700" fill="#ffffff">if any cell is already taken</text>')
    msg("tree", "reg", 380, "insert fails: report overlap, stop", color=BAD, dashed=True, marker="arb", tcol=BAD)
    y = 408; step(5, y + 22); note("reg", y, ["Groth16 proof; public signals", "oldRoot, newRoot, commitment"], w=210)
    y = 484; step(6, y); msg("reg", "lr", y, "registerParcel(proof, signals, coarse cells)", color=ACC, marker="ara", tcol=ACC)
    y = 500; step(7, y + 28); note("lr", y, ["Check role, coarse cells,", "oldRoot equals occupiedRoot,", "commitment unused"], w=210, color=ACC, bg=ACC_BG)
    y = 590; step(8, y); msg("lr", "ver", y, "verifyProof")
    y = 622; step(9, y); msg("ver", "lr", y, "true", dashed=True)
    y = 636; step(10, y + 22); note("lr", y, ["root = newRoot; mint NFT;", "emit ParcelRegistered"], w=210, color=ACC, bg=ACC_BG)
    y = 702; step(11, y); msg("lr", "reg", y, "transaction confirmed", dashed=True)
    y = 712; step(12, y + 17); note("reg", y, ["Save tree and salt"])
    s.append("</svg>")
    (OUT / "fig2_registration_sequence.svg").write_text("\n".join(s) + "\n")


fig1()
fig2()
print("wrote fig1_architecture.svg, fig2_registration_sequence.svg")
