<script setup lang="ts">
import type { UiExtractionResult } from '#shared/types/ui-extraction'

const props = defineProps<{
  result: UiExtractionResult
}>()

const categoryLabel = (kind: string) => {
  const labels: Record<string, string> = {
    modal: 'Modals',
    card: 'Cards',
    button: 'Buttons',
    link: 'Links',
    field: 'Fields',
    icon: 'Icons',
    form: 'Forms',
    navigation: 'Nav',
    layout: 'Layout',
    media: 'Media',
    content: 'Content'
  }

  return labels[kind] || kind
}

const featuredCounts = computed(() => {
  return props.result.categoryCounts.filter((entry) => ['card', 'button', 'modal', 'icon', 'field', 'link'].includes(entry.kind))
})
</script>

<template>
  <section class="summary-panel">
    <div class="summary-main">
      <div>
        <span>Title</span>
        <strong>{{ result.title || 'Untitled page' }}</strong>
      </div>
      <div>
        <span>Origin</span>
        <strong>{{ result.origin }}</strong>
      </div>
      <div>
        <span>Total images</span>
        <strong>{{ result.totalBlocks }}</strong>
      </div>
      <a
        :href="result.fullPageImageUrl"
        target="_blank"
        rel="noreferrer"
      >
        Full page
      </a>
    </div>

    <div class="summary-counts">
      <span
        v-for="entry in featuredCounts"
        :key="entry.kind"
      >
        {{ categoryLabel(entry.kind) }} <strong>{{ entry.count }}</strong>
      </span>
      <span v-if="result.hiddenModalCount > 0">
        Hidden modals <strong>{{ result.hiddenModalCount }}</strong>
      </span>
    </div>
  </section>
</template>
