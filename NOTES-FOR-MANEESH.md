# Notes for Maneesh

## PLAN.md is a placeholder

`PLAN.md` contains only the placeholder text ("Replace this file with the export…").
The full interface spec (I1–I5, sprint checklists) was not readable during this session.
All interfaces below were inferred from the existing codebase.

## Inferred interface values

| Interface | Key values | Source |
|---|---|---|
| I1 | fine_res=12, coarse_res=9, cell_mode="center", max_cells=16 | geo/out/parcels.json meta |
| I2 | parcels.json schema | geo/out/parcels.json |
| I3 | register_parcel.circom: N=16, N_LEVELS=32, public [oldRoot, newRoot, commitment] | assumed from Sprint 2 spec + I5 |
| I4 | key = Poseidon([cell_dec]), value = 1 | toy circuit spec + circomlib SMT convention |
| I5 | verifyProof(a,b,c, [oldRoot,newRoot,commitment]) | contracts/contracts/LandRegistry.sol |

## Commitment definition (assumption)

PLAN.md I3 was not readable. I defined:

    commitment = Poseidon(cells[0], cells[1], …, cells[N-1])

where N=16, unused cells padded with 0. If the real I3 defines it differently, the
circuit and inputs.js must be updated together — they are the only two files that
touch commitment.

## circom PATH

circom 2.2.3 is installed at `~/.cargo/bin/circom`. It is NOT in the default PATH
that Node/npm scripts see. `build.sh` adds it with:

    export PATH="$HOME/.cargo/bin:$PATH"

If you run circom directly in a fresh terminal, run:

    export PATH="$HOME/.cargo/bin:$PATH"

or add it permanently to ~/.zshrc.

## PLAN.md checkboxes

Because PLAN.md is a placeholder there are no checkboxes to tick. Items below are
tracked by this file and the git log instead.

## Package versions pinned (Group 1)

| Package | Version |
|---|---|
| circomlib | 2.0.5 |
| circomlibjs | 0.1.7 |
| snarkjs | 0.7.6 |
| ethers | 6.17.0 |
| jest | 29.7.0 |

System tools: circom 2.2.3, Node 22.14.0, npm 10.9.2.

## Changelog

- Group 1 (Sprint 0, Maneesh): registrar/ npm setup, build.sh skeleton, .gitignore confirmed.
