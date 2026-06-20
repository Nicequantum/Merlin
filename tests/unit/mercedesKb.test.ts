import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getSuggestions, resolveMercedesKbKey } from '../../src/utils/mercedesKb';
import type { RepairOrder } from '../../src/types';

function roWithModel(model: string, extras: Partial<RepairOrder['vehicle']> = {}): RepairOrder {
  return {
    id: 'ro-1',
    roNumber: '123',
    vehicle: {
      vin: 'W1N4N4HB5NJ123456',
      year: '2022',
      make: 'Mercedes-Benz',
      model,
      mileageIn: '48250',
      mileageOut: '',
      ...extras,
    },
    customer: { name: 'Test' },
    complaints: [],
    repairLines: [],
  };
}

describe('mercedesKb', () => {
  test('resolveMercedesKbKey maps NHTSA *-Class models to correct families', () => {
    assert.equal(resolveMercedesKbKey(roWithModel('GLA-Class').vehicle).key, 'C');
    assert.equal(resolveMercedesKbKey(roWithModel('C-Class').vehicle).key, 'C');
    assert.equal(resolveMercedesKbKey(roWithModel('E-Class').vehicle).key, 'E');
    assert.equal(resolveMercedesKbKey(roWithModel('S-Class').vehicle).key, 'S');
    assert.equal(resolveMercedesKbKey(roWithModel('GLE-Class').vehicle).key, 'GLE');
  });

  test('resolveMercedesKbKey distinguishes SUV models from generic default', () => {
    assert.equal(resolveMercedesKbKey(roWithModel('GLE 450 4MATIC').vehicle).key, 'GLE');
    assert.equal(resolveMercedesKbKey(roWithModel('GLS 580').vehicle).key, 'GLE');
    assert.notEqual(resolveMercedesKbKey(roWithModel('GLA-Class').vehicle).key, 'S');
    assert.notEqual(resolveMercedesKbKey(roWithModel('C-Class').vehicle).key, 'S');
  });

  test('resolveMercedesKbKey uses engine model when model is missing', () => {
    assert.equal(resolveMercedesKbKey(roWithModel('', { engine: '2.0L 4-cyl M260' }).vehicle).key, 'C');
    assert.equal(resolveMercedesKbKey(roWithModel('', { engine: '3.0L 6-cyl M256' }).vehicle).key, 'S');
  });

  test('getSuggestions returns family-specific issues for decoded VIN models', () => {
    const gla = getSuggestions(roWithModel('GLA-Class', { engine: '2.0L 4-cyl M260' }));
    const gle = getSuggestions(roWithModel('GLE 450', { mileageIn: '50000' }));
    const sClass = getSuggestions(roWithModel('S-Class', { mileageIn: '50000' }));

    assert.match(gla.bandNote, /GLA/i);
    assert.match(gla.issues.join(' '), /timing chain|conductor plate/i);
    assert.match(gle.issues.join(' '), /injector|turbo|Airmatic/i);
    assert.match(sClass.issues.join(' '), /injector|suspension|wiring/i);
    assert.notDeepEqual(gla.issues, gle.issues);
    assert.notDeepEqual(gla.issues, sClass.issues);
  });
});