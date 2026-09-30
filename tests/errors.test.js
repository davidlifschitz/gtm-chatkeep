import { it, expect } from "vitest";
import JSZip from "jszip";
import { boot, drop } from "./setup.js";

it("says so when a zip has no chat inside", async () => {
  const { $ } = await boot();
  const zip = new JSZip();
  zip.file("IMG-1.jpg", "x");
  await drop("photos.zip", await zip.generateAsync({ type: "uint8array" }), "application/zip");
  expect($("error").hidden).toBe(false);
  expect($("error").textContent).toMatch(/No \.txt chat export/);
});

it("says so when a zip is corrupt", async () => {
  const { $ } = await boot();
  await drop("broken.zip", "not a zip", "application/zip");
  expect($("error").hidden).toBe(false);
  expect($("error").textContent).toMatch(/zip/i);
});

it("CSV doesn't let a message run as a spreadsheet formula", async () => {
  const { out, $ } = await boot();
  await drop("c.txt", "[1/2/24, 9:02:00 AM] Ana: =HYPERLINK(\"http://x\")\n[1/2/24, 9:03:00 AM] Ben: -5 degrees\n");
  $("csv").click();
  const lines = (await out.at(-1).text()).split("\n");
  expect(lines[1]).toBe(`1/2/24,9:02:00 AM,Ana,"'=HYPERLINK(""http://x"")"`);
  expect(lines[2]).toBe("1/2/24,9:03:00 AM,Ben,'-5 degrees");
});
