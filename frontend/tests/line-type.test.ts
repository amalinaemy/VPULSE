import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesLineType } from "../src/services/lineType.ts";

test("line type matches MV/LV labels without guessing unknown choices", () => {
    for (const value of ["MV", " mv ", "Medium Voltage", "MV OHL", " mv   ohl "]) {
        assert.equal(matchesLineType(value, "MV"), true);
        assert.equal(matchesLineType(value, "LV"), false);
    }
    for (const value of ["LV", " lv ", "Low Voltage", "LV OHL", " lv   ohl "]) {
        assert.equal(matchesLineType(value, "LV"), true);
        assert.equal(matchesLineType(value, "MV"), false);
    }
    for (const value of [null, undefined, "", "HV", "HV OHL", "NOT MV OHL", 1]) {
        assert.equal(matchesLineType(value, "ALL"), true);
        assert.equal(matchesLineType(value, "MV"), false);
        assert.equal(matchesLineType(value, "LV"), false);
    }
});
