const MAX_BYTES = 15 * 1024 * 1024;

const IOS =
  /^\[(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\]\s(?:([^:]+?):\s)?([\s\S]*)$/;
const ANDROID =
  /^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\s[-\u2013]\s(?:([^:]+?):\s)?([\s\S]*)$/;

const els = {
  drop: document.getElementById("drop"),
  file: document.getElementById("file"),
  pick: document.getElementById("pick"),
  sample: document.getElementById("sample"),
  status: document.getElementById("status"),
  error: document.getElementById("error"),
  counts: document.getElementById("counts"),
  q: document.getElementById("q"),
  log: document.getElementById("log"),
  html: document.getElementById("html"),
  csv: document.getElementById("csv"),
};

let state = { name: "", messages: [] };

function setError(msg) {
  els.error.hidden = !msg;
  els.error.textContent = msg || "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function parseExport(text) {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const messages = [];
  for (let line of lines) {
    // iOS prefixes attachment/deleted lines with U+200E and uses U+202F before AM/PM.
    line = line.replace(/^[\u200e\u200f]+/, "").replace(/^(\[?[^\]]{0,40}?)\u202f/, "$1 ");
    if (!line.trim()) continue;
    const ios = line.match(IOS);
    const and = ios ? null : line.match(ANDROID);
    const m = ios || and;
    if (m) {
      messages.push({
        date: m[1],
        time: m[2],
        author: (m[3] || "system").trim(),
        body: (m[4] || "").replace(/^[\u200e\u200f]+/, ""),
      });
    } else if (messages.length) {
      messages[messages.length - 1].body += "\n" + line;
    }
  }
  return messages.filter((msg) => {
    const b = msg.body.trim();
    if (/^messages and calls are end-to-end encrypted/i.test(b)) return false;
    if (/^this chat is with a business account/i.test(b)) return false;
    return true;
  });
}

function csvEscape(s) {
  const t = String(s).replaceAll('"', '""');
  return /[",\n]/.test(t) ? `"${t}"` : t;
}

function toCsv(messages) {
  const rows = ["date,time,author,body"];
  for (const m of messages) {
    rows.push([m.date, m.time, m.author, m.body].map(csvEscape).join(","));
  }
  return rows.join("\n") + "\n";
}

function toHtml(name, messages) {
  const people = [...new Set(messages.map((m) => m.author))];
  const body = messages
    .map(
      (m) => `<article>
  <div><span class="who">${escapeHtml(m.author)}</span> <span class="when">${escapeHtml(m.date)} ${escapeHtml(m.time)}</span></div>
  <p>${escapeHtml(m.body)}</p>
</article>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(name)} — ChatKeep archive</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 44rem; margin: 2rem auto; padding: 0 1rem; color: #1c1917; }
  .meta { color: #57534e; }
  input { width: 100%; padding: .7rem; margin: 1rem 0; font: inherit; }
  article { border-bottom: 1px solid #e7e5e4; padding: .7rem 0; }
  .who { font-weight: 600; } .when { color: #57534e; font-size: .8rem; }
  p { white-space: pre-wrap; word-break: break-word; margin: .2rem 0 0; }
  .hide { display: none; }
</style>
</head>
<body>
<h1>${escapeHtml(name)}</h1>
<p class="meta">${messages.length} messages · ${people.length} people · kept as a local file</p>
<input id="q" placeholder="Search this chat…"/>
${body}
<script>
const q = document.getElementById('q');
q.addEventListener('input', () => {
  const n = q.value.trim().toLowerCase();
  for (const a of document.querySelectorAll('article')) {
    a.classList.toggle('hide', n && !a.textContent.toLowerCase().includes(n));
  }
});
</script>
</body>
</html>`;
}

function render() {
  const messages = state.messages;
  const people = new Set(messages.map((m) => m.author));
  const days = new Set(messages.map((m) => m.date));
  els.status.textContent = messages.length
    ? `${state.name} · ${messages.length} messages · files stayed in this tab`
    : "Waiting for an export.";
  els.counts.hidden = !messages.length;
  document.getElementById("c-msg").textContent = String(messages.length);
  document.getElementById("c-people").textContent = String(people.size);
  document.getElementById("c-days").textContent = String(days.size);
  els.q.hidden = !messages.length;
  els.log.hidden = !messages.length;
  paintLog(els.q.value);
  els.html.disabled = !messages.length;
  els.csv.disabled = !messages.length;
}

function paintLog(query) {
  const n = (query || "").trim().toLowerCase();
  const shown = n
    ? state.messages.filter((m) => `${m.author} ${m.body} ${m.date}`.toLowerCase().includes(n))
    : state.messages;
  const slice = shown.slice(0, 400);
  els.log.innerHTML = slice
    .map((m) => {
      // Match on the raw text and escape each piece, so a query like "amp" can't
      // land inside an &amp; entity and "&" or "<" still highlight.
      let body = escapeHtml(m.body);
      if (n) {
        const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        body = m.body
          .split(new RegExp(`(${re.source})`, "gi"))
          .map((part, i) => (i % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
          .join("");
      }
      return `<article><div><span class="who">${escapeHtml(m.author)}</span><span class="when">${escapeHtml(m.date)} ${escapeHtml(m.time)}</span></div><p>${body}</p></article>`;
    })
    .join("");
  if (shown.length > 400) {
    els.log.innerHTML += `<article class="meta">Showing 400 of ${shown.length} matches.</article>`;
  }
}

async function readTextFile(file) {
  return file.text();
}

async function fromZip(file) {
  const zip = await JSZip.loadAsync(file);
  const txts = Object.keys(zip.files).filter((p) => /\.txt$/i.test(p) && !zip.files[p].dir);
  const prefer =
    txts.find((p) => /_chat\.txt$/i.test(p)) ||
    txts.find((p) => /whatsapp/i.test(p)) ||
    txts[0];
  if (!prefer) throw new Error("No .txt chat export inside that zip.");
  return zip.files[prefer].async("string");
}

async function ingest(file) {
  setError("");
  if (file.size > MAX_BYTES) {
    setError(`${file.name} is over 15 MB.`);
    return;
  }
  let text;
  if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
    text = await fromZip(file);
  } else {
    text = await readTextFile(file);
  }
  const messages = parseExport(text);
  if (!messages.length) {
    setError("That file does not look like a WhatsApp Export Chat .txt.");
    state = { name: file.name, messages: [] };
    render();
    return;
  }
  state = { name: file.name.replace(/\.(zip|txt)$/i, ""), messages };
  els.q.value = "";
  render();
}

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const SAMPLE = `[12/08/2026, 09:14:03] Alex: packing the last box tonight
[12/08/2026, 09:14:41] Sam: export the family chat before you reset the phone
[12/08/2026, 09:15:12] Alex: already did. txt is in files
[12/08/2026, 09:15:44] Sam: keep a copy that is not whatsapp
[12/08/2026, 09:16:02] Alex: that is the whole job`;

els.pick.addEventListener("click", () => els.file.click());
els.file.addEventListener("change", () => {
  if (els.file.files[0]) ingest(els.file.files[0]);
  els.file.value = "";
});
els.sample.addEventListener("click", () => {
  setError("");
  state = { name: "sample-chat", messages: parseExport(SAMPLE) };
  els.q.value = "";
  render();
});
els.q.addEventListener("input", () => paintLog(els.q.value));
els.html.addEventListener("click", () => {
  const html = toHtml(state.name || "chat", state.messages);
  download(`${state.name || "chat"}-keep.html`, new Blob([html], { type: "text/html" }));
});
els.csv.addEventListener("click", () => {
  download(`${state.name || "chat"}-keep.csv`, new Blob([toCsv(state.messages)], { type: "text/csv" }));
});

["dragenter", "dragover"].forEach((ev) => {
  els.drop.addEventListener(ev, (e) => {
    e.preventDefault();
    els.drop.classList.add("over");
  });
});
els.drop.addEventListener("dragleave", () => els.drop.classList.remove("over"));
els.drop.addEventListener("drop", (e) => {
  e.preventDefault();
  els.drop.classList.remove("over");
  if (e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0]);
});

render();
