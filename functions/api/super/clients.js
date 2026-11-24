// /api/super/clients   (superadmin only: header Authorization: Bearer <SUPER_PASSWORD>)
//   GET                      list every client
//   POST                     create or update a client (JSON body; id is the key)
//   POST ?id=x&action=rotate give a client a new API key
//   DELETE ?id=x             remove a client
// All clients live in one KV value, "clients", bound as REGISTRY. Set the secret SUPER_PASSWORD on the Pages project.

const FEATURES = ["attendance", "qa", "progress", "applications", "hours", "qr", "diary"];

function safeEqual(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

const reply = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function newKey() {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function cleanFeatures(f) {
    const out = {};
    FEATURES.forEach((k) => { out[k] = !f || f[k] !== false; });
    if (!out.progress) out.applications = false;   // applications need installations and progress
    return out;
}

const text = (v, n) => String(v === undefined || v === null ? "" : v).trim().slice(0, n);

export async function onRequest({ request, env }) {
    if (!env.SUPER_PASSWORD) return reply({ error: "SUPER_PASSWORD is not set on this Pages project" }, 500);
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), env.SUPER_PASSWORD)) return reply({ error: "Unauthorised" }, 401);

    const url = new URL(request.url);
    const clients = JSON.parse((await env.REGISTRY.get("clients")) || "{}");
    const save = () => env.REGISTRY.put("clients", JSON.stringify(clients));

    if (request.method === "GET") return reply({ clients: clients, features: FEATURES });

    if (request.method === "DELETE") {
        const id = url.searchParams.get("id") || "";
        if (!clients[id]) return reply({ error: "Client not found" }, 404);
        delete clients[id];
        await save();
        return reply({ ok: true });
    }

    if (request.method === "POST") {
        if (url.searchParams.get("action") === "rotate") {
            const id = url.searchParams.get("id") || "";
            if (!clients[id]) return reply({ error: "Client not found" }, 404);
            clients[id].apiKey = newKey();
            await save();
            return reply({ client: clients[id] });
        }
        let b;
        try { b = await request.json(); } catch (err) { return reply({ error: "Bad request" }, 400); }
        const id = text(b.id, 40).toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return reply({ error: "The client id must be 2-40 characters: lower case letters, numbers and dashes" }, 400);
        const old = clients[id];
        if (!text(b.name, 80)) return reply({ error: "Name is required" }, 400);
        clients[id] = {
            id: id,
            name: text(b.name, 80),
            pagesUrl: text(b.pagesUrl, 200),
            scriptUrl: text(b.scriptUrl, 300),
            notes: text(b.notes, 500),
            features: cleanFeatures(b.features),
            suspended: b.suspended === true,
            apiKey: old ? old.apiKey : newKey(),
            created: old ? old.created : new Date().toISOString()
        };
        await save();
        return reply({ client: clients[id] });
    }

    return reply({ error: "Method not allowed" }, 405);
}
