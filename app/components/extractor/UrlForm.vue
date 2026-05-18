<script setup lang="ts">
const props = defineProps<{
  pending: boolean
}>()

const emit = defineEmits<{
  submit: [url: string]
  reset: []
}>()

const url = ref('')

const canSubmit = computed(() => url.value.trim().length > 0 && !props.pending)

const submit = () => {
  if (!canSubmit.value) {
    return
  }

  emit('submit', url.value.trim())
}
</script>

<template>
  <form
    class="capture-form"
    @submit.prevent="submit"
  >
    <label for="target-url">Website URL</label>
    <div class="input-row">
      <input
        id="target-url"
        v-model="url"
        type="url"
        inputmode="url"
        placeholder="https://example.com or file:///Users/name/site/index.html"
        autocomplete="url"
        required
      >
      <button
        type="submit"
        :disabled="!canSubmit"
      >
        {{ pending ? 'Capturing...' : 'Extract UI' }}
      </button>
      <button
        type="button"
        class="ghost-button"
        :disabled="pending"
        @click="emit('reset')"
      >
        Clear
      </button>
    </div>
  </form>
</template>
