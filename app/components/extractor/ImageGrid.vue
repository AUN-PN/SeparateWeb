<script setup lang="ts">
import type { UiBlockImage, UiBlockKind } from '#shared/types/ui-extraction'

const props = defineProps<{
  items: UiBlockImage[]
}>()

type FilterKind = UiBlockKind | 'all'

const activeKind = ref<FilterKind>('all')

const kindLabels: Record<UiBlockKind, string> = {
  modal: 'Modals',
  card: 'Cards',
  button: 'Buttons',
  link: 'Links',
  field: 'Fields',
  icon: 'Icons',
  form: 'Forms',
  navigation: 'Navigation',
  layout: 'Layout',
  media: 'Media',
  content: 'Content'
}

const kindOrder = Object.keys(kindLabels) as UiBlockKind[]

const filters = computed(() => {
  const counts = props.items.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1
    return acc
  }, {} as Partial<Record<UiBlockKind, number>>)

  const entries = Object.entries(kindLabels)
    .map(([kind, label]) => ({
      kind: kind as UiBlockKind,
      label,
      count: counts[kind as UiBlockKind] || 0
    }))
    .filter((entry) => entry.count > 0)

  return [
    { kind: 'all' as const, label: 'All', count: props.items.length },
    ...entries
  ]
})

const sections = computed(() => {
  const activeKinds = activeKind.value === 'all'
    ? kindOrder
    : [activeKind.value]

  return activeKinds
    .map((kind) => {
      const items = props.items.filter((item) => item.kind === kind)

      return {
        kind,
        label: kindLabels[kind],
        count: items.length,
        items
      }
    })
    .filter((section) => section.count > 0)
})

const totalVisible = computed(() => {
  return sections.value.reduce((sum, section) => {
    return sum + section.count
  }, 0)
})

const sectionTitle = (label: string, count: number) => {
  if (count === 1) {
    return `${label} · 1 asset`
  }

  return `${label} · ${count} assets`
}

const readableText = (item: UiBlockImage) => {
  return item.attributes.ariaLabel
    || item.attributes.title
    || item.attributes.text
    || item.label
}

const previewLayer = (item: UiBlockImage) => {
  return item.layers.find((layer) => layer.kind === 'card-surface')
    || item.layers.find((layer) => layer.kind === 'background')
    || item.layers.find((layer) => layer.kind === 'icon-transparent')
    || item.layers.find((layer) => layer.kind === 'original')
}

const primaryLayers = (item: UiBlockImage) => {
  return item.layers.filter((layer) => layer.kind !== 'card-part')
}

const partLayers = (item: UiBlockImage) => {
  return item.layers.filter((layer) => layer.kind === 'card-part')
}
</script>

<template>
  <section class="asset-browser">
    <div class="filter-bar">
      <button
        v-for="filter in filters"
        :key="filter.kind"
        type="button"
        class="filter-button"
        :class="{ active: activeKind === filter.kind }"
        @click="activeKind = filter.kind"
      >
        {{ filter.label }}
        <span>{{ filter.count }}</span>
      </button>
    </div>

    <div class="asset-section-list">
      <section
        v-for="section in sections"
        :key="section.kind"
        class="asset-category"
      >
        <header class="category-header">
          <h2>{{ sectionTitle(section.label, section.count) }}</h2>
          <span>{{ section.count }} / {{ totalVisible }}</span>
        </header>

        <div class="asset-grid">
          <article
            v-for="item in section.items"
            :key="item.id"
            class="asset-card"
          >
            <div class="asset-card-main">
              <a
                :href="previewLayer(item)?.imageUrl || item.imageUrl"
                target="_blank"
                rel="noreferrer"
                class="asset-preview"
              >
                <img
                  :src="previewLayer(item)?.imageUrl || item.imageUrl"
                  :alt="item.label"
                  loading="lazy"
                >
              </a>

              <div class="asset-body">
                <div class="asset-meta">
                  <div>
                    <span class="kind-pill">{{ kindLabels[item.kind] || item.kind }}</span>
                    <strong>{{ item.label }}</strong>
                    <span>{{ item.tagName.toLowerCase() }} · {{ item.selector }}</span>
                  </div>
                  <code>{{ Math.round(item.bounds.width) }}x{{ Math.round(item.bounds.height) }}</code>
                </div>

                <div
                  v-if="primaryLayers(item).length"
                  class="layer-strip primary-layers"
                >
                  <a
                    v-for="layer in primaryLayers(item)"
                    :key="layer.imageUrl"
                    :href="layer.imageUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="layer-tile"
                    :class="{ transparent: layer.transparent }"
                  >
                    <img
                      :src="layer.imageUrl"
                      :alt="`${item.label} ${layer.label}`"
                      loading="lazy"
                    >
                    <span>{{ layer.label }}</span>
                    <code>{{ layer.transparent ? 'transparent PNG' : 'PNG' }}</code>
                  </a>
                </div>
              </div>
            </div>

            <details
              v-if="partLayers(item).length"
              class="part-drawer"
            >
              <summary>
                <span>Card parts</span>
                <strong>{{ partLayers(item).length }} transparent PNG</strong>
              </summary>
              <div class="part-grid">
                <a
                  v-for="layer in partLayers(item)"
                  :key="layer.imageUrl"
                  :href="layer.imageUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="part-tile transparent"
                >
                  <img
                    :src="layer.imageUrl"
                    :alt="`${item.label} ${layer.label}`"
                    loading="lazy"
                  >
                  <span>{{ layer.label }}</span>
                </a>
              </div>
            </details>

            <details class="metadata-drawer">
              <summary>Metadata</summary>
              <dl class="asset-details">
                <div>
                  <dt>Selector</dt>
                  <dd><code>{{ item.selector }}</code></dd>
                </div>
                <div v-if="item.parentSelector">
                  <dt>Parent</dt>
                  <dd><code>{{ item.parentSelector }}</code></dd>
                </div>
                <div v-if="item.attributes.role || item.attributes.type || item.attributes.name">
                  <dt>Attrs</dt>
                  <dd>
                    <code v-if="item.attributes.role">role={{ item.attributes.role }}</code>
                    <code v-if="item.attributes.type">type={{ item.attributes.type }}</code>
                    <code v-if="item.attributes.name">name={{ item.attributes.name }}</code>
                  </dd>
                </div>
                <div v-if="item.attributes.href">
                  <dt>Href</dt>
                  <dd><code>{{ item.attributes.href }}</code></dd>
                </div>
                <div v-if="item.attributes.classes.length">
                  <dt>Classes</dt>
                  <dd>
                    <code
                      v-for="className in item.attributes.classes"
                      :key="className"
                    >
                      .{{ className }}
                    </code>
                  </dd>
                </div>
                <div v-if="readableText(item)">
                  <dt>Text</dt>
                  <dd>{{ readableText(item) }}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>
                    <code>{{ item.state.disabled ? 'disabled' : 'enabled' }}</code>
                    <code v-if="item.state.hasIcon">has-icon</code>
                    <code v-if="item.state.hasText">has-text</code>
                    <code>depth={{ item.depth }}</code>
                  </dd>
                </div>
              </dl>
            </details>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
