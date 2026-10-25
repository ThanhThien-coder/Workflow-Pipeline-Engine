import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  MemberSummaryDto,
  ProjectDetailDto,
  ProjectSummaryDto,
} from '../../types/workspace.types'
import type { ProjectStatus } from '../../types/settings.types'

const INITIAL_PROJECTS: ProjectSummaryDto[] = [
  {
    id: 1,
    name: 'Marketing Campaign Q4',
    description: 'Content, design and launch tasks for the Q4 campaign.',
    status: 'ACTIVE',
    role: 'OWNER',
    nodeCount: 24,
    criticalPathLength: 8,
    completionPercent: 72,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    members: [
      { id: 'u1', displayName: 'Alex Kim' },
      { id: 'u2', displayName: 'Sarah Chen' },
      { id: 'u3', displayName: 'Marcus Liu' },
      { id: 'u4', displayName: 'Jamie Doe' },
      { id: 'u5', displayName: 'Lena Park' },
    ],
  },
  {
    id: 2,
    name: 'Product Redesign 2026',
    description: 'End-to-end redesign of the core product experience.',
    status: 'DRAFT',
    role: 'OWNER',
    nodeCount: 18,
    criticalPathLength: 6,
    completionPercent: 0,
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    members: [
      { id: 'u1', displayName: 'Alex Kim' },
      { id: 'u2', displayName: 'Sarah Chen' },
    ],
  },
  {
    id: 3,
    name: 'Backend API Migration',
    description: 'Migrate legacy REST endpoints to the new gateway.',
    status: 'ACTIVE',
    role: 'COLLABORATOR',
    nodeCount: 32,
    criticalPathLength: 11,
    completionPercent: 46,
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    members: [
      { id: 'u3', displayName: 'Marcus Liu' },
      { id: 'u1', displayName: 'Alex Kim' },
      { id: 'u2', displayName: 'Sarah Chen' },
      { id: 'u6', displayName: 'Omar Haddad' },
    ],
  },
  {
    id: 4,
    name: 'Data Pipeline ETL',
    description: 'Nightly extract, transform and load into the warehouse.',
    status: 'ACTIVE',
    role: 'OWNER',
    nodeCount: 21,
    criticalPathLength: 7,
    completionPercent: 88,
    updatedAt: '2026-09-22T08:00:00.000Z',
    members: [
      { id: 'u1', displayName: 'Alex Kim' },
      { id: 'u3', displayName: 'Marcus Liu' },
      { id: 'u5', displayName: 'Lena Park' },
    ],
  },
  {
    id: 5,
    name: 'Mobile App Launch',
    description: 'Release checklist and store submission workflow.',
    status: 'ACTIVE',
    role: 'VIEWER',
    nodeCount: 11,
    criticalPathLength: 4,
    completionPercent: 30,
    updatedAt: '2026-09-18T12:00:00.000Z',
    members: [
      { id: 'u2', displayName: 'Sarah Chen' },
      { id: 'u4', displayName: 'Jamie Doe' },
      { id: 'u6', displayName: 'Omar Haddad' },
      { id: 'u5', displayName: 'Lena Park' },
      { id: 'u3', displayName: 'Marcus Liu' },
      { id: 'u1', displayName: 'Alex Kim' },
    ],
  },
  {
    id: 6,
    name: 'Legacy CRM Cleanup',
    description: 'Retire unused CRM objects and migrate remaining data.',
    status: 'ARCHIVED',
    role: 'OWNER',
    nodeCount: 12,
    criticalPathLength: 3,
    completionPercent: 100,
    updatedAt: '2026-08-30T10:00:00.000Z',
    members: [
      { id: 'u1', displayName: 'Alex Kim' },
      { id: 'u4', displayName: 'Jamie Doe' },
    ],
  },
]

const WORKSPACE_STORAGE_KEY = 'wpe_mock_workspace_projects'

function loadStoredProjects(): ProjectSummaryDto[] {
  if (typeof window === 'undefined') return [...INITIAL_PROJECTS]
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...INITIAL_PROJECTS]
}

function saveStoredProjects(projects: ProjectSummaryDto[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(projects))
  } catch {}
}

export class MockWorkspaceApi {
  private projects: ProjectSummaryDto[] = loadStoredProjects()

  async getProjectsList(): Promise<readonly ProjectSummaryDto[]> {
    await new Promise((resolve) => setTimeout(resolve, 200))
    return [...this.projects]
  }

  async getMyProjects(): Promise<readonly ProjectSummaryDto[]> {
    return this.getProjectsList()
  }

  async createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    const isFromTemplate = Boolean(cmd.templateId)
    const newProject: ProjectSummaryDto = {
      id: Date.now(),
      name: cmd.name.trim(),
      description: (cmd.desc || cmd.description || '').trim() || 'No description provided.',
      status: 'DRAFT',
      role: 'OWNER',
      nodeCount: isFromTemplate ? 14 : 0,
      criticalPathLength: isFromTemplate ? 5 : 0,
      completionPercent: 0,
      updatedAt: new Date().toISOString(),
      members: [{ id: 'u1', displayName: 'Alex Kim' }],
    }

    this.projects = [newProject, ...this.projects]
    saveStoredProjects(this.projects)
    return newProject
  }

  async cloneTemplate(cmd: CloneTemplateCommand): Promise<ProjectDetailDto> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    const newId = Date.now()
    const newProject: ProjectSummaryDto = {
      id: newId,
      name: cmd.projectName.trim(),
      description: cmd.description?.trim() || 'Nhân bản từ mẫu quy trình chuẩn.',
      status: 'PLANNING',
      role: 'OWNER',
      nodeCount: 14,
      totalNodes: 14,
      completedNodes: 0,
      inProgressNodes: 0,
      criticalPathLength: 5,
      completionPercent: 0,
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [{ id: 'u1', displayName: 'Alex Kim' }],
    }

    this.projects = [newProject, ...this.projects]
    saveStoredProjects(this.projects)

    const detail: ProjectDetailDto = {
      id: String(newId),
      name: newProject.name,
      description: newProject.description,
      status: 'PLANNING',
      ownerId: 'u1',
      ownerName: 'Alex Kim',
      role: 'OWNER',
      totalNodes: 14,
      nodeCount: 14,
      completedNodes: 0,
      inProgressNodes: 0,
      progressPercentage: 0,
      completionPercent: 0,
      createdAt: newProject.createdAt,
      updatedAt: newProject.updatedAt,
      latestAiAnalysis: null,
      phases: [
        { id: '1', name: 'Foundation', orderIndex: 0, nodeCount: 4 },
        { id: '2', name: 'Core Engine', orderIndex: 1, nodeCount: 10 },
      ],
      members: newProject.members,
    }

    return detail
  }

  updateProjectStatus(id: number | string, status: ProjectStatus): void {
    const p = this.projects.find((item) => String(item.id) === String(id))
    if (p) {
      p.status = status
      p.updatedAt = new Date().toISOString()
      saveStoredProjects(this.projects)
    }
  }

  deleteProject(id: number | string): void {
    this.projects = this.projects.filter((item) => String(item.id) !== String(id))
    saveStoredProjects(this.projects)
  }

  reset(): void {
    this.projects = [...INITIAL_PROJECTS]
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY)
      } catch {}
    }
  }
}
