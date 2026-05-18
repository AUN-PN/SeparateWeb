<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { projects, user, hydrate, findProject, addLink } = useProjects()
const { result, crawlResult, error, pending, extract, reset } = useUiExtraction()
const linkUrl = ref('')
const scanAllPages = ref(false)
const maxPages = ref(8)
const activeCrawlPageIndex = ref(0)

const project = computed(() => {
  return findProject(String(route.params.id))
})

onMounted(() => {
  hydrate()

  if (!user.value) {
    router.replace('/login')
  }
})

useHead({
  title: 'Project | SeparateWeb'
})

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()

  if (/^(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(trimmed) || trimmed.startsWith('[::1]')) {
    return `http://${trimmed}`
  }

  return trimmed
}

const submitLink = async () => {
  if (!project.value || !linkUrl.value.trim()) {
    return
  }

  const normalized = normalizeUrl(linkUrl.value)
  addLink(project.value.id, normalized)
  await extract(normalized, {
    crawl: scanAllPages.value,
    maxPages: maxPages.value
  })
}

const openSavedLink = async (link: string) => {
  linkUrl.value = link
  await extract(link, {
    crawl: scanAllPages.value,
    maxPages: maxPages.value
  })
}

const successfulCrawlPages = computed(() => {
  return crawlResult.value?.pages.filter((page) => page.result) || []
})

const activeCrawlPage = computed(() => {
  return successfulCrawlPages.value[activeCrawlPageIndex.value] || null
})

const failedCrawlPages = computed(() => {
  return crawlResult.value?.pages.filter((page) => !page.result) || []
})

const crawlHint = computed(() => {
  if (!crawlResult.value) {
    return ''
  }

  if (crawlResult.value.totalPages >= maxPages.value) {
    return `Reached Max pages ${maxPages.value}`
  }

  if (crawlResult.value.totalPages === 1) {
    return 'Only 1 page was discoverable from links/sitemap'
  }

  return `${crawlResult.value.totalPages} discoverable pages`
})

const projectStats = computed(() => [
  {
    value: project.value?.links.length.toString() || '0',
    label: 'Saved URLs'
  },
  {
    value: crawlResult.value ? `${crawlResult.value.succeededPages}/${crawlResult.value.totalPages}` : (result.value ? '1' : '0'),
    label: crawlResult.value ? 'Pages captured' : 'Current capture'
  },
  {
    value: successfulCrawlPages.value.length ? `${activeCrawlPageIndex.value + 1}/${successfulCrawlPages.value.length}` : (pending.value ? 'Running' : 'Ready'),
    label: successfulCrawlPages.value.length ? 'Selected page' : 'Inspector'
  }
])

watch(projects, () => {
  if (!project.value && import.meta.client) {
    router.replace('/user')
  }
})

watch(crawlResult, () => {
  activeCrawlPageIndex.value = 0
})

watch(successfulCrawlPages, (pages) => {
  if (activeCrawlPageIndex.value >= pages.length) {
    activeCrawlPageIndex.value = 0
  }
})
</script>

<template>
  <main class="page-shell app-shell user-shell project-detail-page">
    <UserSidebar :context-label="project?.name || 'Project inspector'" />

    <section
      v-if="project"
      class="workspace user-workspace project-detail-workspace"
    >
      <header class="user-hero project-detail-hero">
        <div class="user-hero-copy">
          <NuxtLink
            to="/user"
            class="back-link"
          >
            Projects
          </NuxtLink>
          <p class="home-pill">
            <span />
            Project inspector
          </p>
          <h1>{{ project.name }}</h1>
          <p>{{ project.description || 'ใส่ link เพื่อเริ่มแยก UI assets' }}</p>
        </div>

        <div class="user-stat-grid">
          <article
            v-for="stat in projectStats"
            :key="stat.label"
          >
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </article>
        </div>
      </header>

      <form
        class="capture-form project-capture-form"
        @submit.prevent="submitLink"
      >
        <div class="capture-form-heading">
          <div>
            <p class="eyebrow">Capture source</p>
            <label for="project-url">Project URL</label>
          </div>
          <span>{{ scanAllPages ? 'Multi-page crawl' : 'Single page' }}</span>
        </div>
        <div class="input-row">
          <input
            id="project-url"
            v-model="linkUrl"
            type="text"
            inputmode="url"
            placeholder="https://runtime-proof.singular-orbit.workers.dev/"
            required
          >
          <button
            type="submit"
            :disabled="pending"
          >
            {{ pending ? (scanAllPages ? 'Scanning...' : 'Capturing...') : 'Extract UI' }}
          </button>
          <button
            type="button"
            class="ghost-button"
            :disabled="pending"
            @click="reset"
          >
            Clear
          </button>
        </div>
        <div class="scan-options">
          <label class="checkbox-row">
            <input
              v-model="scanAllPages"
              type="checkbox"
            >
            Scan all reachable pages
          </label>
          <label
            v-if="scanAllPages"
            class="max-pages-field"
          >
            Max pages
            <input
              v-model.number="maxPages"
              type="number"
              min="1"
              max="20"
            >
          </label>
        </div>
      </form>

      <section
        v-if="project.links.length"
        class="saved-links project-saved-links"
      >
        <button
          v-for="link in project.links"
          :key="link"
          type="button"
          class="filter-button"
          @click="openSavedLink(link)"
        >
          {{ link }}
        </button>
      </section>

      <p
        v-if="error"
        class="error-banner"
      >
        {{ error }}
      </p>

      <section
        v-if="crawlResult"
        class="crawl-overview"
      >
        <div class="crawl-heading">
          <div>
            <span>Crawl result</span>
            <strong>{{ crawlResult.succeededPages }}/{{ crawlResult.totalPages }} pages captured</strong>
          </div>
          <span v-if="crawlResult.failedPages > 0">
            {{ crawlResult.failedPages }} failed
          </span>
          <span v-else-if="crawlHint">
            {{ crawlHint }}
          </span>
        </div>
        <nav class="crawl-page-nav">
          <button
            v-for="(page, index) in successfulCrawlPages"
            :key="page.url"
            type="button"
            class="crawl-page-link"
            :class="{ active: activeCrawlPageIndex === index }"
            @click="activeCrawlPageIndex = index"
          >
            <strong>{{ index + 1 }}</strong>
            <span>{{ page.result?.title || page.url }}</span>
            <small>{{ page.result?.totalBlocks }} images</small>
          </button>
        </nav>
      </section>

      <section
        v-if="crawlResult && activeCrawlPage"
        class="crawl-page-stack"
      >
        <article
          :key="activeCrawlPage.url"
          class="crawl-page-section"
        >
          <header class="crawl-page-header">
            <div>
              <span>{{ activeCrawlPageIndex + 1 }} / {{ successfulCrawlPages.length }}</span>
              <h2>{{ activeCrawlPage.result?.title || 'Untitled page' }}</h2>
              <p>{{ activeCrawlPage.url }}</p>
            </div>
            <a
              v-if="activeCrawlPage.result"
              :href="activeCrawlPage.result.fullPageImageUrl"
              target="_blank"
              rel="noreferrer"
            >
              Full page
            </a>
          </header>

          <ExtractorResultSummary
            v-if="activeCrawlPage.result"
            :result="activeCrawlPage.result"
          />

          <ExtractorImageGrid
            v-if="activeCrawlPage.result"
            :items="activeCrawlPage.result.items"
          />
        </article>

        <section
          v-if="failedCrawlPages.length"
          class="crawl-failed-panel"
        >
          <h2>Failed pages</h2>
          <p
            v-for="page in failedCrawlPages"
            :key="page.url"
          >
            <strong>{{ page.url }}</strong>
            <span>{{ page.error }}</span>
          </p>
        </section>
      </section>

      <template v-else>
        <ExtractorResultSummary
          v-if="result"
          :result="result"
        />

        <ExtractorImageGrid
          v-if="result"
          :items="result.items"
        />
      </template>
    </section>
  </main>
</template>
