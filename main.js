import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm"

const body = document.querySelector('#container')
const form = document.querySelector('form')
const input = document.querySelector('textarea')
const template = document.querySelector('#message-template')
const messages = document.querySelector('ul')
const container = document.querySelector('main')
const button = document.querySelector('button')
const small = document.querySelector('small')
const loader = document.querySelector('.loading-container')
const webgpuWarning = document.querySelector('.webgpu-warning')
const webgpuWarningMessage = document.querySelector('.webgpu-warning-message')

const WEBGPU_INSTRUCTIONS = {
  chrome: 'Activa las flags chrome://flags/#enable-unsafe-webgpu y chrome://flags/#enable-vulkan, reinicia el navegador y comprueba en chrome://gpu que WebGPU aparece habilitado.',
  edge: 'Activa las flags edge://flags/#enable-unsafe-webgpu y edge://flags/#enable-vulkan, reinicia el navegador y comprueba en edge://gpu que WebGPU aparece habilitado.',
  firefox: 'Abre about:config, activa dom.webgpu.enabled y gfx.webgpu.force-enabled, reinicia el navegador y comprueba en about:support (sección Graphics) que WEBGPU aparece disponible.',
  safari: 'Ve a Ajustes > Avanzado > Funciones de desarrollador y activa WebGPU. Si tu versión de Safari no tiene esa opción, actualízala a la última disponible.',
  unknown: 'Consulta la compatibilidad de tu navegador con WebGPU en https://webgpureport.org/ y activa la opción correspondiente si está disponible.'
}

function detectBrowser() {
  const userAgent = navigator.userAgent
  if (userAgent.includes('Edg/')) return 'edge'
  if (userAgent.includes('Firefox/')) return 'firefox'
  if (userAgent.includes('Chrome/') || userAgent.includes('Chromium/')) return 'chrome'
  if (userAgent.includes('Safari/')) return 'safari'
  return 'unknown'
}

function showWebgpuWarning() {
  loader.classList.add('hidden')
  webgpuWarning.classList.remove('hidden')
  webgpuWarningMessage.textContent = WEBGPU_INSTRUCTIONS[detectBrowser()]
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
    new Worker('/worker.js', { type: 'module' }),
    SELECTED_MODEL,
    {
      initProgressCallback: (info) => {
        console.log('Model initialization:', info)
        small.textContent = `${info.text}%`
        if (info.progress === 1) {
          button.removeAttribute('disabled')
          loader.classList.add('hidden')
          body.classList.remove('backOpacity')
        }
      }
    }
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const messageText = input.value.trim()

    if (messageText !== '') {
      input.value = ''
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
