/**
 * Browser half of the fishtank bundle: a real page (main slot) plus a sidebar
 * icon. Everything it shows comes from the Host fish over /fishtank/state and
 * /fishtank/talk, so the page has no opinion of its own.
 */
window.__ModuleLoader__.load({
  id: 'dsh-fishtank',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React

    const C = {
      bg: 'var(--dsw-alias-bg-base, #ffffff)',
      layer: 'var(--dsw-alias-bg-layer-1, #f6f6f6)',
      text: 'var(--dsw-alias-label-primary, #222222)',
      dim: 'var(--dsw-alias-label-secondary, #777777)',
      accent: '#ff9d5c',
      border: 'var(--dsw-alias-border-l1, #e5e5e5)',
    }

    function FishIcon(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 18
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M2.5 12c3.2-4.2 7.3-6.2 11-6.2 3 0 5.2 1.6 6.4 3.6.9-1 2.1-2.4 2.1-2.4v10s-1.2-1.4-2.1-2.4c-1.2 2-3.4 3.6-6.4 3.6-3.7 0-7.8-2-11-6.2Z',
          fill: 'currentColor',
          opacity: 0.92,
        }),
        h('circle', { cx: 15.6, cy: 10.4, r: 0.9, fill: '#1a1206' }))
    }

    function TankPage() {
      const [state, setState] = useState(null)
      const [text, setText] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const listRef = useRef(null)

      const refresh = useCallback(async () => {
        try {
          const response = await fetch('/fishtank/state', { cache: 'no-store' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          setState(await response.json())
          setError('')
        } catch (problem) {
          setError(String((problem && problem.message) || problem))
        }
      }, [])

      useEffect(() => {
        refresh()
        const timer = window.setInterval(refresh, 12000)
        return () => window.clearInterval(timer)
      }, [refresh])

      useEffect(() => {
        const node = listRef.current
        if (node) node.scrollTop = node.scrollHeight
      }, [state && state.history ? state.history.length : 0])

      const send = async () => {
        const value = text.trim()
        if (!value || busy) return
        setBusy(true)
        setText('')
        try {
          const response = await fetch('/fishtank/talk', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: value }),
          })
          await response.json()
          await refresh()
        } catch (problem) {
          setError(String((problem && problem.message) || problem))
        } finally {
          setBusy(false)
        }
      }

      if (!state) {
        return h('div', { style: { padding: 24, color: C.dim, fontSize: 13 } },
          error ? `鱼缸连不上：${error}` : '鱼缸正在注水…')
      }

      const energy = Math.max(0, Math.min(1, Number(state.energy) || 0))
      const rows = Array.isArray(state.history) ? state.history : []
      const lastWhisper = state.whispers && state.whispers.length ? state.whispers[state.whispers.length - 1] : null
      const lastDiary = state.diary && state.diary.length ? state.diary[state.diary.length - 1] : null

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: C.bg, color: C.text, fontSize: 13 },
      },
        h('div', {
          style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, background: C.layer },
        },
          h('span', { style: { color: C.accent, display: 'flex' } }, h(FishIcon, { size: 22 })),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h('span', { style: { fontWeight: 600 } }, '鱼缸'),
            h('span', { style: { fontSize: 11, color: C.dim } }, `${state.mood || '平静'} · 精力 ${energy.toFixed(2)}`)),
          h('div', { style: { flex: 1 } }),
          h('span', { style: { fontSize: 11, color: C.dim } }, `记着 ${state.facts ? state.facts.length : 0} 件事 · ${state.people ? state.people.length : 0} 个人`)),
        (lastWhisper || lastDiary) ? h('div', {
          style: {
            display: 'flex', gap: 18, padding: '8px 18px', fontSize: 11, color: C.dim,
            borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap',
          },
        },
          lastWhisper ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '56%' } }, `心事：${lastWhisper.text}`) : null,
          lastDiary ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' } }, `日记（${lastDiary.date}）：${String(lastDiary.text || '').slice(0, 40)}`) : null) : null,
        error ? h('div', { style: { padding: '6px 18px', fontSize: 11, color: '#e66' } }, error) : null,
        h('div', {
          ref: listRef,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 },
        },
          rows.length === 0
            ? h('div', { style: { color: C.dim, fontSize: 12 } }, '还没说过话。跟它说一句吧。')
            : rows.map((row, index) => h('div', {
              key: index,
              style: {
                alignSelf: row.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: '8px 12px',
                borderRadius: 12,
                lineHeight: 1.55,
                background: row.role === 'user' ? 'rgba(255,157,92,0.16)' : C.layer,
                border: `1px solid ${row.role === 'user' ? 'rgba(255,157,92,0.3)' : C.border}`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              },
            }, row.text))),
        h('div', {
          style: { display: 'flex', gap: 8, padding: '12px 18px', borderTop: `1px solid ${C.border}`, background: C.layer },
        },
          h('input', {
            value: text,
            placeholder: busy ? '它在想…' : '跟它说点什么',
            disabled: busy,
            onChange: (event) => setText(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') send() },
            style: {
              flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.bg, color: C.text, fontSize: 13, outline: 'none',
            },
          }),
          h('button', {
            type: 'button',
            disabled: busy,
            onClick: send,
            style: {
              padding: '8px 16px', borderRadius: 8, border: 'none',
              cursor: busy ? 'default' : 'pointer',
              background: C.accent, color: '#1a1206', fontSize: 13, fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            },
          }, busy ? '…' : '说')),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'fishtank',
          locale: 'fishtank',
        }, TankPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'fishtank',
          order: 40,
          label: () => '鱼缸',
          locale: 'fishtank',
        }, (props) => h(FishIcon, { size: props && Number.isFinite(props.size) ? props.size : 18 })))
      },
    }
  },
})
