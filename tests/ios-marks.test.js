import { it, expect } from "vitest";
import { boot } from "./setup.js";

// Real iOS exports start attachment/deleted lines with U+200E and put U+202F before AM/PM.
it("keeps iOS lines that start with an invisible left-to-right mark", async () => {
  const { mod } = await boot();
  const msgs = mod.parseExport(
    "[1/2/24, 9:02:00\u202fAM] Ana: look\n" +
      "\u200e[1/2/24, 9:02:10\u202fAM] Ana: \u200eimage omitted\n" +
      "\u200e[1/2/24, 9:03:00\u202fAM] Ben: \u200eThis message was deleted.\n"
  );
  expect(msgs.map((m) => m.author)).toEqual(["Ana", "Ana", "Ben"]);
  expect(msgs[0].body).toBe("look");
  expect(msgs[1].body).toBe("image omitted");
  expect(msgs[1].time).toBe("9:02:10 AM");
});
