import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesSelection } from '../src/services/filterSelection.ts';

test('All includes every value; multiple selections are combined with OR', () => {
    assert.equal(matchesSelection([], 'Pending'), true);
    assert.equal(matchesSelection(['Completed', 'N/A'], 'Completed'), true);
    assert.equal(matchesSelection(['Completed', 'N/A'], 'N/A'), true);
    assert.equal(matchesSelection(['Completed', 'N/A'], 'Pending'), false);
});

test('different filters intersect without changing the summary population', () => {
    const summary = [
        { status: 'Completed', risk: 'HIGH', station: 'A', substation: '1', land: 'Forest' },
        { status: 'N/A', risk: 'LOW', station: 'B', substation: '2', land: 'Urban' },
        { status: 'Pending', risk: 'HIGH', station: 'A', substation: '1', land: 'Forest' },
    ];
    const filtered = summary.filter(p => matchesSelection(['Completed', 'N/A'], p.status)
        && matchesSelection(['HIGH', 'CRITICAL'], p.risk)
        && matchesSelection(['A', 'B'], p.station)
        && matchesSelection(['1', '2'], p.substation)
        && matchesSelection(['Forest', 'Urban'], p.land));
    assert.deepEqual(filtered, [summary[0]]);
    assert.equal(summary.length, 3);
});
