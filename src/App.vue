<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import echo from './echo'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

const departamento = ref(101)
const remitente = ref('Residente 101')
const mensaje = ref('')
const mensajes = ref([])
const cargando = ref(false)
const enviando = ref(false)
const error = ref('')
const conectado = ref(false)

let currentChannel = null

const sortedMessages = computed(() => [...mensajes.value].sort((a, b) => a.id - b.id))

const formatDate = (isoDate) => {
  if (!isoDate) {
    return '--:--'
  }

  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
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
  })

  conectado.value = true
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
  await loadMessages()
  subscribeToDepartment()
})

onMounted(async () => {
  await loadMessages()
  subscribeToDepartment()
})

onBeforeUnmount(() => {
  if (currentChannel) {
    echo.leave(currentChannel)
  }
})
</script>

<template>
  <div class="chat-page">
    <section class="chat-card">
      <header class="chat-header">
        <h1>Chat entre departamentos</h1>
        <p>Requerimiento implementado con WebSockets: mensajes en tiempo real.</p>
      </header>

      <div class="controls">
        <label>
          Departamento
          <input v-model.number="departamento" min="1" step="1" type="number" />
        </label>

        <label>
          Nombre remitente
          <input v-model="remitente" maxlength="80" type="text" />
        </label>
      </div>

      <div class="status-row">
        <span :class="['badge', conectado ? 'ok' : 'off']">
          {{ conectado ? 'Canal conectado' : 'Sin conexión' }}
        </span>
        <span v-if="cargando">Cargando historial...</span>
        <span v-if="error" class="error">{{ error }}</span>
      </div>

      <main class="messages">
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

.chat-header h1 {
  font-size: clamp(1.3rem, 3vw, 1.9rem);
  color: #172647;
  margin-bottom: 0.25rem;
}

.chat-header p {
  color: #4a5570;
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

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
