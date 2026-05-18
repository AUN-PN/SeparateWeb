<script setup lang="ts">
const { locale, t, toggleLocale } = useLocale()
const { hydrate, login } = useProjects()
const router = useRouter()
const name = ref('Designer')
const email = ref('designer@separate.local')

onMounted(hydrate)

useHead(() => ({
  title: t.value.login.title
}))

const submit = async () => {
  login({
    name: name.value.trim() || 'SeparateWeb User',
    email: email.value.trim() || 'user@separate.local'
  })
  await router.push('/user')
}

</script>

<template>
  <main class="page-shell auth-shell">
    <nav class="auth-nav">
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
          to="/"
          class="secondary-action"
        >
          {{ t.nav.home }}
        </NuxtLink>
      </div>
    </nav>

    <section class="auth-stage">
      <section class="auth-card">
        <header>
          <p class="eyebrow">
            {{ t.login.eyebrow }}
          </p>
        </header>

        <form
          class="auth-form"
          @submit.prevent="submit"
        >
          <label>
            {{ t.login.name }}
            <input
              v-model="name"
              type="text"
              autocomplete="name"
            >
          </label>
          <label>
            {{ t.login.email }}
            <input
              v-model="email"
              type="email"
              autocomplete="email"
            >
          </label>
          <button type="submit">
            {{ t.login.submit }}
          </button>
        </form>
      </section>
    </section>
  </main>
</template>
