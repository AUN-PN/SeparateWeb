<script setup lang="ts">
const { projects, user, hydrate, createProject } = useProjects()
const router = useRouter()
const projectName = ref('')
const projectDescription = ref('')

onMounted(() => {
  hydrate()

  if (!user.value) {
    router.replace('/login')
  }
})

useHead({
  title: 'Projects | SeparateWeb'
})

const totalLinks = computed(() => {
  return projects.value.reduce((sum, project) => sum + project.links.length, 0)
})

const latestProject = computed(() => {
  return projects.value[0] || null
})

const workspaceStats = computed(() => [
  {
    value: projects.value.length.toString(),
    label: 'Projects'
  },
  {
    value: totalLinks.value.toString(),
    label: 'Saved URLs'
  },
  {
    value: latestProject.value ? 'Ready' : 'New',
    label: latestProject.value ? latestProject.value.name : 'Workspace'
  }
])

const submitProject = async () => {
  if (!projectName.value.trim()) {
    return
  }

  const project = createProject({
    name: projectName.value,
    description: projectDescription.value
  })

  projectName.value = ''
  projectDescription.value = ''
  await router.push(`/user/projects/${project.id}`)
}

</script>

<template>
  <main class="page-shell app-shell user-shell">
    <UserSidebar />

    <section class="user-workspace">
      <header class="user-hero">
        <div class="user-hero-copy">
          <p class="home-pill">
            <span />
            User workspace
          </p>
          <h1>Projects</h1>
          <p v-if="user">
            {{ user.name }} · {{ user.email }}
          </p>
          <p v-else>
            Create project containers for website capture runs and reusable UI assets.
          </p>
        </div>

        <div class="user-stat-grid">
          <article
            v-for="stat in workspaceStats"
            :key="stat.label"
          >
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </article>
        </div>
      </header>

      <section class="project-layout user-project-layout">
        <form
          class="project-create user-project-create"
          @submit.prevent="submitProject"
        >
          <div>
            <p class="eyebrow">
              New capture set
            </p>
            <h2>สร้าง project</h2>
          </div>
          <label>
            Project name
            <input
              v-model="projectName"
              type="text"
              placeholder="Marketing UI capture"
              required
            >
          </label>
          <label>
            Description
            <textarea
              v-model="projectDescription"
              placeholder="เก็บ URL ที่ต้องการแยก asset"
            />
          </label>
          <button
            type="submit"
            class="primary-action"
          >
            Create project
          </button>
        </form>

        <div class="project-list user-project-list">
          <article
            v-for="project in projects"
            :key="project.id"
            class="project-card"
          >
            <div>
              <h2>{{ project.name }}</h2>
              <p>{{ project.description || 'No description' }}</p>
              <span>{{ project.links.length }} links</span>
            </div>
            <NuxtLink
              class="secondary-action"
              :to="`/user/projects/${project.id}`"
            >
              Open
            </NuxtLink>
          </article>

          <section
            v-if="projects.length === 0"
            class="empty-state"
          >
            <p class="eyebrow">
              Empty workspace
            </p>
            <h2>ยังไม่มี project</h2>
            <p>สร้าง project แรกเพื่อเก็บ URLs และเริ่มแยก UI assets</p>
          </section>
        </div>
      </section>
    </section>
  </main>
</template>
