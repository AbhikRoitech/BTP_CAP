/**
 * Configuration regression tests.
 *
 * There is no domain model yet, so there is nothing functional to test. What
 * there IS to protect are the Phase 0 decisions now encoded in package.json —
 * and those are exactly the kind of thing that gets "tidied up" by someone who
 * does not know why they are there.
 *
 * Every assertion below cites the decision it guards.
 *
 * Replaced by real service tests from Step 27 onward; these stay as a floor.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cds from '@sap/cds'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

describe('ADR 001 — Node.js version policy', () => {
  test('engines.node states the compatibility contract, loosely', () => {
    assert.equal(
      pkg.engines?.node,
      '>=22',
      'engines.node must stay ">=22". A tighter pin (e.g. "24.x") turns an ' +
      'unknown about the Cloud Foundry buildpack into a staging failure. ' +
      'See docs/adr/001-node-version.md.'
    )
  })

  test('the running Node satisfies that contract', () => {
    const major = Number(process.versions.node.split('.')[0])
    assert.ok(
      major >= 22,
      `Node ${process.versions.node} is below the CAP 10 minimum of 22.`
    )
  })
})

describe('D18 — the three test users', () => {
  const users = cds.env.requires?.auth?.users ?? {}

  test('emma is an Employee only', () => {
    assert.deepEqual(users.emma?.roles, ['Employee'])
  })

  test('max is an Employee AND a Manager', () => {
    assert.deepEqual(
      users.max?.roles,
      ['Employee', 'Manager'],
      'Manager must also carry Employee. Role collections compose — ' +
      'a manager raises their own orders too. See ADR 002.'
    )
  })

  test('admin is an Admin only, and is NOT a Manager', () => {
    assert.deepEqual(users.admin?.roles, ['Admin'])
    assert.ok(
      !users.admin.roles.includes('Manager'),
      'Separation of duties: an Administrator must not be able to approve ' +
      'orders. See ADR 002 and security-matrix.md.'
    )
  })
})

describe('A12 — authentication switches by profile', () => {
  // The resolved dev value comes from cds.env. The profile OVERRIDES are
  // asserted against package.json directly: CAP's profile resolution is CAP's
  // business, and loading a second profile in-process means re-importing
  // @sap/cds. What we need to guard is that the override blocks exist and say
  // the right thing — that is our configuration, and ours to get wrong.

  test('development uses mocked auth', () => {
    assert.equal(cds.env.requires.auth.kind, 'mocked')
  })

  test('a [production] override exists and selects xsuaa', () => {
    assert.equal(
      pkg.cds?.requires?.auth?.['[production]']?.kind,
      'xsuaa',
      'Production must validate real JWTs. See docs/environments.md §2.'
    )
  })

  test('a [hybrid] override exists and selects xsuaa', () => {
    assert.equal(
      pkg.cds?.requires?.auth?.['[hybrid]']?.kind,
      'xsuaa',
      'Phase 5 runs locally against a real XSUAA instance. ' +
      'Without this profile, cds bind has nothing to bind into.'
    )
  })
})

describe('Local database', () => {
  test('development uses sqlite', () => {
    assert.equal(cds.env.requires.db?.kind, 'sqlite')
  })
})
