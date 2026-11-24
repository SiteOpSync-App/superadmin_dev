const $ = (id) => document.getElementById(id);
const dlg = $("dlg");
const FEATURE_INFO = {
    attendance: ["Site attendance", "Check in / out, hours log, needs attention"],
    qa: ["QA inspections", "QA page, checklist and reports"],
    progress: ["Installations & progress", "Installations, stages & rates, Progress page"],
    applications: ["Applications & invoices", "Applications for payment and project invoices (needs Installations & progress)"],
    hours: ["Contractor hours & invoices", "My hours, contractor invoices and details"],
    qr: ["QR code generator", "Print site QR codes from the dashboard"],
    diary: ["Daily diary", "Notes and before / after photos for each job, with the admin calendar"]
};
let pw = sessionStorage.getItem("superPw") || "";
let clients = {};
let toastTimer = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function call(path, opts) {
    const res = await fetch(path, Object.assign({}, opts, { headers: Object.assign({ Authorization: "Bearer " + pw, "Content-Type": "application/json" }, (opts || {}).headers) }));
    let data = {};
    try { data = await res.json(); } catch (err) {}
    return { ok: res.ok, status: res.status, data: data };
}

function toast(t) {
    $("toast").innerText = t;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").innerText = ""; }, 3000);
}

async function signIn() {
    pw = $("pw").value;
    $("login-err").innerText = "Checking...";
    const r = await call("/api/super/clients");
    if (!r.ok) { $("login-err").innerText = r.status === 401 ? "Wrong password." : (r.data.error || "Could not sign in."); return; }
    sessionStorage.setItem("superPw", pw);
    $("login-err").innerText = "";
    $("login").hidden = true;
    $("main").hidden = false;
    clients = r.data.clients || {};
    render();
}

function signOut() { sessionStorage.removeItem("superPw"); location.reload(); }
$("pw").addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });

function render() {
    const ids = Object.keys(clients).sort();
    $("clients").innerHTML = ids.length ? ids.map((id) => {
        const c = clients[id];
        const sw = Object.keys(FEATURE_INFO).map((k) => {
            const locked = k === "applications" && c.features.progress === false;
            return `<label class="switch"><input type="checkbox" data-c="${esc(id)}" data-f="${k}"${c.features[k] !== false && !locked ? " checked" : ""}${locked ? " disabled" : ""}>` +
                   `<span>${FEATURE_INFO[k][0]}<small>${FEATURE_INFO[k][1]}</small></span></label>`;
        }).join("");
        return `<div class="card${c.suspended ? " off" : ""}"><div class="top"><b>${esc(c.name)}</b><span class="id">${esc(id)}</span></div>` +
               (c.pagesUrl ? `<a href="${esc(c.pagesUrl)}" target="_blank" rel="noopener">${esc(c.pagesUrl)}</a>` : "") +
               (c.notes ? `<span class="note" style="margin:0">${esc(c.notes)}</span>` : "") +
               sw +
               `<label class="switch"><input type="checkbox" data-c="${esc(id)}" data-s="1"${c.suspended ? " checked" : ""}><span>Suspended<small>Switches every section off for this client</small></span></label>` +
               `<details><summary>Apps Script setup</summary><p style="margin-top:6px">In the client's Apps Script: Project settings, Script properties, add these three:</p>` +
               kv("REGISTRY_URL", location.origin) + kv("CLIENT_ID", id) + kv("CLIENT_KEY", c.apiKey) + `</details>` +
               `<div class="btns"><button class="small ghost" onclick="openClient('${esc(id)}')">Edit</button><button class="small ghost" onclick="rotate('${esc(id)}')">New key</button>` +
               `<button class="small danger" onclick="del('${esc(id)}')">Delete</button></div></div>`;
    }).join("") : "<p class='note'>No clients yet. Click + Add client.</p>";
}

function kv(k, v) { return `<div class="kv"><b>${k}</b><code>${esc(v)}</code><button class="small ghost" onclick="copy('${esc(v)}')">Copy</button></div>`; }
function copy(t) { navigator.clipboard.writeText(t).then(() => toast("Copied")); }

// Switches save straight away
$("clients").addEventListener("change", async (e) => {
    const cb = e.target.closest("input[data-c]");
    if (!cb) return;
    const c = clients[cb.dataset.c];
    if (cb.dataset.s) c.suspended = cb.checked;
    else {
        c.features[cb.dataset.f] = cb.checked;
        if (!c.features.progress) c.features.applications = false;
    }
    const r = await call("/api/super/clients", { method: "POST", body: JSON.stringify(c) });
    if (!r.ok) { toast(""); alert(r.data.error || "Could not save"); }
    else { clients[c.id] = r.data.client; toast("Saved. The client's app picks it up within 5 minutes."); }
    render();
});

function openClient(id) {
    const c = id ? clients[id] : { id: "", name: "", pagesUrl: "", scriptUrl: "", notes: "", features: {}, suspended: false };
    $("dt").innerText = id ? "Edit client" : "Add client";
    $("de").innerText = "";
    $("c-id").value = c.id; $("c-id").disabled = !!id;
    $("c-name").value = c.name; $("c-pages").value = c.pagesUrl; $("c-script").value = c.scriptUrl; $("c-notes").value = c.notes;
    $("ds").onclick = async () => {
        $("de").innerText = "Saving...";
        const body = Object.assign({}, c, { id: $("c-id").value.trim(), name: $("c-name").value, pagesUrl: $("c-pages").value, scriptUrl: $("c-script").value, notes: $("c-notes").value });
        const r = await call("/api/super/clients", { method: "POST", body: JSON.stringify(body) });
        if (!r.ok) { $("de").innerText = r.data.error || "Could not save"; return; }
        clients[r.data.client.id] = r.data.client;
        dlg.close();
        render();
    };
    dlg.showModal();
}

async function rotate(id) {
    if (!confirm(`Give ${clients[id].name} a new key? Its Apps Script must be updated with the new CLIENT_KEY, otherwise it falls back to its last known switches.`)) return;
    const r = await call("/api/super/clients?action=rotate&id=" + encodeURIComponent(id), { method: "POST" });
    if (!r.ok) return alert(r.data.error || "Could not rotate the key");
    clients[id] = r.data.client;
    render();
}

async function del(id) {
    if (!confirm(`Delete ${clients[id].name} from the registry? Their app keeps running on its last known switches, then falls back to its own Settings tab. Their data and sites are not touched.`)) return;
    const r = await call("/api/super/clients?id=" + encodeURIComponent(id), { method: "DELETE" });
    if (!r.ok) return alert(r.data.error || "Could not delete");
    delete clients[id];
    render();
}

if (pw) { $("pw").value = pw; signIn(); }
