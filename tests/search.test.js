import { it, expect } from "vitest";
import { boot, drop } from "./setup.js";

const chat = "[1/2/24, 9:02:00 AM] Ana: fish & chips <3\n[1/2/24, 9:03:00 AM] Ben: amp it up\n";

function search(q) {
  const el = document.getElementById("q");
  el.value = q;
  el.dispatchEvent(new Event("input"));
  return [...document.querySelectorAll("#log article p")];
}

it("highlighting never mangles escaped characters", async () => {
  await boot();
  await drop("c.txt", chat);
  const ps = search("amp");
  expect(ps.map((p) => p.textContent)).toEqual(["amp it up"]);
  expect(search("a")[0].textContent).toBe("fish & chips <3");
});

it("finds and highlights & and <", async () => {
  await boot();
  await drop("c.txt", chat);
  const ps = search("& chips <");
  expect(ps).toHaveLength(1);
  expect(ps[0].querySelector("mark").textContent).toBe("& chips <");
});
