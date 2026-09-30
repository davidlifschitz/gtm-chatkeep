import { it, expect } from "vitest";
import JSZip from "jszip";
import { boot, drop } from "./setup.js";

it("parses iOS and Android lines, joins continuation lines, drops the encryption notice", async () => {
  const { mod } = await boot();
  const msgs = mod.parseExport(
    "[1/2/24, 9:01:00 AM] Messages and calls are end-to-end encrypted.\n" +
      "[1/2/24, 9:02:00 AM] Ana: hi\nsecond line\n" +
      "1/3/24, 21:15 - Ben: yo\n"
  );
  expect(msgs).toEqual([
    { date: "1/2/24", time: "9:02:00 AM", author: "Ana", body: "hi\nsecond line" },
    { date: "1/3/24", time: "21:15", author: "Ben", body: "yo" },
  ]);
});

it("reads the chat out of an exported zip and counts it", async () => {
  const { $ } = await boot();
  const zip = new JSZip();
  zip.file("_chat.txt", "[1/2/24, 9:02:00 AM] Ana: hi\n[1/2/24, 9:03:00 AM] Ben: hey\n");
  zip.file("IMG-1.jpg", "x");
  await drop("WhatsApp Chat - Ana.zip", await zip.generateAsync({ type: "uint8array" }), "application/zip");
  expect([$("c-msg").textContent, $("c-people").textContent]).toEqual(["2", "2"]);
  expect($("status").textContent).toContain("WhatsApp Chat - Ana");
});

it("exports CSV and a standalone HTML archive", async () => {
  const { out, $ } = await boot();
  $("sample").click();
  $("csv").click();
  const csv = await out.at(-1).text();
  expect(csv.split("\n")[0]).toBe("date,time,author,body");
  expect(csv.split("\n")).toHaveLength(7);
  $("html").click();
  const html = await out.at(-1).text();
  expect(html).toContain("5 messages · 2 people");
});
