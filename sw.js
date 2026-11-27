// SKL Processos — service worker só para os alertas (Web Push). Não guarda páginas em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { titulo: "SKL Processos", corpo: e.data ? e.data.text() : "" }; }
  const url = (m.dados && m.dados.url) || self.registration.scope;
  e.waitUntil(self.registration.showNotification(m.titulo || "SKL Processos", {
    body: m.corpo || "",
    icon: "icone.png",
    badge: "icone.png",
    tag: m.id || undefined,
    requireInteraction: true,
    vibrate: [ 200, 100, 200 ],
    data: { url },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); try { await c.navigate(url); } catch { /* */ } return; }
    }
    await self.clients.openWindow(url);
  })());
});
