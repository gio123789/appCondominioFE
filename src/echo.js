import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const wsHost = import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1'
const wsPort = Number(import.meta.env.VITE_REVERB_PORT ?? 8080)
const wsScheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http'

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY ?? 'local-key',
  wsHost,
  wsPort,
  wssPort: wsPort,
  forceTLS: wsScheme === 'https',
  enabledTransports: ['ws', 'wss'],
})

export default echo
