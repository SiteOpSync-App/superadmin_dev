// GET /api/features?client=<id>   header X-Client-Key: <key>
// Called by each client's Apps Script (not by browsers) to learn which sections that client has switched on.
// An unknown client and a wrong key get the same answer, so ids can't be guessed.

function safeEqual(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

const reply = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const id = (url.searchParams.get("client") || "").trim();
    const key = request.headers.get("X-Client-Key") || "";
    const clients = JSON.parse((await env.REGISTRY.get("clients")) || "{}");
    const c = clients[id];
    if (!c || !key || !safeEqual(key, c.apiKey)) return reply({ error: "Not found" }, 404);
    if (c.suspended) {   // a suspended client has every section switched off
        const off = {};
        Object.keys(c.features || {}).forEach((k) => { off[k] = false; });
        return reply({ features: off, suspended: true });
    }
    return reply({ features: c.features || {} });
}
