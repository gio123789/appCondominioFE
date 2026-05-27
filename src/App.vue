<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import echo from './echo'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
const demoUsers = [
  {
    email: 'residente101@demo.com',
    password: '123456',
    nombre: 'Residente 101',
    departamento: 101,
  },
  {
    email: 'residente102@demo.com',
    password: '123456',
    nombre: 'Residente 102',
    departamento: 101,
  },
]

const departamento = ref(101)
const remitente = ref('Residente 101')
const mensaje = ref('')
const mensajes = ref([])
const cargando = ref(false)
const enviando = ref(false)
const error = ref('')
const conectado = ref(false)
const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const currentUser = ref(null)
const notifications = ref([])
const selectedNotification = ref(null)
const showNotifications = ref(false)
const notificationsHovered = ref(false)
const loadingNotifications = ref(false)
const messagesContainer = ref(null)

let currentChannel = null

const sortedMessages = computed(() => [...mensajes.value].sort((a, b) => a.id - b.id))
const isLoggedIn = computed(() => !!currentUser.value)
const unreadNotifications = computed(() => notifications.value.filter((item) => !item.leida).length)
const isNotificationsPanelVisible = computed(
  () => showNotifications.value || notificationsHovered.value,
)

const notificationTypeLabel = {
  mensaje: 'Mensaje',
  multa: 'Multa',
  asamblea: 'Asamblea',
  pago_atrasado: 'Pago atrasado',
}

const formatDate = (isoDate) => {
  if (!isoDate) {
    return '--:--'
  }

  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const scrollMessagesToBottom = () => {
  if (!messagesContainer.value) {
    return
  }

  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

const loadMessages = async () => {
  cargando.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/chat/messages?departamento=${departamento.value}&limit=80`)

    if (!response.ok) {
      throw new Error('No se pudieron cargar los mensajes del departamento.')
    }

    const payload = await response.json()
    mensajes.value = payload.data ?? []
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const loadNotifications = async () => {
  if (!departamento.value) {
    return
  }

  loadingNotifications.value = true

  try {
    const response = await fetch(
      `${apiBaseUrl}/notifications?departamento=${departamento.value}&limit=20`,
    )

    if (!response.ok) {
      throw new Error('No se pudieron cargar notificaciones.')
    }

    const payload = await response.json()
    notifications.value = payload.data ?? []
  } catch (e) {
    error.value = e.message
  } finally {
    loadingNotifications.value = false
  }
}

const subscribeToDepartment = () => {
  if (currentChannel) {
    echo.leave(currentChannel)
  }

  currentChannel = `departamentos.${departamento.value}`

  echo.channel(currentChannel).listen('.mensaje.enviado', (event) => {
    const exists = mensajes.value.some((item) => item.id === event.id)

    if (!exists) {
      mensajes.value.push(event)
    }
  }).listen('.notificacion.nueva', (event) => {
    const exists = notifications.value.some((item) => item.id === event.id)

    if (!exists) {
      notifications.value.unshift(event)
    }
  })

  conectado.value = true
}

const loadAndSubscribe = async () => {
  await loadMessages()
  await loadNotifications()
  subscribeToDepartment()
}

const toggleNotificationsPanel = () => {
  showNotifications.value = !showNotifications.value
}

const openNotificationsOnHover = () => {
  notificationsHovered.value = true
}

const closeNotificationsOnLeave = () => {
  notificationsHovered.value = false
}

const openNotification = async (id) => {
  try {
    const response = await fetch(`${apiBaseUrl}/notifications/${id}`)

    if (!response.ok) {
      throw new Error('No se pudo obtener el detalle de la notificacion.')
    }

    const payload = await response.json()
    selectedNotification.value = payload.data

    await fetch(`${apiBaseUrl}/notifications/${id}/read`, {
      method: 'PATCH',
    })

    notifications.value = notifications.value.map((item) =>
      item.id === id
        ? {
            ...item,
            leida: true,
          }
        : item,
    )
  } catch (e) {
    error.value = e.message
  }
}

const createDemoNotification = async (tipo) => {
  try {
    const payloadByType = {
      multa: {
        titulo: 'Multa registrada',
        detalle: `Se genero una multa para el departamento ${departamento.value}.`,
      },
      asamblea: {
        titulo: 'Nueva asamblea',
        detalle: 'Asamblea general programada para el viernes 7:00 PM.',
      },
      pago_atrasado: {
        titulo: 'Pago atrasado',
        detalle: 'Tienes una mensualidad de mantenimiento vencida.',
      },
    }

    const body = payloadByType[tipo]

    await fetch(`${apiBaseUrl}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        departamento: departamento.value,
        tipo,
        ...body,
      }),
    })
  } catch (e) {
    error.value = e.message
  }
}

const login = async () => {
  loginError.value = ''

  const user = demoUsers.find(
    (item) => item.email === loginEmail.value.trim() && item.password === loginPassword.value,
  )

  if (!user) {
    loginError.value = 'Credenciales invalidas. Usa uno de los usuarios demo.'
    return
  }

  currentUser.value = user
  remitente.value = user.nombre
  departamento.value = user.departamento
  sessionStorage.setItem('chatDemoUser', JSON.stringify(user))

  mensaje.value = ''
  await loadAndSubscribe()
}

const logout = () => {
  if (currentChannel) {
    echo.leave(currentChannel)
    currentChannel = null
  }

  currentUser.value = null
  conectado.value = false
  mensajes.value = []
  mensaje.value = ''
  error.value = ''
  loginPassword.value = ''
  sessionStorage.removeItem('chatDemoUser')
  notifications.value = []
  selectedNotification.value = null
  showNotifications.value = false
  notificationsHovered.value = false
}

const sendMessage = async () => {
  if (!mensaje.value.trim() || enviando.value) {
    return
  }

  enviando.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        departamento: departamento.value,
        remitente: remitente.value,
        mensaje: mensaje.value.trim(),
      }),
    })

    if (!response.ok) {
      throw new Error('No fue posible enviar el mensaje.')
    }

    mensaje.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    enviando.value = false
  }
}

watch(departamento, async () => {
  if (!isLoggedIn.value) {
    return
  }

  await loadAndSubscribe()
})

watch(
  () => sortedMessages.value.length,
  async () => {
    await nextTick()
    scrollMessagesToBottom()
  },
)

onMounted(async () => {
  const savedUser = sessionStorage.getItem('chatDemoUser')

  if (!savedUser) {
    return
  }

  try {
    const parsedUser = JSON.parse(savedUser)
    currentUser.value = parsedUser
    remitente.value = parsedUser.nombre
    departamento.value = parsedUser.departamento
    await loadAndSubscribe()
  } catch {
    sessionStorage.removeItem('chatDemoUser')
  }
})

onBeforeUnmount(() => {
  if (currentChannel) {
    echo.leave(currentChannel)
  }
})
</script>

<template>
  <div class="chat-page">
    <section v-if="!isLoggedIn" class="chat-card login-card">
      <header class="chat-header">
        <h1>Login demo del chat</h1>
        <p>Inicia sesion con alguno de los dos usuarios para comprobar WebSockets.</p>
      </header>

      <form class="controls" @submit.prevent="login">
        <label>
          Correo
          <input v-model="loginEmail" autocomplete="email" type="email" />
        </label>

        <label>
          Contrasena
          <input v-model="loginPassword" autocomplete="current-password" type="password" />
        </label>

        <button class="login-button" type="submit">Entrar</button>
      </form>

      <p v-if="loginError" class="error">{{ loginError }}</p>

      <div class="demo-users">
        <h3>Usuarios demo</h3>
        <p>Usuario 1: residente101@demo.com / 123456</p>
        <p>Usuario 2: residente102@demo.com / 123456</p>
      </div>
    </section>

    <section v-else class="chat-card">
      <header class="chat-header">
        <div class="header-row">
          <h1>Chat entre departamentos</h1>
          <div class="top-actions">
            <div
              class="notification-menu"
              @mouseenter="openNotificationsOnHover"
              @mouseleave="closeNotificationsOnLeave"
            >
              <button
                class="bell-button"
                :class="{ active: isNotificationsPanelVisible }"
                type="button"
                @click="toggleNotificationsPanel"
              >
                <span class="bell-icon">&#128276;</span>
                <span v-if="unreadNotifications" class="bell-count">{{ unreadNotifications }}</span>
              </button>

              <section v-if="isNotificationsPanelVisible" class="notifications-panel">
                <div class="notification-head">
                  <h3>Notificaciones</h3>
                  <span>{{ unreadNotifications }} sin leer</span>
                </div>

                <div class="notification-actions">
                  <button type="button" @click="createDemoNotification('multa')">+ Multa</button>
                  <button type="button" @click="createDemoNotification('asamblea')">+ Asamblea</button>
                  <button type="button" @click="createDemoNotification('pago_atrasado')">+ Pago atrasado</button>
                </div>

                <p v-if="loadingNotifications">Cargando notificaciones...</p>

                <article
                  v-for="item in notifications"
                  :key="item.id"
                  class="notification-item"
                  :class="{ unread: !item.leida }"
                  @click="openNotification(item.id)"
                >
                  <div class="notification-meta">
                    <strong>{{ notificationTypeLabel[item.tipo] ?? item.tipo }}</strong>
                    <small>{{ formatDate(item.fecha) }}</small>
                  </div>
                  <p>{{ item.titulo }}</p>
                </article>

                <p v-if="!notifications.length && !loadingNotifications" class="empty">
                  No hay notificaciones por ahora.
                </p>
              </section>
            </div>
            <button class="logout-button" type="button" @click="logout">Salir</button>
          </div>
        </div>
        <p>Requerimiento implementado con WebSockets: mensajes en tiempo real.</p>
        <p class="small-note">
          Sesion activa: {{ currentUser?.nombre }} (Depa {{ currentUser?.departamento }})
        </p>
      </header>

      <section v-if="selectedNotification" class="notification-detail">
        <h3>Detalle de notificacion</h3>
        <p><strong>Tipo:</strong> {{ notificationTypeLabel[selectedNotification.tipo] }}</p>
        <p><strong>Titulo:</strong> {{ selectedNotification.titulo }}</p>
        <p><strong>Detalle:</strong> {{ selectedNotification.detalle }}</p>
      </section>

      <div class="controls">
        <label>
          Departamento
          <input v-model.number="departamento" min="1" readonly step="1" type="number" />
        </label>

        <label>
          Nombre remitente
          <input v-model="remitente" maxlength="80" readonly type="text" />
        </label>
      </div>

      <div class="status-row">
        <span :class="['badge', conectado ? 'ok' : 'off']">
          {{ conectado ? 'Canal conectado' : 'Sin conexión' }}
        </span>
        <span v-if="cargando">Cargando historial...</span>
        <span v-if="error" class="error">{{ error }}</span>
      </div>

      <main ref="messagesContainer" class="messages">
        <article
          v-for="item in sortedMessages"
          :key="item.id"
          class="message"
          :class="{ mine: item.remitente === remitente }"
        >
          <div class="meta">
            <strong>{{ item.remitente }}</strong>
            <small>{{ formatDate(item.fecha) }}</small>
          </div>
          <p>{{ item.mensaje }}</p>
        </article>

        <p v-if="!sortedMessages.length && !cargando" class="empty">
          No hay mensajes todavia para este departamento.
        </p>
      </main>

      <form class="composer" @submit.prevent="sendMessage">
        <textarea
          v-model="mensaje"
          maxlength="500"
          placeholder="Escribe un mensaje para tu departamento..."
          rows="3"
        />
        <button :disabled="enviando || !mensaje.trim()" type="submit">
          {{ enviando ? 'Enviando...' : 'Enviar' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.chat-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  background:
    radial-gradient(circle at 10% 20%, #fff6e5, transparent 30%),
    radial-gradient(circle at 90% 10%, #e8f3ff, transparent 26%),
    linear-gradient(120deg, #f7f9fc, #fff9ef);
}

.chat-card {
  width: min(900px, 100%);
  background: #ffffffd9;
  border: 1px solid #d5deea;
  border-radius: 20px;
  box-shadow: 0 18px 40px -26px #11254e;
  backdrop-filter: blur(6px);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
}

.login-card {
  margin-bottom: 1rem;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.notification-menu {
  position: relative;
}

.bell-button {
  width: auto;
  padding: 0.45rem 0.7rem;
  position: relative;
  background: linear-gradient(120deg, #ca8800, #dba720);
}

.bell-button.active {
  box-shadow: 0 0 0 2px #f4d17f;
}

.bell-icon {
  font-size: 1rem;
  line-height: 1;
}

.bell-count {
  position: absolute;
  top: -7px;
  right: -8px;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #a40e26;
  color: #fff;
  font-size: 0.72rem;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
}

.chat-header h1 {
  font-size: clamp(1.3rem, 3vw, 1.9rem);
  color: #172647;
  margin-bottom: 0.25rem;
}

.chat-header p {
  color: #4a5570;
}

.small-note {
  font-size: 0.86rem;
}

.controls {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

label {
  display: grid;
  gap: 0.35rem;
  color: #2c3650;
  font-size: 0.95rem;
}

input,
textarea,
button {
  font: inherit;
}

input,
textarea {
  border: 1px solid #cad5e2;
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
  background: #fffd;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 30px;
}

.notifications-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  width: min(420px, 86vw);
  z-index: 20;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
  display: grid;
  gap: 0.6rem;
  box-shadow: 0 14px 28px -22px #0f2248;
}

.notification-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.notification-actions button {
  width: auto;
  padding: 0.45rem 0.65rem;
  font-size: 0.82rem;
  background: linear-gradient(120deg, #224370, #385f8f);
}

.notification-item {
  border: 1px solid #d7e0eb;
  border-radius: 10px;
  padding: 0.55rem;
  cursor: pointer;
}

.notification-item.unread {
  border-color: #86a7da;
  background: #f3f8ff;
}

.notification-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.2rem;
}

.notification-detail {
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 0.8rem;
  background: #fff;
}

.demo-users {
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  background: #f8fbff;
  padding: 0.75rem;
  color: #374668;
}

.demo-users h3 {
  margin-bottom: 0.2rem;
}

.badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  border: 1px solid;
}

.badge.ok {
  color: #14532d;
  border-color: #86efac;
  background: #dcfce7;
}

.badge.off {
  color: #78350f;
  border-color: #fcd34d;
  background: #fffbeb;
}

.error {
  color: #a40e26;
}

.messages {
  height: min(52vh, 480px);
  overflow-y: auto;
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  padding: 0.8rem;
  background: linear-gradient(180deg, #f8fbff, #ffffff);
  display: grid;
  align-content: start;
  gap: 0.7rem;
}

.message {
  border: 1px solid #d7e0eb;
  border-radius: 12px;
  background: #fff;
  padding: 0.65rem;
}

.message.mine {
  border-color: #b5d0ff;
  background: #eef5ff;
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
  color: #304269;
}

.empty {
  color: #55617e;
}

.composer {
  display: grid;
  gap: 0.6rem;
}

button {
  border: 0;
  border-radius: 12px;
  padding: 0.7rem 1rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(120deg, #2557d6, #2f7bd9);
  cursor: pointer;
}

.login-button {
  margin-top: 0.35rem;
}

.logout-button {
  width: auto;
  padding: 0.45rem 0.8rem;
  font-size: 0.86rem;
  background: linear-gradient(120deg, #3b495f, #28384d);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
