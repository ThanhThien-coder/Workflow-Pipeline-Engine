import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import {
  selectVisibleProjects,
  selectTabCounts,
  selectStats,
} from '../workspaceSlice'

describe('Workspace Module (workspaceSlice)', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    store = createWorkflowStore(new MockWorkflowService())
  })

  it('loads 6 seeded projects with exactly matching spec figures', async () => {
    await store.getState().workspace.loadProjects()

    const projects = store.getState().workspace.projects
    expect(projects).toHaveLength(6)

    const stats = selectStats(projects)
    // Verification against Tech Spec: 6 Projects, 118 Nodes, 4 Running in Production
    expect(stats.total).toBe(6)
    expect(stats.activeNodes).toBe(118)
    expect(stats.runningInProduction).toBe(4)

    const counts = selectTabCounts(projects)
    // Sửa theo SSOT backend / TASK_15: tab 'all' không gồm dự án ARCHIVED
    expect(counts.all).toBe(5)
    expect(counts.mine).toBe(4) // Owner: 1, 2, 4, 6
    expect(counts.shared).toBe(2) // 3 (Collaborator), 5 (Viewer)
    expect(counts.archived).toBe(1) // 6 (Archived)
  })

  it('filters visible projects by tab correctly', async () => {
    await store.getState().workspace.loadProjects()
    const projects = store.getState().workspace.projects

    const mine = selectVisibleProjects(projects, 'mine', '', 'ts')
    expect(mine).toHaveLength(4)
    expect(mine.every((p) => p.role === 'OWNER')).toBe(true)

    const shared = selectVisibleProjects(projects, 'shared', '', 'ts')
    expect(shared).toHaveLength(2)
    expect(shared.every((p) => p.role !== 'OWNER')).toBe(true)

    const archived = selectVisibleProjects(projects, 'archived', '', 'ts')
    expect(archived).toHaveLength(1)
    expect(archived[0].status).toBe('ARCHIVED')
  })

  it('filters projects by search query', async () => {
    await store.getState().workspace.loadProjects()
    const projects = store.getState().workspace.projects

    const filtered = selectVisibleProjects(projects, 'all', 'Marketing', 'ts')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Marketing Campaign Q4')
  })

  it('sorts projects by completion percentage and node count', async () => {
    await store.getState().workspace.loadProjects()
    const projects = store.getState().workspace.projects

    // Sửa theo SSOT backend / TASK_15: Legacy CRM Cleanup (100%) bị loại khỏi tab 'all' vì có status ARCHIVED;
    // dự án có completion cao nhất tiếp theo trong tab 'all' là Data Pipeline ETL (88%).
    const sortedByDone = selectVisibleProjects(projects, 'all', '', 'done')
    expect(sortedByDone[0].done).toBe(88) // Data Pipeline ETL (88%)
    expect(sortedByDone[sortedByDone.length - 1].done).toBe(0) // Product Redesign 2026 (0%)

    const sortedByNodes = selectVisibleProjects(projects, 'all', '', 'nodes')
    expect(sortedByNodes[0].nodes).toBe(32) // Backend API Migration (32 nodes)
  })

  it('selectVisibleProjects: tab all loại bỏ ARCHIVED, tab archived chỉ hiển thị ARCHIVED', async () => {
    await store.getState().workspace.loadProjects()
    const projects = store.getState().workspace.projects

    const allVisible = selectVisibleProjects(projects, 'all', '', 'ts')
    expect(allVisible.every((p) => p.status !== 'ARCHIVED')).toBe(true)
    expect(allVisible).toHaveLength(5)

    const archivedVisible = selectVisibleProjects(projects, 'archived', '', 'ts')
    expect(archivedVisible.every((p) => p.status === 'ARCHIVED')).toBe(true)
    expect(archivedVisible).toHaveLength(1)
    expect(archivedVisible[0].name).toBe('Legacy CRM Cleanup')
  })

  it('creates a new pipeline and updates store state', async () => {
    await store.getState().workspace.loadProjects()
    const beforeCount = store.getState().workspace.projects.length

    const created = await store.getState().workspace.createProject({
      name: 'Authentication Service V2',
      desc: 'High scale auth gateway',
    })

    expect(created.name).toBe('Authentication Service V2')
    expect(created.status).toBe('DRAFT')
    expect(created.role).toBe('OWNER')

    const afterProjects = store.getState().workspace.projects
    expect(afterProjects).toHaveLength(beforeCount + 1)
    expect(afterProjects[0].name).toBe('Authentication Service V2')
    expect(afterProjects[0].status).toBe('DRAFT')
  })

  it('clones a template DAG and updates store state with deep-copied project', async () => {
    await store.getState().workspace.loadProjects()
    const beforeCount = store.getState().workspace.projects.length

    const cloned = await store.getState().workspace.cloneTemplate({
      templateId: '1',
      projectName: 'Cloned Banking DAG',
      description: 'Cloned from core template',
      visibility: 'PRIVATE',
    })

    expect(cloned.name).toBe('Cloned Banking DAG')
    expect(cloned.status).toBe('PLANNING')
    expect(cloned.role).toBe('OWNER')
    expect(cloned.totalNodes).toBe(14)
    expect(cloned.phases).toHaveLength(2)

    const afterProjects = store.getState().workspace.projects
    expect(afterProjects).toHaveLength(beforeCount + 1)
    expect(afterProjects[0].name).toBe('Cloned Banking DAG')
    expect(afterProjects[0].status).toBe('PLANNING')
  })

  it('creates a pipeline with templateId using cloneTemplate flow', async () => {
    await store.getState().workspace.loadProjects()
    const beforeCount = store.getState().workspace.projects.length

    const created = await store.getState().workspace.createProject({
      name: 'E-Commerce Microservices Pipeline',
      desc: 'Cloned via createProject with templateId',
      templateId: 'tpl-101',
      visibility: 'PRIVATE',
    })

    expect(created.name).toBe('E-Commerce Microservices Pipeline')
    expect(created.status).toBe('PLANNING')
    expect(created.role).toBe('OWNER')

    const afterProjects = store.getState().workspace.projects
    expect(afterProjects).toHaveLength(beforeCount + 1)
    expect(afterProjects[0].name).toBe('E-Commerce Microservices Pipeline')
    expect(afterProjects[0].status).toBe('PLANNING')
  })
})
