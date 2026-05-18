<script setup lang="ts">
defineProps<{
  contextLabel?: string
}>()

const { locale, t, toggleLocale } = useLocale()
const { user, logout } = useProjects()
const router = useRouter()

const signOut = async () => {
  logout()
  await router.push('/')
}
</script>

<template>
  <aside class="user-sidebar">
    <div class="user-sidebar-brand-row">
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

      <button
        class="language-toggle"
        type="button"
        :aria-label="t.nav.language"
        @click="toggleLocale"
      >
        {{ locale === 'th' ? 'EN' : 'TH' }}
      </button>
    </div>

    <nav class="user-sidebar-actions">
      <NuxtLink
        to="/"
        class="secondary-action"
      >
        {{ t.nav.home }}
      </NuxtLink>
      <NuxtLink
        to="/user"
        class="secondary-action"
      >
        โปรเจ็ค MCP
      </NuxtLink>
    </nav>

    <div class="user-sidebar-meta">
      <div class="user-sidebar-avatar">
        {{ (user?.name || 'S').slice(0, 1).toUpperCase() }}
      </div>
      <div>
        <span>{{ contextLabel || 'Workspace' }}</span>
        <strong>{{ user?.name || 'SeparateWeb User' }}</strong>
        <small>{{ user?.email || 'local workspace' }}</small>
      </div>
      <button
        type="button"
        class="ghost-button user-logout"
        @click="signOut"
      >
        Logout
      </button>
    </div>
  </aside>
</template>
