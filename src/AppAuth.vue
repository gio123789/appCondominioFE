<script setup>
import { computed, onMounted, ref } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
const tokenStorageKey = 'appCondominioToken'

const token = ref(localStorage.getItem(tokenStorageKey) ?? '')
const currentUser = ref(null)
const authMode = ref('login')
const authLoading = ref(false)
const authError = ref('')
const authMessage = ref('')
const needsVerification = ref(false)
const resendLoading = ref(false)

const loginEmail = ref('')
const loginPassword = ref('')

const forgotEmail = ref('')
const resetCode = ref('')
const resetPassword = ref('')
const resetPasswordConfirmation = ref('')
const resetCodeSent = ref(false)
const resetCodeVerified = ref(false)
const resetLoading = ref(false)

const registerName = ref('')
const registerEmail = ref('')
const registerPassword = ref('')
const registerPasswordConfirmation = ref('')
const registerDepartamento = ref(101)

const mensaje = ref('')
const mensajes = ref([])
const cargando = ref(false)
const enviando = ref(false)
const notifications = ref([])
const loadingNotifications = ref(false)
const selectedNotification = ref(null)
const loadingNotificationDetail = ref(false)
const creatingType = ref('')
const adminDepartamento = ref(101)

const isLoggedIn = computed(() => !!currentUser.value && !!token.value)
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const unreadNotifications = computed(() => notifications.value.filter((item) => !item.leida).length)
const sortedMessages = computed(() => [...mensajes.value].sort((a, b) => a.id - b.id))

const clearAuthAlerts = () => {
  authError.value = ''
  authMessage.value = ''
}

const openForgotPassword = () => {
  clearAuthAlerts()
  authMode.value = 'forgot'
  forgotEmail.value = loginEmail.value.trim()
  resetCode.value = ''
  resetPassword.value = ''
  resetPasswordConfirmation.value = ''
  resetCodeSent.value = false
  resetCodeVerified.value = false
}

const backToLogin = () => {
  clearAuthAlerts()
  authMode.value = 'login'
  loginEmail.value = forgotEmail.value.trim() || loginEmail.value
}

const setToken = (value) => {
  token.value = value

  if (!value) {
    localStorage.removeItem(tokenStorageKey)
    return
  }

  localStorage.setItem(tokenStorageKey, value)
}

const formatDate = (isoDate) => {
  if (!isoDate) {
    return '--:--'
  }

  return new Date(isoDate).toLocaleString()
}

const parseResponse = async (response) => {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const apiFetch = async (path, options = {}, includeAuth = true) => {
  const headers = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  }

  if (includeAuth && token.value) {
    headers.Authorization = `Bearer ${token.value}`
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    const message = payload?.message ?? 'Ocurrio un error en la solicitud.'
    const error = new Error(message)
    error.payload = payload
    throw error
  }

  return payload
}

const loadMessages = async () => {
  cargando.value = true

  try {
    const payload = await apiFetch('/chat/messages?limit=80')
    mensajes.value = payload?.data ?? []
  } catch (error) {
    authError.value = error.message
  } finally {
    cargando.value = false
  }
}

const loadNotifications = async () => {
  loadingNotifications.value = true

  try {
    const payload = await apiFetch('/notifications?limit=20')
    notifications.value = payload?.data ?? []
  } catch (error) {
    authError.value = error.message
  } finally {
    loadingNotifications.value = false
  }
}

const loadProtectedData = async () => {
  await loadMessages()
  await loadNotifications()
}

const loadProfile = async () => {
  const payload = await apiFetch('/auth/me')
  currentUser.value = payload?.data ?? null

  if (currentUser.value?.departamento) {
    adminDepartamento.value = currentUser.value.departamento
  }
}

const handleRegister = async () => {
  clearAuthAlerts()
  authLoading.value = true

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: registerName.value,
        email: registerEmail.value,
        password: registerPassword.value,
        password_confirmation: registerPasswordConfirmation.value,
        departamento: registerDepartamento.value,
      }),
    }, false)

    authMessage.value = 'Registro exitoso. Revisa tu correo y confirma tu cuenta antes de iniciar sesion.'
    authMode.value = 'login'
    loginEmail.value = registerEmail.value
    loginPassword.value = ''
  } catch (error) {
    authError.value = error.message
  } finally {
    authLoading.value = false
  }
}

const handleLogin = async () => {
  clearAuthAlerts()
  needsVerification.value = false
  authLoading.value = true

  try {
    const payload = await apiFetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value,
        device_name: 'vue-web',
      }),
    }, false)

    setToken(payload?.token ?? '')
    await loadProfile()
    await loadProtectedData()
    authMessage.value = 'Sesion iniciada correctamente.'
  } catch (error) {
    authError.value = error.message
    needsVerification.value = Boolean(error?.payload?.needs_verification)
  } finally {
    authLoading.value = false
  }
}

const resendVerification = async () => {
  clearAuthAlerts()
  resendLoading.value = true

  try {
    const payload = await apiFetch('/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: loginEmail.value,
      }),
    }, false)

    authMessage.value = payload?.message ?? 'Si el correo existe, enviaremos el enlace de verificacion.'
  } catch (error) {
    authError.value = error.message
  } finally {
    resendLoading.value = false
  }
}

const sendResetCode = async () => {
  clearAuthAlerts()
  resetLoading.value = true

  try {
    const payload = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: forgotEmail.value,
      }),
    }, false)

    resetCodeSent.value = true
    authMessage.value = payload?.message ?? 'Si el correo existe, enviaremos un codigo de recuperacion.'
    resetCodeVerified.value = false
  } catch (error) {
    authError.value = error.message
  } finally {
    resetLoading.value = false
  }
}

const verifyResetCode = async () => {
  clearAuthAlerts()
  resetLoading.value = true

  try {
    const payload = await apiFetch('/auth/verify-reset-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: forgotEmail.value,
        code: resetCode.value,
      }),
    }, false)

    authMessage.value = payload?.message ?? 'Codigo valido.'
    resetCodeVerified.value = true
  } catch (error) {
    authError.value = error.message
  } finally {
    resetLoading.value = false
  }
}

const handleResetPassword = async () => {
  clearAuthAlerts()

  if (!resetCodeSent.value || !resetCodeVerified.value) {
    authError.value = 'Primero envia y valida el codigo de recuperacion.'
    return
  }

  resetLoading.value = true

  try {
    const payload = await apiFetch('/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: forgotEmail.value,
        code: resetCode.value,
        password: resetPassword.value,
        password_confirmation: resetPasswordConfirmation.value,
      }),
    }, false)

    authMessage.value = payload?.message ?? 'Contrasena restablecida correctamente.'
    loginEmail.value = forgotEmail.value.trim()
    loginPassword.value = ''
    resetCode.value = ''
    resetPassword.value = ''
    resetPasswordConfirmation.value = ''
    resetCodeSent.value = false
    resetCodeVerified.value = false
    authMode.value = 'login'
  } catch (error) {
    authError.value = error.message
  } finally {
    resetLoading.value = false
  }
}

const logout = async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch {
    // Ignore logout errors and clear local session anyway.
  }

  setToken('')
  currentUser.value = null
  mensaje.value = ''
  mensajes.value = []
  notifications.value = []
  selectedNotification.value = null
  clearAuthAlerts()
}

const sendMessage = async () => {
  if (!mensaje.value.trim() || enviando.value) {
    return
  }

  enviando.value = true
  clearAuthAlerts()

  try {
    await apiFetch('/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mensaje: mensaje.value.trim(),
      }),
    })

    mensaje.value = ''
    await loadMessages()
  } catch (error) {
    authError.value = error.message
  } finally {
    enviando.value = false
  }
}

const openNotification = async (id) => {
  loadingNotificationDetail.value = true

  try {
    const payload = await apiFetch(`/notifications/${id}`)
    selectedNotification.value = payload?.data ?? null
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })

    notifications.value = notifications.value.map((item) =>
      item.id === id
        ? {
            ...item,
            leida: true,
          }
        : item,
    )
  } catch (error) {
    authError.value = error.message
  } finally {
    loadingNotificationDetail.value = false
  }
}

const createNotification = async (tipo) => {
  if (!isAdmin.value || creatingType.value) {
    return
  }

  const payloadByType = {
    multa: {
      titulo: 'Multa registrada',
      detalle: `Se genero una multa para el departamento ${adminDepartamento.value}.`,
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

  creatingType.value = tipo

  try {
    await apiFetch('/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        departamento: Number(adminDepartamento.value),
        tipo,
        ...payloadByType[tipo],
      }),
    })

    await loadNotifications()
  } catch (error) {
    authError.value = error.message
  } finally {
    creatingType.value = ''
  }
}

onMounted(async () => {
  const query = new URLSearchParams(window.location.search)

  if (query.get('verified') === '1') {
    authMessage.value = 'Correo verificado correctamente. Ya puedes iniciar sesion.'
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (!token.value) {
    return
  }

  try {
    await loadProfile()
    await loadProtectedData()
  } catch {
    setToken('')
    currentUser.value = null
  }
})
</script>

<template>
  <div class="chat-page">
    <section v-if="!isLoggedIn" class="chat-card login-card">
      <header class="chat-header">
        <h1>App Condominio</h1>
        <p>Registro con verificacion por correo y login con Sanctum.</p>
      </header>

      <div class="auth-tabs">
        <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">
          Iniciar sesion
        </button>
        <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">
          Registrarse
        </button>
      </div>

      <form v-if="authMode === 'login'" class="controls" @submit.prevent="handleLogin">
        <label>
          Correo
          <input v-model="loginEmail" autocomplete="email" required type="email" />
        </label>

        <label>
          Contrasena
          <input v-model="loginPassword" autocomplete="current-password" required type="password" />
        </label>

        <button :disabled="authLoading" class="login-button" type="submit">
          {{ authLoading ? 'Ingresando...' : 'Entrar' }}
        </button>

        <button class="link-button" type="button" @click="openForgotPassword">
          Olvide mi contrasena
        </button>

        <button
          v-if="needsVerification"
          :disabled="resendLoading"
          class="secondary-button"
          type="button"
          @click="resendVerification"
        >
          {{ resendLoading ? 'Enviando...' : 'Reenviar verificacion' }}
        </button>
      </form>

      <form v-else-if="authMode === 'forgot'" class="controls" @submit.prevent="handleResetPassword">
        <label>
          Correo
          <input v-model="forgotEmail" autocomplete="email" required type="email" />
        </label>

        <div class="inline-actions">
          <button :disabled="resetLoading" class="secondary-button" type="button" @click="sendResetCode">
            {{ resetLoading ? 'Enviando...' : 'Enviar codigo' }}
          </button>
          <button class="ghost-button" type="button" @click="backToLogin">
            Volver al login
          </button>
        </div>

        <template v-if="resetCodeSent">
          <label>
            Codigo de 6 digitos
            <input v-model="resetCode" inputmode="numeric" maxlength="6" minlength="6" required type="text" />
          </label>

          <div class="inline-actions">
            <button :disabled="resetLoading || resetCode.length !== 6" class="secondary-button" type="button" @click="verifyResetCode">
              {{ resetLoading ? 'Validando...' : 'Validar codigo' }}
            </button>
          </div>

          <p v-if="resetCodeVerified" class="success">Codigo validado. Ahora puedes crear tu nueva contrasena.</p>

          <template v-if="resetCodeVerified">
            <label>
              Nueva contrasena
              <input v-model="resetPassword" autocomplete="new-password" minlength="8" required type="password" />
            </label>

            <label>
              Confirmar nueva contrasena
              <input
                v-model="resetPasswordConfirmation"
                autocomplete="new-password"
                minlength="8"
                required
                type="password"
              />
            </label>

            <button :disabled="resetLoading" class="login-button" type="submit">
              {{ resetLoading ? 'Actualizando...' : 'Restablecer contrasena' }}
            </button>
          </template>
        </template>
      </form>

      <form v-else class="controls" @submit.prevent="handleRegister">
        <label>
          Nombre
          <input v-model="registerName" autocomplete="name" required type="text" />
        </label>

        <label>
          Correo
          <input v-model="registerEmail" autocomplete="email" required type="email" />
        </label>

        <label>
          Departamento
          <input v-model.number="registerDepartamento" min="1" required step="1" type="number" />
        </label>

        <label>
          Contrasena
          <input v-model="registerPassword" autocomplete="new-password" minlength="8" required type="password" />
        </label>

        <label>
          Confirmar contrasena
          <input
            v-model="registerPasswordConfirmation"
            autocomplete="new-password"
            minlength="8"
            required
            type="password"
          />
        </label>

        <button :disabled="authLoading" class="login-button" type="submit">
          {{ authLoading ? 'Registrando...' : 'Crear cuenta' }}
        </button>
      </form>

      <p v-if="authError" class="error">{{ authError }}</p>
      <p v-if="authMessage" class="success">{{ authMessage }}</p>
    </section>

    <section v-else class="chat-card">
      <header class="chat-header">
        <div class="header-row">
          <h1>Chat del condominio</h1>
          <button class="logout-button" type="button" @click="logout">Salir</button>
        </div>

        <p class="small-note">
          Sesion: {{ currentUser?.name }} | Rol: {{ currentUser?.role }} | Depa: {{ currentUser?.departamento ?? 'N/A' }}
        </p>
      </header>

      <p v-if="authError" class="error">{{ authError }}</p>

      <section v-if="isAdmin" class="admin-actions">
        <h3>Crear notificaciones (admin)</h3>
        <div class="controls">
          <label>
            Departamento destino
            <input v-model.number="adminDepartamento" min="1" step="1" type="number" />
          </label>
        </div>

        <div class="notification-actions">
          <button :disabled="creatingType === 'multa'" type="button" @click="createNotification('multa')">
            {{ creatingType === 'multa' ? 'Creando...' : '+ Multa' }}
          </button>
          <button :disabled="creatingType === 'asamblea'" type="button" @click="createNotification('asamblea')">
            {{ creatingType === 'asamblea' ? 'Creando...' : '+ Asamblea' }}
          </button>
          <button :disabled="creatingType === 'pago_atrasado'" type="button" @click="createNotification('pago_atrasado')">
            {{ creatingType === 'pago_atrasado' ? 'Creando...' : '+ Pago atrasado' }}
          </button>
        </div>
      </section>

      <section class="notification-detail">
        <h3>Notificaciones ({{ unreadNotifications }} sin leer)</h3>
        <p v-if="loadingNotifications">Cargando notificaciones...</p>

        <article
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ unread: !item.leida }"
          @click="openNotification(item.id)"
        >
          <div class="notification-meta">
            <strong>{{ item.tipo }}</strong>
            <small>{{ formatDate(item.fecha) }}</small>
          </div>
          <p>{{ item.titulo }}</p>
        </article>

        <p v-if="!notifications.length && !loadingNotifications" class="empty">
          No hay notificaciones por ahora.
        </p>

        <div v-if="selectedNotification" class="selected-notification">
          <p v-if="loadingNotificationDetail">Cargando detalle...</p>
          <div v-else>
            <p><strong>Tipo:</strong> {{ selectedNotification.tipo }}</p>
            <p><strong>Titulo:</strong> {{ selectedNotification.titulo }}</p>
            <p><strong>Detalle:</strong> {{ selectedNotification.detalle }}</p>
          </div>
        </div>
      </section>

      <main class="messages">
        <article v-for="item in sortedMessages" :key="item.id" class="message">
          <div class="meta">
            <strong>{{ item.remitente }}</strong>
            <small>{{ formatDate(item.fecha) }}</small>
          </div>
          <p>{{ item.mensaje }}</p>
        </article>

        <p v-if="!sortedMessages.length && !cargando" class="empty">
          No hay mensajes todavia.
        </p>
      </main>

      <form class="composer" @submit.prevent="sendMessage">
        <textarea
          v-model="mensaje"
          maxlength="500"
          placeholder="Escribe un mensaje para tu departamento..."
          rows="3"
        />
        <button :disabled="!mensaje.trim() || enviando" type="submit">
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
  width: min(940px, 100%);
  background: #ffffffd9;
  border: 1px solid #d5deea;
  border-radius: 20px;
  box-shadow: 0 18px 40px -26px #11254e;
  backdrop-filter: blur(6px);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
}

.chat-header h1 {
  font-size: clamp(1.3rem, 3vw, 1.9rem);
  color: #172647;
  margin-bottom: 0.25rem;
}

.chat-header p {
  color: #4a5570;
}

.auth-tabs {
  display: flex;
  gap: 0.5rem;
}

.auth-tabs button {
  width: auto;
  padding: 0.5rem 0.8rem;
  background: #e5ebf4;
  color: #1b2a43;
}

.auth-tabs button.active {
  background: linear-gradient(120deg, #2557d6, #2f7bd9);
  color: #fff;
}

.controls {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

button {
  border: 0;
  border-radius: 12px;
  padding: 0.7rem 1rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(120deg, #2557d6, #2f7bd9);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-button {
  margin-top: 0.25rem;
}

.secondary-button {
  background: linear-gradient(120deg, #3b495f, #28384d);
}

.link-button,
.ghost-button {
  width: auto;
  color: #214c8f;
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.link-button {
  justify-self: start;
}

.ghost-button {
  color: #3b495f;
}

.inline-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.small-note {
  font-size: 0.9rem;
}

.logout-button {
  width: auto;
  padding: 0.45rem 0.8rem;
  font-size: 0.86rem;
  background: linear-gradient(120deg, #3b495f, #28384d);
}

.admin-actions,
.notification-detail {
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 0.8rem;
  background: #fff;
}

.notification-actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
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
  margin-top: 0.5rem;
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

.selected-notification {
  margin-top: 0.75rem;
  border-top: 1px solid #d7e0eb;
  padding-top: 0.75rem;
}

.messages {
  height: min(52vh, 420px);
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

.meta {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
  color: #304269;
}

.composer {
  display: grid;
  gap: 0.6rem;
}

.error {
  color: #a40e26;
}

.success {
  color: #14532d;
  font-weight: 600;
}

.empty {
  color: #55617e;
}
</style>
