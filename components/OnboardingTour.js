'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { driver } from 'driver.js'

const KEY = 'pickup:onboarding:v3'

function safeGet() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function safeSet(v) {
  try {
    localStorage.setItem(KEY, v)
  } catch {}
}

function buildLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, ''))
}

function ensureSkipButton(popover, onSkip) {
  const footer = popover?.footer
  if (!footer) return

  const existing = footer.querySelector('[data-pickup-skip="1"]')
  if (existing) return

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = '以后再说'
  btn.setAttribute('data-pickup-skip', '1')
  btn.style.border = 'none'
  btn.style.background = 'transparent'
  btn.style.padding = '0'
  btn.style.marginRight = '14px'
  btn.style.fontSize = '12px'
  btn.style.fontWeight = '700'
  btn.style.color = 'rgba(255,255,255,0.55)'
  btn.style.cursor = 'pointer'
  btn.onmouseenter = () => {
    btn.style.color = 'rgba(255,255,255,0.82)'
  }
  btn.onmouseleave = () => {
    btn.style.color = 'rgba(255,255,255,0.55)'
  }
  btn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onSkip?.()
  }

  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.alignItems = 'center'
  wrap.appendChild(btn)

  footer.prepend(wrap)
}

const EPILOGUE_TEXT =
  "你好，陌生的用户。\n\n" +
  "我是独立开发者Cuins。\n\n" +
  "你刚刚完成的，不仅是一次简单的操作指引。 ‘拾音’ 是我用代码和热爱构建的第一个岛屿。 建立这个空间的初衷极其简单：拒绝被动接收，主动用心拾取。当音乐缩写成三十秒的短视频背景，那些藏在音轨深处的愤怒、悲悯与狂喜也随之消解。\n\n" +
  "我曾多次想象，在无限循环的数字海洋里，我们还能否拥有一片只关于音乐的避风港？ 于是，“拾音”诞生了。\n\n" +
  "我想坦诚地告诉你：这个网站并不完美。 作为一个独立项目，它是我在无数次‘报错’与‘重构’中打磨出来的第一个孩子。它没有多么复杂的算法，只有我日日夜夜的思索和对音乐最原始的敬畏。\n\n" +
  "我不希望它只是一个冰冷的工具，而希望它是一个带有体温的、由热爱驱动的社区。虽然目前它尚有缺憾，但我会带着这份诚挚，持续修正、持续生长。\n\n" +
  "很高兴看到你也在这里。在这里，没有稍纵即逝的口水旋律，只有值得反复咀嚼的生命回响。谢谢你成为我第一个梦想的见证者。 感谢你陪我迈出这第一步。\n\n" +
  "让我们关掉杂音，把时间还给旋律，把灵魂还给乐章。"

export default function OnboardingTour() {
  const pathname = usePathname()
  const [stage, setStage] = useState(null)
  const [ready, setReady] = useState(false)
  const tourRef = useRef(null)
  const destroyedRef = useRef(false)
  const epilogueTimerRef = useRef(null)
  const stageRef = useRef(null)

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    const v = safeGet()
    if (v === 'done') {
      setStage('done')
      setReady(true)
      return
    }
    if (v === 'album_pending') {
      setStage('album_pending')
      setReady(true)
      return
    }
    setStage('library')
    setReady(true)
  }, [])

  const copy = useMemo(() => {
    return {
      library: {
        step1: {
          title: '从一张封面开始',
          html:
            "<div>在“拾音”，封面不是装饰——它是一扇门。</div>" +
            "<div style=\"margin-top:8px\">点一下它，你就会走进专辑的内部：曲目、背景、评价与乐评，都在那一页慢慢展开。</div>" +
            "<div style=\"margin-top:8px\">你要记住的第一件事：<b>点击专辑封面，即可进入专辑详情页。</b></div>",
          next: '继续',
        },
        step2: {
          title: '去听它的深处',
          html:
            "<div>现在，随便挑一张你愿意停留的专辑。</div>" +
            "<div style=\"margin-top:8px\">请把鼠标（或指尖）交给直觉：点进去。</div>" +
            "<div style=\"margin-top:8px\">到了详情页，我会告诉你：当信息缺席时，如何把它找回来。</div>",
          next: '我知道了',
        },
      },
      album: {
        step3: {
          title: '当页面沉默，就让它再说一次',
          html:
            "<div>专辑信息来自多个公开来源：它们偶尔会迟到，偶尔会缺席。</div>" +
            "<div style=\"margin-top:8px\">如果你看到“缺少信息 / 暂无信息”，别急——这里有一把小钥匙。</div>" +
            "<div style=\"margin-top:8px\">你要记住的第二件事：<b>点“重新抓取”，让系统再次拉取并补全信息。</b></div>",
          next: '继续',
        },
        step4: {
          title: '你已抵达',
          lead: '最后，我想把几句话，慢慢交到你手里。',
          next: '收下这段话',
        },
      },
      controls: {
        next: '继续',
        prev: '返回一步',
        done: '完成',
        skip: '以后再说',
      },
    }
  }, [])

  const cleanupEpilogueTimer = () => {
    if (epilogueTimerRef.current) {
      clearInterval(epilogueTimerRef.current)
      epilogueTimerRef.current = null
    }
  }

  const destroyTour = () => {
    cleanupEpilogueTimer()
    try {
      tourRef.current?.destroy()
    } catch {}
    tourRef.current = null
  }

  const markDone = () => {
    safeSet('done')
    setStage('done')
  }

  const markAlbumPending = () => {
    safeSet('album_pending')
    setStage('album_pending')
  }

  useEffect(() => {
    return () => {
      destroyedRef.current = true
      destroyTour()
    }
  }, [])

  const shouldRunLibrary = ready && stage === 'library' && (pathname === '/' || pathname === '/search' || pathname === '/charts' || pathname === '/settings' || pathname === '/me')
  const shouldRunAlbum = ready && (stage === 'album_pending' || stage === 'album') && typeof pathname === 'string' && pathname.startsWith('/album/')

  useEffect(() => {
    if (!ready) return
    if (stage === 'done') return

    if (shouldRunLibrary) {
      destroyTour()
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        nextBtnText: copy.controls.next,
        prevBtnText: copy.controls.prev,
        doneBtnText: copy.controls.done,
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          ensureSkipButton(popover, () => {
            markDone()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: '[data-tour="album-cover"]',
            popover: {
              title: copy.library.step1.title,
              description: copy.library.step1.html,
              nextBtnText: copy.library.step1.next,
              showButtons: ['next'],
            },
          },
          {
            element: 'main',
            popover: {
              title: copy.library.step2.title,
              description: copy.library.step2.html,
              nextBtnText: copy.library.step2.next,
              showButtons: ['previous', 'next'],
              onNextClick: (_el, _step, opts) => {
                markAlbumPending()
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyStarted: (_el, _step, opts) => {
          try {
            opts?.driver?.destroy()
          } catch {}
        },
        onDestroyed: () => {
          tourRef.current = null
        },
      })

      tourRef.current = t

      try {
        t.drive()
      } catch {}
    }
  }, [ready, stage, pathname, shouldRunLibrary, copy])

  useEffect(() => {
    if (!ready) return
    if (stage === 'done') return

    if (shouldRunAlbum) {
      setStage('album')
      destroyTour()

      const buildEpilogueHtml = () => {
        const lead = copy.album.step4.lead
        const lines = buildLines(EPILOGUE_TEXT)
        const linesHtml = lines
          .map((l, i) => {
            const safe = l
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
            const content = safe === '' ? '&nbsp;' : safe
            return `<div class="pickup-tour-epilogue-line" data-ep-line="${i}">${content}</div>`
          })
          .join('')

        return (
          `<div>${lead}</div>` +
          `<div class="pickup-tour-epilogue" data-ep-container="1">${linesHtml}</div>`
        )
      }

      const startTyping = () => {
        cleanupEpilogueTimer()
        const container = document.querySelector('[data-ep-container="1"]')
        if (!container) return
        const lines = Array.from(container.querySelectorAll('[data-ep-line]'))
        if (!lines.length) return
        let idx = 0

        const reveal = () => {
          if (idx >= lines.length) {
            cleanupEpilogueTimer()
            return
          }
          const el = lines[idx]
          if (el) {
            el.classList.add('is-in')
          }
          idx += 1
        }

        reveal()
        const ms = 720
        epilogueTimerRef.current = setInterval(reveal, ms)
      }

      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        nextBtnText: copy.controls.next,
        prevBtnText: copy.controls.prev,
        doneBtnText: copy.controls.done,
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          ensureSkipButton(popover, () => {
            markDone()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        onHighlightStarted: (_el, _step, opts) => {
          if (Number(opts?.state?.activeIndex) === 1) {
            window.setTimeout(() => startTyping(), 180)
          } else {
            cleanupEpilogueTimer()
          }
        },
        onDeselected: () => {
          cleanupEpilogueTimer()
        },
        onDestroyed: () => {
          cleanupEpilogueTimer()
          tourRef.current = null
        },
        steps: [
          {
            element: '[data-tour="album-refetch"]',
            popover: {
              title: copy.album.step3.title,
              description: copy.album.step3.html,
              nextBtnText: copy.album.step3.next,
              showButtons: ['previous', 'next'],
            },
          },
          {
            element: 'main',
            popover: {
              title: copy.album.step4.title,
              description: buildEpilogueHtml(),
              nextBtnText: copy.album.step4.next,
              showButtons: ['previous', 'next'],
              side: 'middle',
              align: 'center',
              onNextClick: (_el, _step, opts) => {
                markDone()
                cleanupEpilogueTimer()
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
      })

      tourRef.current = t

      try {
        t.drive()
      } catch {}
    }
  }, [ready, stage, pathname, shouldRunAlbum, copy])

  return null
}
