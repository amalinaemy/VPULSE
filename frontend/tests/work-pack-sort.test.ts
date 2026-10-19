import assert from "node:assert/strict";
import test from "node:test";
import { sortWorkPackPoles } from "../src/services/workPackSort.ts";

test("Pole IDs follow Engineer lexical order across the full filtered list", () => {
    const poles = ["2", "101", "10", "1", "100"].map(poleId => ({ poleId }));
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdAsc").map(p => p.poleId), ["1", "10", "100", "101", "2"]);
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdDesc").map(p => p.poleId), ["2", "101", "100", "10", "1"]);
    assert.deepEqual(sortWorkPackPoles(poles, "priority"), poles);
    assert.equal(poles[0].poleId, "2");
});

test("Sorting keeps filtered membership, duplicate priority order and handles missing IDs", () => {
    const poles = [{ poleId: "A", rank: 1 }, { poleId: null, rank: 2 }, { poleId: "A", rank: 3 }];
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdAsc").map(p => p.rank), [2, 1, 3]);
    assert.deepEqual(sortWorkPackPoles([], "poleIdDesc"), []);
});
