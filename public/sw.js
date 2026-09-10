/**
 * Service Worker de notificaciones push (Atención Ciudadana).
 * Muestra la notificación del sistema y abre la pestaña correspondiente
 * (Chats o Paquetes) al hacer clic. El backend envía {title, body, url}.
 */
self.addEventListener('push', (event) => {
  let datos = { title: 'Atención Ciudadana', body: 'Tienes una novedad', url: '/chats' }
  try {
    if (event.data) datos = { ...datos, ...event.data.json() }
  } catch {
    /* payload no JSON: se usa el texto plano como body */
    try { datos.body = event.data.text() } catch { /* nada */ }
  }
  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: datos.url || '/chats' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/chats'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate(url)
          return v.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
