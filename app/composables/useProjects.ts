import type { SeparateProject, SeparateUser } from '#shared/types/project'

const PROJECTS_KEY = 'separate-web-projects'
const USER_KEY = 'separate-web-user'

const createId = () => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const readJson = <T>(key: string, fallback: T): T => {
  if (!import.meta.client) {
    return fallback
  }

  const raw = localStorage.getItem(key)

  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const writeJson = <T>(key: string, value: T) => {
  if (import.meta.client) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}

export const useProjects = () => {
  const projects = useState<SeparateProject[]>('separate-web-projects', () => [])
  const user = useState<SeparateUser | null>('separate-web-user', () => null)

  const hydrate = () => {
    projects.value = readJson<SeparateProject[]>(PROJECTS_KEY, [])
    user.value = readJson<SeparateUser | null>(USER_KEY, null)
  }

  const login = (payload: SeparateUser) => {
    user.value = payload
    writeJson(USER_KEY, payload)
  }

  const logout = () => {
    user.value = null

    if (import.meta.client) {
      localStorage.removeItem(USER_KEY)
    }
  }

  const createProject = (payload: { name: string, description: string }) => {
    const now = new Date().toISOString()
    const project: SeparateProject = {
      id: createId(),
      name: payload.name.trim(),
      description: payload.description.trim(),
      links: [],
      createdAt: now,
      updatedAt: now
    }

    projects.value = [project, ...projects.value]
    writeJson(PROJECTS_KEY, projects.value)

    return project
  }

  const findProject = (id: string) => {
    return projects.value.find((project) => project.id === id) || null
  }

  const addLink = (projectId: string, url: string) => {
    const nextProjects = projects.value.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const normalized = url.trim()

      if (!normalized || project.links.includes(normalized)) {
        return project
      }

      return {
        ...project,
        links: [normalized, ...project.links],
        updatedAt: new Date().toISOString()
      }
    })

    projects.value = nextProjects
    writeJson(PROJECTS_KEY, nextProjects)
  }

  return {
    projects,
    user,
    hydrate,
    login,
    logout,
    createProject,
    findProject,
    addLink
  }
}
