'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import { supabase } from '@/lib/supabaseBrowser'

const KEY = 'pickup:onboarding:v5'

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    return obj
  } catch {
    return null
  }
}

function safeWrite(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj))
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

function setNextEnabled(popover, enabled) {
  const footer = popover?.footer
  if (!footer) return
  const btn = footer.querySelector('.driver-popover-next-btn')
  if (!btn) return
  btn.disabled = !enabled
  btn.style.opacity = enabled ? '1' : '0.42'
  btn.style.pointerEvents = enabled ? 'auto' : 'none'
}

const EPILOGUE_TEXT =
  '你好，陌生的用户。\n\n' +
  '我是独立开发者Cuins。\n\n' +
  '你刚刚完成的，不仅是一次简单的操作指引。 ‘拾音’ 是我用代码和热爱构建的第一个岛屿。 建立这个空间的初衷极其简单：拒绝被动接收，主动用心拾取。当音乐缩写成三十秒的短视频背景，那些藏在音轨深处的愤怒、悲悯与狂喜也随之消解。\n\n' +
  '我曾多次想象，在无限循环的数字海洋里，我们还能否拥有一片只关于音乐的避风港？ 于是，“拾音”诞生了。\n\n' +
  '我想坦诚地告诉你：这个网站并不完美。 作为一个独立项目，它是我在无数次‘报错’与‘重构’中打磨出来的第一个孩子。它没有多么复杂的算法，只有我日日夜夜的思索和对音乐最原始的敬畏。\n\n' +
  '我不希望它只是一个冰冷的工具，而希望它是一个带有体温的、由热爱驱动的社区。虽然目前它尚有缺憾，但我会带着这份诚挚，持续修正、持续生长。\n\n' +
  '很高兴看到你也在这里。在这里，没有稍纵即逝的口水旋律，只有值得反复咀嚼的生命回响。谢谢你成为我第一个梦想的见证者。 感谢你陪我迈出这第一步。\n\n' +
  '让我们关掉杂音，把时间还给旋律，把灵魂还给乐章。'

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState({ step: 'signup', done: false, lastAlbumId: '' })
  const [authReady, setAuthReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [libraryCount, setLibraryCount] = useState(null)

  const tourRef = useRef(null)
  const popoverRef = useRef(null)
  const epilogueTimerRef = useRef(null)
  const gateRef = useRef({})
  const progressRef = useRef(progress)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  const destroyTour = () => {
    try {
      tourRef.current?.destroy()
    } catch {}
    tourRef.current = null
    popoverRef.current = null
  }

  const cleanupEpilogueTimer = () => {
    if (epilogueTimerRef.current) {
      clearInterval(epilogueTimerRef.current)
      epilogueTimerRef.current = null
    }
  }

  const persist = (next) => {
    setProgress(next)
    safeWrite(next)
  }

  const patch = (partial) => {
    persist({ ...progressRef.current, ...partial })
  }

  useEffect(() => {
    const saved = safeRead()
    if (saved?.done) {
      setProgress({ step: 'done', done: true, lastAlbumId: String(saved?.lastAlbumId || '') })
      setReady(true)
      return
    }
    if (saved?.step) {
      setProgress({ step: String(saved.step), done: false, lastAlbumId: String(saved?.lastAlbumId || '') })
      setReady(true)
      return
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const qs = new URLSearchParams(window.location.search)
        if (qs.get('__onboarding_test') === '1') {
          setAuthed(true)
          setAuthReady(true)
          return
        }
      } catch {}
    }

    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setAuthed(!!data?.session?.user)
        setAuthReady(true)
      })
      .catch(() => {
        if (!mounted) return
        setAuthed(false)
        setAuthReady(true)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setAuthed(!!session?.user)
      setAuthReady(true)
    })

    return () => {
      mounted = false
      try {
        data?.subscription?.unsubscribe()
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const qs = new URLSearchParams(window.location.search)
        if (qs.get('__onboarding_test') === '1') {
          setLibraryCount(1)
          return
        }
      } catch {}
    }

    if (!authReady) return
    if (!authed) {
      setLibraryCount(null)
      return
    }

    let mounted = true
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        const user = data?.user
        if (!mounted || !user) return
        const r = await supabase
          .from('user_collections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        if (!mounted) return
        if (r.error) {
          setLibraryCount(null)
          return
        }
        setLibraryCount(typeof r.count === 'number' ? r.count : null)
      })
      .catch(() => {
        if (!mounted) return
        setLibraryCount(null)
      })

    return () => {
      mounted = false
    }
  }, [authReady, authed])

  useEffect(() => {
    const onEvt = (e) => {
      const d = e?.detail || {}
      const type = String(d.type || '')
      gateRef.current[type] = d

      if (type === 'search:results_ready') {
        setNextEnabled(popoverRef.current, true)
      }

      if (type === 'search:album_added') {
        const albumId = String(d.albumId || '')
        if (albumId) {
          patch({ lastAlbumId: albumId, step: 'nav_library' })
        } else {
          patch({ step: 'nav_library' })
        }
      }

      if (type === 'library:hovered') {
        setNextEnabled(popoverRef.current, true)
      }

      if (type === 'tags:modal_opened') {
        patch({ step: 'tag_add' })
      }

      if (type === 'tags:saved') {
        patch({ step: 'album_open' })
      }
    }

    window.addEventListener('pickup:onboarding', onEvt)
    return () => window.removeEventListener('pickup:onboarding', onEvt)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!authReady) return
    if (progress.done) return

    if (!authed && progress.step !== 'signup') {
      patch({ step: 'signup' })
      return
    }

    if (authed && progress.step === 'signup') {
      patch({ step: 'nav_search' })
    }
  }, [ready, authReady, authed, progress.done, progress.step])

  useEffect(() => {
    if (!ready) return
    if (progress.done) return
    if (progress.step !== 'album_open') return
    if (typeof pathname !== 'string') return
    if (!pathname.startsWith('/album/')) return
    patch({ step: 'album_refetch' })
  }, [ready, pathname, progress.done, progress.step])

  const copy = useMemo(() => {
    return {
      signup: {
        title: '先注册，再开始拾音',
        html:
          '<div>你是第一次来，这里需要先创建一个账号。</div>' +
          '<div style="margin-top:8px">注册完成后会自动登录，并把你的引导进度保存下来。</div>',
        next: '去注册',
      },
      navSearch: {
        title: '先学会搜索',
        html:
          '<div>你的音乐库现在是空的。</div>' +
          '<div style="margin-top:8px">先点左侧的“搜索”，我们把第一张专辑加入音乐库。</div>',
        next: '去搜索',
      },
      searchInput: {
        title: '在这里输入专辑或艺术家',
        html:
          '<div>我会示范输入一个关键词，并自动展示搜索结果。</div>' +
          '<div style="margin-top:8px">你也可以换成你想听的专辑或艺术家名字。</div>',
        next: '看到结果了',
      },
      searchAdd: {
        title: '把它加入音乐库',
        html:
          '<div>在结果里点“想听”。</div>' +
          '<div style="margin-top:8px">完成后，我们回到音乐库继续下一步。</div>',
        next: '我已点想听',
      },
      navLibrary: {
        title: '回到音乐库',
        html:
          '<div>现在去左侧点击“我的音乐库”。</div>' +
          '<div style="margin-top:8px">你刚刚添加的专辑会出现在这里。</div>',
        next: '回到音乐库',
      },
      libraryHover: {
        title: '停留在专辑上',
        html:
          '<div>把鼠标停在专辑封面上，会出现 6 个操作按钮。</div>' +
          '<div style="margin-top:8px">先把按钮显示出来，我再解释每个按钮的用途。</div>',
        next: '我看到了按钮',
      },
      libraryActions: {
        title: '这 6 个按钮分别做什么',
        html:
          '<div>从左到右/从上到下分别是：</div>' +
          '<div style="margin-top:8px">网易云、Spotify、豆瓣、Genius、添加标签、删除。</div>' +
          '<div style="margin-top:8px">接下来我们做一次“添加标签”。</div>',
        next: '开始添加标签',
      },
      tagOpen: {
        title: '打开标签管理',
        html: '<div>点击“添加标签”，给这张专辑贴一个你自己的标签。</div>',
        next: '打开标签面板',
      },
      tagAdd: {
        title: '完成一次标签添加',
        html:
          '<div>输入一个标签（比如：rock / ambient / 适合夜晚），然后点保存。</div>' +
          '<div style="margin-top:8px">保存成功后，我们进入专辑详情页。</div>',
        next: '我已保存',
      },
      albumOpen: {
        title: '进入专辑详情',
        html:
          '<div>点击专辑封面进入详情页。</div>' +
          '<div style="margin-top:8px">在那里你可以看到曲目、简介，并发布乐评。</div>',
        next: '我已进入详情',
      },
      albumRefetch: {
        title: '重新抓取信息',
        html: '<div>当页面信息不完整时，点“重新抓取”会再次拉取并补全信息。</div>',
        next: '抓取并继续',
      },
      albumTracks: {
        title: '浏览曲目列表',
        html:
          '<div>这里是曲目列表，支持展开全部。</div>' +
          '<div style="margin-top:8px">往下还有简介等内容区块。</div>',
        next: '继续',
      },
      albumReviews: {
        title: '在这里发布乐评',
        html: '<div>你可以在这里打分、撰写乐评、和其他人互动。</div>',
        next: '收尾',
      },
      epilogue: {
        title: '你已抵达',
        lead: '最后，我想把几句话，慢慢交到你手里。',
        next: '完成引导',
      },
    }
  }, [])

  const buildEpilogueHtml = () => {
    const lead = copy.epilogue.lead
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

    return `<div>${lead}</div><div class="pickup-tour-epilogue" data-ep-container="1">${linesHtml}</div>`
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
      if (el) el.classList.add('is-in')
      idx += 1
    }

    reveal()
    epilogueTimerRef.current = setInterval(reveal, 420)
  }

  const waitFor = (selector, timeoutMs) => {
    const started = Date.now()
    return new Promise((resolve) => {
      const tick = () => {
        const el = document.querySelector(selector)
        if (el) return resolve(true)
        if (Date.now() - started > timeoutMs) return resolve(false)
        requestAnimationFrame(tick)
      }
      tick()
    })
  }

  const run = async () => {
    destroyTour()
    cleanupEpilogueTimer()

    const step = progressRef.current.step
    if (step === 'done') return

    if (step === 'signup') {
      const sel = document.querySelector('[data-tour="signin"]') ? '[data-tour="signin"]' : 'main'
      await waitFor(sel, 1200)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: false,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.signup.title,
              description: copy.signup.html,
              nextBtnText: copy.signup.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'nav_search', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
                router.push(`/auth?mode=signup&returnTo=${encodeURIComponent('/')}`)
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'nav_search') {
      if (!authed) return
      if (pathname === '/search') {
        patch({ step: 'search_input' })
        return
      }
      const sel = '[data-tour="nav-search"]'
      await waitFor(sel, 1800)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.navSearch.title,
              description: copy.navSearch.html,
              nextBtnText: copy.navSearch.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'search_input', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
                router.push('/search')
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'search_input') {
      if (!authed) return
      if (pathname !== '/search') {
        router.push('/search')
        return
      }
      const sel = '[data-tour="search-input"]'
      await waitFor(sel, 1800)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          setNextEnabled(popover, !!gateRef.current['search:results_ready'])
        },
        onHighlightStarted: () => {
          try {
            window.dispatchEvent(
              new CustomEvent('pickup:onboarding', { detail: { type: 'search:prefill', term: 'Radiohead' } })
            )
          } catch {}
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.searchInput.title,
              description: copy.searchInput.html,
              nextBtnText: copy.searchInput.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'search_add', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'search_add') {
      if (!authed) return
      if (pathname !== '/search') {
        router.push('/search')
        return
      }
      const sel = '[data-tour="search-want"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          setNextEnabled(popover, false)
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.searchAdd.title,
              description: copy.searchAdd.html,
              nextBtnText: copy.searchAdd.next,
              showButtons: ['next'],
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'nav_library') {
      if (!authed) return
      if (pathname !== '/search') {
        router.push('/search')
        return
      }
      const sel = '[data-tour="nav-library"]'
      await waitFor(sel, 1800)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.navLibrary.title,
              description: copy.navLibrary.html,
              nextBtnText: copy.navLibrary.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'library_hover', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
                router.push('/')
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'library_hover') {
      if (!authed) return
      if (pathname !== '/') {
        router.push('/')
        return
      }
      if (typeof libraryCount === 'number' && libraryCount < 1) return
      const sel = '[data-tour="library-album-card"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          setNextEnabled(popover, false)
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.libraryHover.title,
              description: copy.libraryHover.html,
              nextBtnText: copy.libraryHover.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'library_actions', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'library_actions') {
      if (!authed) return
      if (pathname !== '/') {
        router.push('/')
        return
      }
      if (typeof libraryCount === 'number' && libraryCount < 1) return
      const sel = document.querySelector('[data-tour="library-album-actions"]')
        ? '[data-tour="library-album-actions"]'
        : '[data-tour="library-album-card"]'
      await waitFor(sel, 2000)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.libraryActions.title,
              description: copy.libraryActions.html,
              nextBtnText: copy.libraryActions.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'tag_open', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'tag_open') {
      if (!authed) return
      if (pathname !== '/') {
        router.push('/')
        return
      }
      const sel = '[data-tour="library-edit-tags"]'
      await waitFor(sel, 2200)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          setNextEnabled(popover, true)
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.tagOpen.title,
              description: copy.tagOpen.html,
              nextBtnText: copy.tagOpen.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'tag_add', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
                try {
                  document.querySelector(sel)?.scrollIntoView({ block: 'center', inline: 'center' })
                } catch {}
                try {
                  document.querySelector(sel)?.click()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'tag_add') {
      if (!authed) return
      if (pathname !== '/') {
        router.push('/')
        return
      }
      const sel = '[data-tour="tag-modal"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          setNextEnabled(popover, false)
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.tagAdd.title,
              description: copy.tagAdd.html,
              nextBtnText: copy.tagAdd.next,
              showButtons: ['next'],
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'album_open') {
      if (!authed) return
      if (pathname !== '/') {
        router.push('/')
        return
      }
      const sel = '[data-tour="library-album-cover"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.albumOpen.title,
              description: copy.albumOpen.html,
              nextBtnText: copy.albumOpen.next,
              showButtons: ['next'],
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'album_refetch') {
      if (!authed) return
      if (typeof pathname !== 'string' || !pathname.startsWith('/album/')) return
      const sel = '[data-tour="album-refetch"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            cleanupEpilogueTimer()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.albumRefetch.title,
              description: copy.albumRefetch.html,
              nextBtnText: copy.albumRefetch.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                try {
                  document.querySelector(sel)?.click()
                } catch {}
                persist({ ...progressRef.current, step: 'album_tracks', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'album_tracks') {
      if (!authed) return
      if (typeof pathname !== 'string' || !pathname.startsWith('/album/')) return
      const sel = '[data-tour="album-tracklist"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            cleanupEpilogueTimer()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.albumTracks.title,
              description: copy.albumTracks.html,
              nextBtnText: copy.albumTracks.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'album_reviews', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'album_reviews') {
      if (!authed) return
      if (typeof pathname !== 'string' || !pathname.startsWith('/album/')) return
      const sel = '[data-tour="album-reviews"]'
      await waitFor(sel, 2600)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            cleanupEpilogueTimer()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.albumReviews.title,
              description: copy.albumReviews.html,
              nextBtnText: copy.albumReviews.next,
              showButtons: ['next'],
              onNextClick: (_el, _step, opts) => {
                persist({ ...progressRef.current, step: 'epilogue', done: false })
                try {
                  opts?.driver?.destroy()
                } catch {}
              },
            },
          },
        ],
        onDestroyed: () => {
          tourRef.current = null
        },
      })
      tourRef.current = t
      try {
        t.drive()
      } catch {}
      return
    }

    if (step === 'epilogue') {
      if (!authed) return
      if (typeof pathname !== 'string' || !pathname.startsWith('/album/')) return
      const sel = 'main'
      await waitFor(sel, 1200)
      const t = driver({
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 24,
        allowClose: false,
        overlayClickBehavior: () => {},
        popoverClass: 'pickup-tour',
        showProgress: true,
        onPopoverRender: (popover, opts) => {
          popoverRef.current = popover
          ensureSkipButton(popover, () => {
            persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
            cleanupEpilogueTimer()
            try {
              opts?.driver?.destroy()
            } catch {}
          })
          window.setTimeout(() => startTyping(), 120)
        },
        onDestroyed: () => {
          cleanupEpilogueTimer()
          tourRef.current = null
        },
        steps: [
          {
            element: sel,
            popover: {
              title: copy.epilogue.title,
              description: buildEpilogueHtml(),
              nextBtnText: copy.epilogue.next,
              showButtons: ['next'],
              side: 'middle',
              align: 'center',
              onNextClick: (_el, _step, opts) => {
                persist({ step: 'done', done: true, lastAlbumId: progressRef.current.lastAlbumId })
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
  }

  useEffect(() => {
    if (!ready) return
    if (!authReady) return
    if (progress.done) return

    run()

    return () => {
      destroyTour()
      cleanupEpilogueTimer()
    }
  }, [ready, authReady, authed, pathname, progress.step, progress.done, libraryCount])

  return null
}
