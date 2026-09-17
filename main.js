import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm"

const form = document.querySelector('form')
const input = document.querySelector('textarea')
const template = document.querySelector('#message-template')
const messages = document.querySelector('ul')
const container = document.querySelector('main')
const button = document.querySelector('button')

const screenChat = document.querySelector('#screen-chat')
const screenLoading = document.querySelector('#screen-loading')
const screenWebgpu = document.querySelector('#screen-webgpu')

const statusDot = document.querySelector('#status-dot')
const statusText = document.querySelector('#status-text')

const progressBar = document.querySelector('#progress-bar')
const progressPercentage = document.querySelector('#progress-percentage')

const webgpuSubtitle = document.querySelector('#webgpu-subtitle')
const webgpuSteps = document.querySelector('#webgpu-steps')

input.addEventListener('input', resizeInput)

const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 52

const WEBGPU_INSTRUCTIONS = {
  chrome: {
    name: 'Chrome',
    steps: [
      'Activa <code>chrome://flags/#enable-unsafe-webgpu</code>',
      'Activa <code>chrome://flags/#enable-vulkan</code>',
      'Reinicia el navegador',
      'Comprueba en <code>chrome://gpu</code> que WebGPU aparece habilitado'
    ]
  },
  edge: {
    name: 'Edge',
    steps: [
      'Activa <code>edge://flags/#enable-unsafe-webgpu</code>',
      'Activa <code>edge://flags/#enable-vulkan</code>',
      'Reinicia el navegador',
      'Comprueba en <code>edge://gpu</code> que WebGPU aparece habilitado'
    ]
  },
  firefox: {
    name: 'Firefox',
    steps: [
      'Abre <code>about:config</code>',
      'Activa <code>dom.webgpu.enabled</code>',
      'Activa <code>gfx.webgpu.force-enabled</code>',
      'Reinicia el navegador y comprueba en <code>about:support</code> (sección Graphics) que WEBGPU aparece disponible'
    ]
  },
  safari: {
    name: 'Safari',
    steps: [
      'Ve a Ajustes &gt; Avanzado &gt; Funciones de desarrollador',
      'Activa WebGPU',
      'Si no aparece esa opción, actualiza Safari a la última versión'
    ]
  },
  unknown: {
    name: null,
    steps: []
  }
}

function detectBrowser() {
  const userAgent = navigator.userAgent
  if (userAgent.includes('Edg/')) return 'edge'
  if (userAgent.includes('Firefox/')) return 'firefox'
  if (userAgent.includes('Chrome/') || userAgent.includes('Chromium/')) return 'chrome'
  if (userAgent.includes('Safari/')) return 'safari'
  return 'unknown'
}

function showScreen(screen) {
  screenChat.classList.toggle('hidden', screen !== 'chat')
  screenLoading.classList.toggle('hidden', screen !== 'loading')
  screenWebgpu.classList.toggle('hidden', screen !== 'webgpu')
}

function setStatus(variant, text) {
  statusDot.className = `status-dot status-dot--${variant}`
  statusText.textContent = text
}

function setProgress(ratio) {
  progressBar.style.strokeDashoffset = PROGRESS_RING_CIRCUMFERENCE * (1 - ratio)
  progressPercentage.textContent = `${Math.round(ratio * 100)}%`
}

function resizeInput() {
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}

function showWebgpuWarning() {
  const { name, steps } = WEBGPU_INSTRUCTIONS[detectBrowser()]
  webgpuSubtitle.textContent = name
    ? `Detectamos ${name}. Sigue estos pasos para activarlo:`
    : 'No hemos podido detectar tu navegador. Consulta su compatibilidad con WebGPU en el enlace de abajo.'

  webgpuSteps.innerHTML = ''
  for (const step of steps) {
    const li = document.createElement('li')
    li.innerHTML = `<span>${step}</span>`
    webgpuSteps.appendChild(li)
  }

  showScreen('webgpu')
  setStatus('error', 'Sin WebGPU')
}

async function isWebGPUAvailable() {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

function addMessage(text, sender) {
  // Clonamos el template de manera profunda (por eso añadimos el true)
  const clonedTemplate = template.content.cloneNode(true)
  const newMessage = clonedTemplate.querySelector('.message')

  const who = newMessage.querySelector('span')
  const textMessage = newMessage.querySelector('p')

  textMessage.textContent = text
  who.textContent = sender === 'bot' ? 'IA' : 'Tú'
  newMessage.classList.add(sender)

  messages.appendChild(newMessage)

  container.scrollTop = container.scrollHeight

  return textMessage
}

async function init() {
  if (!(await isWebGPUAvailable())) {
    showWebgpuWarning()
    return
  }

  let messagesList = []

  // const SELECTED_MODEL = 'Llama-3-8B-Instruct-q4f16_1-MLC-1k'
  const SELECTED_MODEL = 'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC'

  const engine = await CreateWebWorkerMLCEngine(
    new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
    SELECTED_MODEL,
    {
      initProgressCallback: (info) => {
        setProgress(info.progress)
        if (info.progress === 1) {
          button.removeAttribute('disabled')
          setStatus('ready', 'En local')
          showScreen('chat')
        }
      }
    }
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const messageText = input.value.trim()

    if (messageText !== '') {
      input.value = ''
      resizeInput()
    }

    addMessage(messageText, 'user')
    button.setAttribute('disabled', true)

    const userMessage = {
      role: 'user',
      content: messageText
    }
    messagesList.push(userMessage)

    const chunks = await engine.chat.completions.create({
      messages: messagesList,
      stream: true
    })

    let reply = ''

    const botMessage = addMessage('', 'bot')

    for await (const chunk of chunks) {
      const choice = chunk.choices[0]
      const content = choice?.delta?.content ?? ''
      reply += content
      botMessage.textContent = reply
    }

    messagesList.push({
      role: 'assistant',
      content: reply
    })
    button.removeAttribute('disabled')
    container.scrollTop = container.scrollHeight
  })
}

init()
