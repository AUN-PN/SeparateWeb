<script setup lang="ts">
const { locale, t, toggleLocale } = useLocale()
const isNavScrolled = ref(false)

useHead(() => ({
  title: 'SeparateWeb',
  meta: [
    {
      name: 'description',
      content: t.value.home.metaDescription
    }
  ]
}))

const demoUrl = 'https://demo.separateweb.dev/orbit-store'

const updateNavState = () => {
  isNavScrolled.value = window.scrollY > 24
}

onMounted(() => {
  updateNavState()
  window.addEventListener('scroll', updateNavState, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateNavState)
})

const heroSignals = computed(() => t.value.home.signals)

const terminalLines = [
  '$ separateweb capture https://demo.separateweb.dev/orbit-store',
  'render full-page.png',
  'detect 40 UI blocks',
  'split 17 card surfaces',
  'export 165 PNG assets + metadata'
]

const proofStats = computed(() => [
  { value: '165', label: t.value.home.stats[0] },
  { value: '40', label: t.value.home.stats[1] },
  { value: '17', label: t.value.home.stats[2] },
  { value: '0', label: t.value.home.stats[3] }
])

const capabilityIcons = ['capture', 'split', 'metadata', 'browse', 'export', 'repeat']

const capabilities = computed(() =>
  t.value.home.capabilities.map((capability, index) => ({
    ...capability,
    icon: capabilityIcons[index]
  }))
)

const outputAssets = [
  {
    file: 'orbit-store-original.png',
    image: '/showcase/orbit-store/orbit-store-original.png',
    bounds: '1440x900',
    export: 'PNG'
  },
  {
    file: 'orbit-store-surface.png',
    image: '/showcase/orbit-store/orbit-store-surface.png',
    bounds: '960x540',
    export: 'PNG'
  },
  {
    file: 'orbit-store-info.png',
    image: '/showcase/orbit-store/orbit-store-info.png',
    bounds: '898x412',
    export: 'PNG + metadata'
  },
  {
    file: 'feature-card-surface.png',
    image: '/showcase/orbit-store/feature-card-surface.png',
    bounds: '318x386',
    export: 'PNG transparent'
  }
]

const localizedOutputAssets = computed(() =>
  outputAssets.map((asset, index) => ({
    ...asset,
    ...t.value.home.outputAssets[index]
  }))
)

const architectureNodes = computed(() => t.value.home.architectureNodes)
</script>

<template>
  <main class="page-shell home-shell">
    <nav
      class="home-nav"
      :class="{ 'is-scrolled': isNavScrolled }"
    >
      <NuxtLink
        to="/"
        class="brand-word"
      >
        <span class="brand-mark" />
        <span>
          <small>UI CONTROL</small>
          SeparateWeb
        </span>
      </NuxtLink>

      <div class="home-nav-tabs">
        <NuxtLink to="/">
          {{ t.nav.home }}
        </NuxtLink>
      </div>

      <div class="home-nav-actions">
        <button
          class="language-toggle"
          type="button"
          :aria-label="t.nav.language"
          @click="toggleLocale"
        >
          {{ locale === 'th' ? 'EN' : 'TH' }}
        </button>
        <NuxtLink
          to="/login"
          class="secondary-action"
        >
          {{ t.nav.login }}
        </NuxtLink>
      </div>
    </nav>

    <section class="home-stars">
      <section
        id="platform"
        class="home-hero"
      >
        <div class="home-hero-copy">
          <h1>{{ t.home.title }}</h1>
          <p>
            {{ t.home.intro }}
          </p>
          <div class="home-hero-actions">
            <NuxtLink
              to="/login"
              class="primary-action"
            >
              {{ t.home.start }}
            </NuxtLink>
            <NuxtLink
              to="/user"
              class="secondary-action"
            >
              {{ t.home.workspace }}
            </NuxtLink>
          </div>
          <div class="home-signal-row">
            <span
              v-for="signal in heroSignals"
              :key="signal"
            >
              {{ signal }}
            </span>
          </div>
        </div>

        <div class="home-terminal-card">
          <header>
            <span />
            <span />
            <span />
            <strong>terminal</strong>
          </header>
          <div class="home-terminal-body">
            <p
              v-for="line in terminalLines"
              :key="line"
            >
              {{ line }}
            </p>
          </div>
        </div>
      </section>
    </section>

    <section
      id="proof"
      class="home-proof-band"
    >
      <div class="home-proof-heading">
        <p class="eyebrow">
          {{ t.home.proofEyebrow }}
        </p>
        <h2>{{ t.home.proofTitle }}</h2>
        <p>{{ demoUrl }}</p>
      </div>

      <div class="home-proof-stats">
        <article
          v-for="stat in proofStats"
          :key="stat.label"
        >
          <strong>{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
        </article>
      </div>

      <div class="home-capture-grid">
        <figure class="home-capture-main">
          <img
            src="/showcase/orbit-store/orbit-store-original.png"
            alt="Orbit Store original website capture"
          >
          <span class="scan-tag scan-tag-a">screen surface</span>
          <span class="scan-tag scan-tag-b">info layer</span>
          <span class="scan-tag scan-tag-c">card surface</span>
        </figure>

        <aside class="home-layer-panel">
          <p class="eyebrow">
            {{ t.home.selectedLayer }}
          </p>
          <h3>feature-card-surface.png</h3>
          <dl>
            <div>
              <dt>{{ t.home.kind }}</dt>
              <dd>card surface</dd>
            </div>
            <div>
              <dt>{{ t.home.bounds }}</dt>
              <dd>x 688, y 244, w 318, h 386</dd>
            </div>
            <div>
              <dt>{{ t.home.export }}</dt>
              <dd>PNG transparent</dd>
            </div>
          </dl>
          <figure>
            <img
              src="/showcase/orbit-store/feature-card-surface.png"
              alt="Extracted card surface"
            >
          </figure>
        </aside>
      </div>
    </section>

    <section class="home-feature-section">
      <svg
        class="home-icon-sprite"
        aria-hidden="true"
      >
        <symbol
          id="feature-icon-capture"
          viewBox="0 0 24 24"
        >
          <rect
            x="3.5"
            y="5"
            width="17"
            height="14"
            rx="3"
          />
          <path d="M3.5 9h17" />
          <path d="M8 14l2.2 2.2L15 11.5" />
        </symbol>
        <symbol
          id="feature-icon-split"
          viewBox="0 0 24 24"
        >
          <rect
            x="4"
            y="4"
            width="6.5"
            height="6.5"
            rx="1.5"
          />
          <rect
            x="13.5"
            y="4"
            width="6.5"
            height="6.5"
            rx="1.5"
          />
          <rect
            x="4"
            y="13.5"
            width="6.5"
            height="6.5"
            rx="1.5"
          />
          <path d="M14 15h4.5a1.5 1.5 0 0 1 1.5 1.5V20" />
        </symbol>
        <symbol
          id="feature-icon-metadata"
          viewBox="0 0 24 24"
        >
          <path d="M6 7l-2 2 2 2" />
          <path d="M18 7l2 2-2 2" />
          <path d="M9 6h6" />
          <path d="M8 14h8" />
          <path d="M8 18h5" />
        </symbol>
        <symbol
          id="feature-icon-browse"
          viewBox="0 0 24 24"
        >
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            rx="3"
          />
          <path d="M8 9h5" />
          <path d="M8 13h3" />
          <circle
            cx="15.5"
            cy="14"
            r="2.5"
          />
          <path d="M17.4 15.9L20 18.5" />
        </symbol>
        <symbol
          id="feature-icon-export"
          viewBox="0 0 24 24"
        >
          <rect
            x="5"
            y="4"
            width="14"
            height="11"
            rx="2"
          />
          <path d="M12 7v11" />
          <path d="M8.5 14.5L12 18l3.5-3.5" />
          <path d="M7 20h10" />
        </symbol>
        <symbol
          id="feature-icon-repeat"
          viewBox="0 0 24 24"
        >
          <path d="M7 7h7a4 4 0 0 1 4 4v1" />
          <path d="M15 4l3 3-3 3" />
          <path d="M17 17h-7a4 4 0 0 1-4-4v-1" />
          <path d="M9 20l-3-3 3-3" />
        </symbol>
      </svg>
      <div class="home-section-heading">
        <p class="eyebrow">
          {{ t.home.featureEyebrow }}
        </p>
        <h2>{{ t.home.featureTitle }}</h2>
      </div>
      <div class="home-feature-grid">
        <article
          v-for="capability in capabilities"
          :key="capability.title"
        >
          <span
            class="feature-icon"
            aria-hidden="true"
          >
            <svg>
              <use :href="`#feature-icon-${capability.icon}`" />
            </svg>
          </span>
          <h3>{{ capability.title }}</h3>
          <p>{{ capability.detail }}</p>
        </article>
      </div>
    </section>

    <section
      id="workflow"
      class="home-layer-section"
    >
      <div class="home-section-heading">
        <p class="eyebrow">
          {{ t.home.workflowEyebrow }}
        </p>
        <h2>{{ t.home.workflowTitle }}</h2>
      </div>

      <div class="home-architecture">
        <svg
          class="home-architecture-lines"
          viewBox="0 0 1280 420"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="architecture-line-gradient"
              x1="0"
              x2="1"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stop-color="#20d69d"
                stop-opacity="0.32"
              />
              <stop
                offset="50%"
                stop-color="#20d69d"
                stop-opacity="0.92"
              />
              <stop
                offset="100%"
                stop-color="#2dd4bf"
                stop-opacity="0.34"
              />
            </linearGradient>
          </defs>
          <g class="architecture-wire-glow">
            <path d="M558 172 C506 150 462 96 405 84" />
            <path d="M722 172 C774 150 818 96 875 84" />
            <path d="M552 206 C500 210 432 218 365 220" />
            <path d="M728 206 C780 210 848 218 915 220" />
            <path d="M640 290 C640 312 640 326 640 342" />
          </g>
          <g class="architecture-wire-rail">
            <path d="M558 172 C506 150 462 96 405 84" />
            <path d="M722 172 C774 150 818 96 875 84" />
            <path d="M552 206 C500 210 432 218 365 220" />
            <path d="M728 206 C780 210 848 218 915 220" />
            <path d="M640 290 C640 312 640 326 640 342" />
          </g>
          <g class="architecture-wire-trace">
            <path d="M558 172 C506 150 462 96 405 84" />
            <path d="M722 172 C774 150 818 96 875 84" />
            <path d="M552 206 C500 210 432 218 365 220" />
            <path d="M728 206 C780 210 848 218 915 220" />
            <path d="M640 290 C640 312 640 326 640 342" />
          </g>
          <g class="architecture-wire-ports">
            <circle
              cx="558"
              cy="172"
              r="4"
            />
            <circle
              cx="405"
              cy="84"
              r="3"
            />
            <circle
              cx="722"
              cy="172"
              r="4"
            />
            <circle
              cx="875"
              cy="84"
              r="3"
            />
            <circle
              cx="552"
              cy="206"
              r="4"
            />
            <circle
              cx="365"
              cy="220"
              r="3"
            />
            <circle
              cx="728"
              cy="206"
              r="4"
            />
            <circle
              cx="915"
              cy="220"
              r="3"
            />
            <circle
              cx="640"
              cy="290"
              r="4"
            />
            <circle
              cx="640"
              cy="342"
              r="3"
            />
          </g>
        </svg>
        <span
          v-for="node in architectureNodes"
          :key="node"
        >
          {{ node }}
        </span>
        <strong>SeparateWeb</strong>
      </div>

      <div class="home-output-strip">
        <article
          v-for="asset in localizedOutputAssets"
          :key="asset.file"
          :class="{ 'is-card-surface': asset.file === 'feature-card-surface.png' }"
        >
          <figure>
            <img
              :src="asset.image"
              :alt="asset.title"
            >
          </figure>
          <div class="output-card-copy">
            <h3>{{ asset.title }}</h3>
            <p>{{ asset.description }}</p>
          </div>
          <dl class="output-card-specs">
            <div>
              <dt>{{ t.home.kind }}</dt>
              <dd>{{ asset.kind }}</dd>
            </div>
            <div>
              <dt>{{ t.home.bounds }}</dt>
              <dd>{{ asset.bounds }}</dd>
            </div>
            <div>
              <dt>{{ t.home.export }}</dt>
              <dd>{{ asset.export }}</dd>
            </div>
            <div>
              <dt>{{ t.home.use }}</dt>
              <dd>{{ asset.useCase }}</dd>
            </div>
          </dl>
          <p class="output-file-name">{{ asset.file }}</p>
        </article>
      </div>
    </section>
  </main>
</template>
