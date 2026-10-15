# ADR 001 — Node.js version policy

Date: 2026-10-15
Status: Accepted

## Context

CAP, our local machine, GitHub Actions and the Cloud Foundry Node.js buildpack
each have an opinion about which Node.js version runs our code. If they disagree,
the failure shows up late — at `cf push` during staging — with a
`DEPENDENCY_MISSING_IN_MANIFEST` error that is hard to connect back to its cause.

Verified facts, as of 2026-10-15:

| Source | Finding |
| --- | --- |
| Local machine | Node v24.11.1, npm 10.8.2 |
| `@sap/cds` 10.1.0 (bundled in cds-dk) | `engines.node` is `>=22` |
| CAP docs, cds 10 | Node 22 is the minimum; Node 20 is EOL and unsupported; Node 24 is recommended |
| CF `nodejs-buildpack` v1.9.5 | Ships Node 22.23.3 and 24.21.0. **Default line is 22.x.** Stacks: cflinuxfs4, cflinuxfs5 |

So Node 24 is valid everywhere, but it is not the buildpack's default — the
buildpack only selects it if we ask for it.

Not yet verified: which buildpack version our specific BTP landscape actually
carries. That needs `cf buildpacks` against a real login, which we do not have
until Step 49.

## Decision

Split the two concerns that `engines` is usually asked to do at once:

1. **`package.json` → `engines.node: ">=22"`** — the *compatibility contract*.
   States what the code genuinely requires. Deliberately loose, so the buildpack
   is free to pick the newest line it has. A tight pin like `24.11.1` would make
   staging fail on any landscape that lacks that exact build.

2. **`.nvmrc` → `24`, and the same in the CI matrix** — the *parity contract*.
   States what we develop and test on, so local, CI and (once confirmed) the
   cloud all run the same major version.

Re-verify with `cf buildpacks` at Step 49, before the first deploy. If the
landscape's buildpack does not carry 24.x, drop local and CI to 22 rather than
loosening parity.

## Alternatives considered

- **Pin `engines.node` to `24.x`.** Better dev/prod parity, stated in one place.
  Rejected: it converts an unknown about the landscape into a hard staging
  failure, and we cannot check that landscape until Step 49.
- **Omit `engines` entirely.** Buildpack picks its default, 22.x. Rejected: it
  silently allows a Node older than CAP 10 requires, and the resulting failure is
  a confusing runtime crash rather than a clear staging refusal.
- **Downgrade local to Node 22 now,** matching the buildpack default. Rejected:
  24 is CAP's recommended line and is available in the buildpack; matching a
  default we can override costs us the newer runtime for no gain.

## Consequences

- Local, CI and cloud all run Node 24 — provided Step 49 confirms the buildpack.
- A developer on Node 20 gets a clear `npm install` refusal, not a mystery crash.
- Two files now carry version information and can drift apart. Step 49 is the
  checkpoint that reconciles them.
- Revisit when Node 26 becomes Active LTS (expected October 2026) or when the
  landscape's buildpack is upgraded.
