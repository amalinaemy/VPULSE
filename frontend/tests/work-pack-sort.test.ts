import assert from "node:assert/strict";
import test from "node:test";
import { comparePoleIds, sortWorkPackPoles } from "../src/services/workPackSort.ts";

test("Pole IDs follow numeric order across the full filtered list", () => {
    const poles = ["2", "101", "10", "1", "100"].map(poleId => ({ poleId }));
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdAsc").map(p => p.poleId), ["1", "2", "10", "100", "101"]);
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdDesc").map(p => p.poleId), ["101", "100", "10", "2", "1"]);
    assert.deepEqual(sortWorkPackPoles(poles, "priority"), poles);
    assert.equal(poles[0].poleId, "2");
});

test("Sorting keeps filtered membership, duplicate priority order and handles missing IDs", () => {
    const poles = [{ poleId: "A", rank: 1 }, { poleId: null, rank: 2 }, { poleId: "A", rank: 3 }];
    assert.deepEqual(sortWorkPackPoles(poles, "poleIdAsc").map(p => p.rank), [2, 1, 3]);
    assert.deepEqual(sortWorkPackPoles([], "poleIdDesc"), []);
});


test("Both views use numeric comparison for the reported KIK IDs and embedded numbers", () => {
    const ids = ["252 KIK KSC 251", "251 KIK KSC 250", "250 KIK KSC 249", "25 KIK KSC 25", "249 KIK KSC 248", "248 KIK KSC 247"];
    const expected = [ids[0], ids[1], ids[2], ids[4], ids[5], ids[3]];
    assert.deepEqual([...ids].sort((a, b) => -comparePoleIds(a, b)), expected);
    assert.deepEqual(sortWorkPackPoles(ids.map(poleId => ({ poleId })), "poleIdDesc").map(p => p.poleId), expected);
    assert.ok(comparePoleIds("KG_IJOK_9", "KG_IJOK_144") < 0);
    assert.ok(comparePoleIds("1 KIK KSC 2", "1 KIK KSC 10") < 0);
    assert.equal(comparePoleIds(" 25 KIK KSC 25 ", "25 kik ksc 25"), 0);
});
