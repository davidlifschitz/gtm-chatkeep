import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import JSZip from "jszip";

// jsdom's Blob has no text/arrayBuffer; app.js and JSZip need them.
function readBlob(b, how) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r[how](b);
  });
}
Blob.prototype.arrayBuffer ??= function () { return readBlob(this, "readAsArrayBuffer"); };
Blob.prototype.text ??= function () { return readBlob(this, "readAsText"); };

// Load index.html's body, then import app.js fresh so each test gets clean state.
export async function boot() {
  const html = readFileSync(join(__dirname, "../index.html"), "utf8");
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");
  const out = [];
  URL.createObjectURL = (b) => (out.push(b), "blob:x");
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {};
  globalThis.JSZip = JSZip;
  vi.resetModules();
  const mod = await import("../app.js");
  return { mod, out, $: (id) => document.getElementById(id) };
}

export async function drop(name, content, type = "text/plain") {
  const input = document.getElementById("file");
  Object.defineProperty(input, "files", { value: [new File([content], name, { type })], configurable: true });
  input.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 100));
}
