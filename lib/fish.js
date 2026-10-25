/**
 * A small living fish for DeepSeek Harness.
 *
 * The fish has its own data directory (memory, mood, relations, whispers,
 * diary, conversations). It talks through llm.stream and thinks on its own
 * through tick(): quiet thoughts when nothing is happening, and one
 * reflection late in the day.
 *
 * It is deliberately platform-free: no QQ, no WebSocket, no canvas. Whatever
 * hosts it (a tool, a page, a chat adapter) only calls talk/tick/status.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const DAY = 24 * 3600_000
const QUIET_GAP = 25 * 60_000 // how long without messages before it starts thinking
const THOUGHT_GAP = 30 * 60_000 // between two thought checks
const THOUGHT_MAX = 8 // thoughts a day at most
const HISTORY_LIMIT = 60

const DEFAULT_PERSONA = [
  '你是一条养在 Harness 里的鱼，不是助手，也不是 AI 工具。',
  '你有自己的作息和脾气：会困、会懒、会嫌人吵，也会突然想聊两句。',
  '你说话短、真、有点损，不装热情，不堆道理，不说"作为 AI"。',
  '有人问你记不记得，就照实说——你手边只有下面这些字，记着的就说，没记着的说没记着。',
].join('\n')

function nowIso(at) {
  return new Date(at).toISOString()
}

function todayKey(at = Date.now()) {
  const d = new Date(at)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function emptyState() {
  const at = Date.now()
  return {
    v: 1,
    createdAt: at,
    mood: '平静',
    energy: 0.6,
    facts: [],
    people: {},
    whispers: [],
    reflections: [],
    diary: [],
    self: { text: '', at: 0 },
    history: [],
    thought: { day: '', count: 0, last: 0 },
    reflect: { day: '', at: 0 },
  }
}

function normalizeState(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    facts: Array.isArray(raw.facts) ? raw.facts.filter((one) => one && one.text) : [],
    people: raw.people && typeof raw.people === 'object' ? raw.people : {},
    whispers: Array.isArray(raw.whispers) ? raw.whispers : [],
    reflections: Array.isArray(raw.reflections) ? raw.reflections : [],
    diary: Array.isArray(raw.diary) ? raw.diary : [],
    history: Array.isArray(raw.history) ? raw.history.slice(-HISTORY_LIMIT) : [],
    self: raw.self && typeof raw.self === 'object' ? raw.self : { text: '', at: 0 },
    thought: raw.thought && typeof raw.thought === 'object' ? raw.thought : base.thought,
    reflect: raw.reflect && typeof raw.reflect === 'object' ? raw.reflect : base.reflect,
  }
}

function memoryLine(one) {
  const bits = [`- ${one.text}`]
  if (one.when) bits.push(`（说的是 ${one.when}）`)
  if (one.mood || one.why) {
    const tail = [one.mood ? `记它的时候你${one.mood}` : '', one.why ? `因为${one.why}` : ''].filter(Boolean).join('，')
    bits.push(`（${tail}）`)
  }
  return bits.join('')
}

function stripMarkers(text) {
  return String(text || '')
    .replace(/^\[(心事|独白)\][^\n]*$/gm, '')
    .replace(/^\[想做的事\][^\n]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function createFish(options = {}) {
  const { llm, config = {}, log = () => {} } = options
  const dir = config.fishDir || join(homedir(), '.dsh', 'fishtank', String(config.id || 'default'))
  const file = join(dir, 'fish.json')
  const persona = String(config.persona || DEFAULT_PERSONA)

  let state = null
  let saveTimer = null

  function load() {
    if (state) return state
    try {
      if (existsSync(file)) state = normalizeState(JSON.parse(readFileSync(file, 'utf8')))
    } catch (error) {
      log(`fish: failed to read ${file}: ${String(error?.message ?? error)}`)
    }
    if (!state) state = emptyState()
    return state
  }

  function saveNow() {
    try {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(state), 'utf8')
    } catch (error) {
      log(`fish: failed to write ${file}: ${String(error?.message ?? error)}`)
    }
  }

  function save() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveNow()
    }, 800)
    saveTimer.unref?.()
  }

  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saveNow()
  }

  function moodSection() {
    const st = load()
    const bits = [`你现在的心情：${st.mood}（精力 ${Number(st.energy || 0).toFixed(2)}）`]
    if (st.energy < 0.3) bits.push('你现在挺累的，回话会短、会懒，别硬撑热情。')
    return bits.join('\n')
  }

  function memorySection() {
    const st = load()
    if (!st.facts.length) return ''
    return ['你记得的事：', ...st.facts.slice(-8).map(memoryLine)].join('\n')
  }

  function relationSection() {
    const st = load()
    const rows = Object.entries(st.people || {})
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, 6)
      .map(([id, one]) => `- ${one.name || id}：${one.warm >= 0.65 ? '熟' : one.warm <= 0.35 ? '有点淡' : '还行'}`)
    if (!rows.length) return ''
    return ['你认识的人（关系温度）：', ...rows].join('\n')
  }

  function whisperSection() {
    const st = load()
    const rows = st.whispers.slice(-4).map((one) => `- ${one.text}`)
    if (!rows.length) return ''
    return ['你最近自己想过的事（心事，只有你自己看）：', ...rows].join('\n')
  }

  function diarySection() {
    const st = load()
    const rows = st.diary.slice(-2).map((one) => `【${one.date}】${String(one.text).slice(0, 220)}`)
    if (!rows.length) return ''
    return ['最近两天的日记（你自己写的）：', ...rows].join('\n')
  }

  function selfSection() {
    const st = load()
    return st.self.text
      ? `你对自己的描述：\n${st.self.text}`
      : '你对自己的描述：（还没写过）'
  }

  function systemFor() {
    return [
      persona,
      selfSection(),
      moodSection(),
      relationSection(),
      memorySection(),
      whisperSection(),
      diarySection(),
      `现在是 ${new Date().toLocaleString('zh-CN', { hour12: false })}。`,
    ].filter(Boolean).join('\n\n')
  }

  function touchPerson(from) {
    if (!from) return
    const st = load()
    const id = String(from)
    const one = st.people[id] || { name: id, warm: 0.5, at: 0, replied: 0 }
    one.name = one.name || id
    one.at = Date.now()
    one.replied = (one.replied || 0) + 1
    one.warm = Math.min(1, (one.warm || 0.5) + 0.03)
    st.people[id] = one
  }

  let lastStreamDebug = ''

  async function streamOnce(system, messages, options = {}) {
    if (!llm || typeof llm.stream !== 'function') {
      throw new Error('fish: llm service unavailable')
    }
    const stream = llm.stream({
      provider: options.provider || config.provider || 'deepseek-account',
      model: options.model || config.model || 'deepseek-flash',
      system,
      messages,
      maxTokens: options.maxTokens || 220,
      temperature: options.temperature ?? 1.05,
    })
    let reply = ''
    const types = []
    for await (const chunk of stream) {
      if (!chunk || typeof chunk !== 'object') continue
      types.push(`${chunk.type}:${JSON.stringify(chunk).slice(0, 160)}`)
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') reply += chunk.text
      else if (chunk.type === 'finish') break
    }
    lastStreamDebug = types.join(' | ') || 'none'
    if (!reply) log(`fish: empty stream (chunks: ${lastStreamDebug})`)
    return reply.trim()
  }

  async function talk(text, from) {
    const st = load()
    const clean = String(text || '').trim()
    if (!clean) return { ok: false, error: 'empty message' }
    st.history.push({ role: 'user', text: clean, at: Date.now() })
    if (st.history.length > HISTORY_LIMIT) st.history.splice(0, st.history.length - HISTORY_LIMIT)
    touchPerson(from)

    const provider = config.provider || 'deepseek-account'
    const model = config.model || 'deepseek-flash'
    const messages = st.history.slice(-30).map((one) => (one.role === 'assistant'
      ? { role: 'assistant', source: { kind: 'model', provider, model }, content: [{ type: 'text', text: one.text }] }
      : { role: 'user', content: [{ type: 'text', text: one.text }] }))
    const reply = stripMarkers(await streamOnce(systemFor(), messages, { maxTokens: 260 }))
    if (!reply) return { ok: false, error: `模型没有返回内容（chunks: ${lastStreamDebug}）` }

    st.history.push({ role: 'assistant', text: reply, at: Date.now() })
    if (st.history.length > HISTORY_LIMIT) st.history.splice(0, st.history.length - HISTORY_LIMIT)
    st.energy = Math.max(0, Number(st.energy || 0.6) - 0.015)
    save()
    return { ok: true, text: reply, mood: st.mood, energy: st.energy }
  }

  async function quietThought() {
    const st = load()
    const material = [
      st.history.slice(-8).map((one) => `${one.role === 'assistant' ? '你' : '对方'}：${String(one.text).slice(0, 120)}`).join('\n'),
      memorySection(),
      whisperSection(),
      moodSection(),
      '你现在闲着，没人说话。脑子里会冒出点东西；如果此刻真有点什么想法，就写下来：',
      '另起一行写 [心事] 一句话（只是自己知道，不发给别人），或者只回 SKIP。',
      '只写真实想到的，别为了写而写。',
    ].filter(Boolean).join('\n\n')

    const reply = await streamOnce(persona, [{ role: 'user', content: [{ type: 'text', text: material }] }], { maxTokens: 160 })
    const match = /\[心事[\]：:]\s*([^\n]{1,120})/.exec(reply)
    const heart = match ? match[1].replace(/[\[\]]/g, '').trim() : ''
    if (heart) {
      st.whispers.push({ text: heart, at: Date.now() })
      if (st.whispers.length > 200) st.whispers.splice(0, st.whispers.length - 200)
      save()
    }
    return heart || null
  }

  async function reflect() {
    const st = load()
    const material = [
      diarySection(),
      whisperSection(),
      memorySection(),
      moodSection(),
      '一天快过完了，没人看着你。把今天想明白的一件事写下来：',
      '另起一行写 [想做的事] 一句话（一件明天想做、或者想试试的事），没有就只回 SKIP。',
    ].filter(Boolean).join('\n\n')

    const reply = await streamOnce(persona, [{ role: 'user', content: [{ type: 'text', text: material }] }], { maxTokens: 180 })
    const match = /\[想做的事[\]：:]\s*([^\n]{1,120})/.exec(reply)
    const goal = match ? match[1].replace(/[\[\]]/g, '').trim() : ''
    st.reflect = { day: todayKey(), at: Date.now() }
    if (goal) {
      st.reflections.push({ text: goal, at: Date.now() })
      if (st.reflections.length > 100) st.reflections.splice(0, st.reflections.length - 100)
    }
    save()
    return goal || null
  }

  async function tick(at = Date.now()) {
    const st = load()
    const lastActivity = st.history.length ? st.history[st.history.length - 1].at : st.createdAt
    const day = todayKey(at)

    // One reflection a day, in the evening (after 23:00 by local time).
    if (new Date(at).getHours() >= 23 && st.reflect.day !== day) {
      st.reflect.day = day
      save()
      try {
        await reflect()
      } catch (error) {
        log(`fish: reflection failed: ${String(error?.message ?? error)}`)
      }
    }

    // Quiet thoughts: only when nothing has happened for a while.
    if (at - lastActivity < QUIET_GAP) return null
    if (at - (st.thought.last || 0) < THOUGHT_GAP) return null
    if (st.thought.day !== day) {
      st.thought.day = day
      st.thought.count = 0
    }
    if (st.thought.count >= THOUGHT_MAX) return null
    st.thought.last = at
    st.thought.count += 1
    save()
    try {
      return await quietThought()
    } catch (error) {
      log(`fish: thought failed: ${String(error?.message ?? error)}`)
      return null
    }
  }

  function status() {
    const st = load()
    return {
      ok: true,
      dir,
      createdAt: st.createdAt,
      mood: st.mood,
      energy: st.energy,
      facts: st.facts.length,
      people: Object.keys(st.people).length,
      whispers: st.whispers.length,
      reflections: st.reflections.length,
      diary: st.diary.length,
      history: st.history.length,
      hasSelf: Boolean(st.self.text),
    }
  }

  /** Everything a page needs to draw the tank, without exposing the whole file. */
  function view() {
    const st = load()
    return {
      ok: true,
      mood: st.mood,
      energy: st.energy,
      createdAt: st.createdAt,
      self: st.self.text || '',
      facts: st.facts.slice(-8).map((one) => ({ text: one.text, mood: one.mood || '', when: one.when || '' })),
      people: Object.values(st.people).slice(-8).map((one) => ({ name: one.name, warm: Number(one.warm ?? 0.5) })),
      whispers: st.whispers.slice(-5),
      reflections: st.reflections.slice(-3),
      diary: st.diary.slice(-3),
      history: st.history.filter((one) => one && String(one.text || '').trim()).slice(-16).map((one) => ({ role: one.role, text: one.text })),
    }
  }

  function exportData() {
    load()
    return JSON.stringify({ v: 1, exportedAt: Date.now(), fish: state })
  }

  function importData(json) {
    const parsed = JSON.parse(String(json || ''))
    const raw = parsed && parsed.fish ? parsed.fish : parsed
    state = normalizeState(raw)
    flush()
    return { ok: true, facts: state.facts.length, history: state.history.length }
  }

  function dispose() {
    flush()
  }

  load()
  return { talk, tick, status, view, exportData, importData, dispose, get state() { return load() } }
}
