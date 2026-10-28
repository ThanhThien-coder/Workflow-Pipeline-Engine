import type {
  MacroPhase,
  PhaseTree,
  GraphNodeMap,
} from '../../types/workflow.types'
import type { TemplateDetailDto, GraphDataPayload } from '../../types/template.types'
import { initialMockTemplates } from '../template/mockTemplateData'
import { TEMPLATES_STORAGE_KEY } from '../template/MockTemplateService'
import { isPhaseAncestor } from '../../utils/spanningTreeLayout'
import { withPhaseProgress } from '../../domain/phaseProgress'
import {
  computeSmartMacroPhasePosition,
  computeMacroGraphLayout,
  MACRO_CARD_W,
  MACRO_CARD_H,
} from '../../utils/macroLayout'

export interface StoredProjectGraph {
  phases: MacroPhase[]
  trees: Record<string, PhaseTree>
}

const PROJECT_GRAPH_KEY = (id: string | number) => `wpe_mock_project_graph_${id}`

export function getStoredProjectGraph(projectId: string | number): StoredProjectGraph | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROJECT_GRAPH_KEY(projectId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.phases)) {
        return parsed
      }
    }

    // Auto-fallback for projects created with templateId
    const rawProjects = localStorage.getItem('wpe_mock_workspace_projects')
    if (rawProjects) {
      const projects = JSON.parse(rawProjects)
      const p = projects.find((item: any) => String(item.id) === String(projectId))
      if (p && p.templateId) {
        return cloneTemplateToProject(projectId, p.templateId, p.name)
      }
    }
  } catch (err) {
    console.warn(`[mockProjectGraphStore] Failed to load graph for project ${projectId}:`, err)
  }
  return null
}

export function saveStoredProjectGraph(
  projectId: string | number,
  data: StoredProjectGraph
): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROJECT_GRAPH_KEY(projectId), JSON.stringify(data))
  } catch (err) {
    console.warn(`[mockProjectGraphStore] Failed to save graph for project ${projectId}:`, err)
  }
}

export function findTemplateById(templateId: string | number): TemplateDetailDto | null {
  const targetId = String(templateId)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY)
      if (raw) {
        const list: TemplateDetailDto[] = JSON.parse(raw)
        const found = list.find((t) => String(t.id) === targetId)
        if (found) return found
      }
    } catch {}
  }
  return initialMockTemplates.find((t) => String(t.id) === targetId) || null
}

export function convertTemplateToProjectGraph(
  templateGraph: GraphDataPayload,
  projectName: string
): StoredProjectGraph {
  const { phases = [], phaseEdges = [], nodes = [] } = templateGraph

  let codeSeq = 1

  // 1. Map PhaseDto[] to MacroPhase[]
  const macroPhases: MacroPhase[] = phases.map((p, idx) => {
    // Gather parent phases
    const edgeParents = phaseEdges
      .filter((e) => e.childPhaseId === p.id)
      .map((e) => e.parentPhaseId)
    const runsAfter = p.runsAfter || []
    const parentPhaseIds = Array.from(new Set([...edgeParents, ...runsAfter]))

    const pos = (p.uiMetadata?.position as { x?: number; y?: number }) || {}
    const defaultX = idx === 0 ? 40 : 40 + idx * 370
    const defaultY = 140

    const isFirst = parentPhaseIds.length === 0
    // status/pct/locked được suy ra từ cây task ở cuối hàm (withPhaseProgress)
    return {
      id: p.id,
      name: `PHASE ${p.order != null ? p.order + 1 : idx + 1}`,
      sub: p.name || `Phase ${idx + 1}`,
      status: 'TODO',
      pct: 0,
      accent: isFirst ? 'blue' : 'slate',
      x: 40,
      y: 60,
      w: MACRO_CARD_W,
      h: MACRO_CARD_H,
      parentPhaseIds,
    }
  })

  // Automatically calculate balanced, non-overlapping DAG auto-layout for macro phases
  // ONLY executed once upon creating a new project from a template.
  const phaseMap: Record<string, MacroPhase> = {}
  macroPhases.forEach((p) => {
    phaseMap[p.id] = p
  })
  const cleanLayout = computeMacroGraphLayout(phaseMap)
  macroPhases.forEach((p) => {
    if (cleanLayout[p.id]) {
      p.x = cleanLayout[p.id].x
      p.y = cleanLayout[p.id].y
    }
  })

  // 2. Map nodes to PhaseTree for each phase
  const trees: Record<string, PhaseTree> = {}

  for (const p of phases) {
    const phaseNodes = nodes.filter((n) => n.phaseId === p.id)
    const graphNodeMap: GraphNodeMap = {}
    // Giống engine backend: task của Phase có Phase tiền nhiệm chờ ở LOCKED, Phase gốc sẵn sàng ở TODO
    const hasParentPhase = (macroPhases.find((mp) => mp.id === p.id)?.parentPhaseIds.length ?? 0) > 0

    // Find root node or fallback
    const rootNode = phaseNodes.find((n) => n.level === 0 || n.id === p.rootNodeId)
    const rootId = rootNode ? rootNode.id : `root_${p.id}`

    graphNodeMap[rootId] = {
      id: rootId,
      kind: 'root',
      parentIds: [],
      title: p.name || 'Phase Root',
    }

    // Process tracks (level 1) and tasks (level >= 2)
    for (const n of phaseNodes) {
      if (n.id === rootId || n.level === 0) continue

      const isTrack = n.level === 1
      const parentId = n.parentId || rootId

      graphNodeMap[n.id] = {
        kind: 'branch',
        id: n.id,
        code: `WPE-${String(codeSeq++).padStart(3, '0')}`,
        title: n.title,
        description: n.description || '',
        isTrack,
        status: isTrack ? 'IN_PROGRESS' : hasParentPhase ? 'LOCKED' : 'TODO',
        assignee: null,
        due: null,
        blocker: 'Không có',
        joinPolicy: n.joinPolicy === 'ANY_COMPLETED' ? 'ANY_COMPLETED' : 'AND',
        parentIds: [parentId],
        trackId: n.trackId || (isTrack ? n.id : null),
        parentId,
        level: n.level,
      }
    }

    trees[p.id] = {
      title: p.name,
      breadcrumb: `${projectName} › ${p.name}`,
      pct: 0,
      gate: { prLink: null, prMerged: false, swagger: '' },
      nodes: graphNodeMap,
    }
  }

  return {
    phases: macroPhases.map((mp) => withPhaseProgress(mp, trees[mp.id]?.nodes)),
    trees,
  }
}

export function cloneTemplateToProject(
  projectId: string | number,
  templateId: string | number,
  projectName: string
): StoredProjectGraph | null {
  const template = findTemplateById(templateId)
  if (!template || !template.graphData) {
    console.warn(`[mockProjectGraphStore] Template ${templateId} not found or has no graphData`)
    return null
  }

  const projectGraph = convertTemplateToProjectGraph(template.graphData, projectName)
  saveStoredProjectGraph(projectId, projectGraph)

  // Increment clone count for the template in localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY)
      if (raw) {
        const list: TemplateDetailDto[] = JSON.parse(raw)
        const matched = list.find((t) => String(t.id) === String(templateId))
        if (matched) {
          matched.cloneCount = (matched.cloneCount || 0) + 1
          localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(list))
        }
      }
    } catch {}
  }

  return projectGraph
}

export function addPhaseToProject(
  projectId: string | number,
  dto: { name: string; sub?: string; parentPhaseId?: string; x?: number; y?: number; accent?: 'emerald' | 'blue' | 'slate' }
): MacroPhase {
  let graph = getStoredProjectGraph(projectId)
  if (!graph) {
    graph = { phases: [], trees: {} }
  }

  const timestamp = Date.now()
  const id = `ph_${timestamp}`
  
  // Smart downward/branching positioning identical to Template Studio
  const smartPos = computeSmartMacroPhasePosition(graph.phases, dto.parentPhaseId)
  const finalX = dto.x ?? smartPos.x
  const finalY = dto.y ?? smartPos.y

  const newPhase: MacroPhase = {
    id,
    name: dto.name || `PHASE ${graph.phases.length + 1}`,
    sub: dto.sub || 'Giai đoạn mới',
    status: 'TODO',
    pct: 0,
    accent: dto.accent || (dto.parentPhaseId ? 'slate' : 'blue'),
    x: finalX,
    y: finalY,
    w: MACRO_CARD_W,
    h: MACRO_CARD_H,
    parentPhaseIds: dto.parentPhaseId ? [dto.parentPhaseId] : [],
  }

  const rootId = `root_${id}`
  const trackId = `trk_${timestamp}`
  const taskId = `tsk_${timestamp}`

  graph.phases.push(newPhase)
  graph.trees[id] = {
    title: newPhase.sub,
    breadcrumb: `Project › ${newPhase.sub}`,
    pct: 0,
    gate: { prLink: null, prMerged: false, swagger: '' },
    nodes: {
      [rootId]: { id: rootId, kind: 'root', parentIds: [], title: newPhase.sub },
      [trackId]: {
        kind: 'branch',
        id: trackId,
        code: `WPE-${String(graph.phases.length * 10).padStart(3, '0')}`,
        title: 'Track A',
        description: '',
        isTrack: true,
        status: 'IN_PROGRESS',
        assignee: null,
        due: null,
        blocker: 'Không có',
        joinPolicy: 'AND',
        parentIds: [rootId],
        trackId: trackId,
        parentId: rootId,
        level: 1,
      },
      [taskId]: {
        kind: 'branch',
        id: taskId,
        code: `WPE-${String(graph.phases.length * 10 + 1).padStart(3, '0')}`,
        title: 'Task khởi đầu',
        description: '',
        isTrack: false,
        status: dto.parentPhaseId ? 'LOCKED' : 'TODO',
        assignee: null,
        due: null,
        blocker: 'Không có',
        joinPolicy: 'AND',
        parentIds: [trackId],
        trackId: trackId,
        parentId: trackId,
        level: 2,
      },
    },
  }
  Object.assign(newPhase, withPhaseProgress(newPhase, graph.trees[id].nodes))

  saveStoredProjectGraph(projectId, graph)
  return newPhase
}

export function connectPhasesInProject(
  projectId: string | number,
  sourceId: string,
  targetId: string
): boolean {
  const graph = getStoredProjectGraph(projectId)
  if (!graph) return false

  const target = graph.phases.find((p) => p.id === targetId)
  const source = graph.phases.find((p) => p.id === sourceId)
  if (!target || !source) return false

  const phaseMap = Object.fromEntries(graph.phases.map((p) => [p.id, p]))
  if (isPhaseAncestor(phaseMap, targetId, sourceId)) {
    throw new Error('Không thể nối ngược (tránh chu trình lặp đồ thị)')
  }

  if (!target.parentPhaseIds.includes(sourceId)) {
    target.parentPhaseIds.push(sourceId)
    saveStoredProjectGraph(projectId, graph)
  }
  return true
}

export function disconnectPhasesInProject(
  projectId: string | number,
  sourceId: string,
  targetId: string
): boolean {
  const graph = getStoredProjectGraph(projectId)
  if (!graph) return false

  const target = graph.phases.find((p) => p.id === targetId)
  if (!target) return false

  target.parentPhaseIds = target.parentPhaseIds.filter((id) => id !== sourceId)
  saveStoredProjectGraph(projectId, graph)
  return true
}

export function deletePhaseInProject(
  projectId: string | number,
  phaseId: string
): boolean {
  const graph = getStoredProjectGraph(projectId)
  if (!graph) return false

  graph.phases = graph.phases
    .filter((p) => p.id !== phaseId)
    .map((p) => ({
      ...p,
      parentPhaseIds: p.parentPhaseIds.filter((id) => id !== phaseId),
    }))
  delete graph.trees[phaseId]
  saveStoredProjectGraph(projectId, graph)
  return true
}

export function updatePhasePositionInProject(
  projectId: string | number,
  phaseId: string,
  pos: { x: number; y: number }
): void {
  const graph = getStoredProjectGraph(projectId)
  if (!graph) return

  const phase = graph.phases.find((p) => p.id === phaseId)
  if (phase) {
    phase.x = pos.x
    phase.y = pos.y
    saveStoredProjectGraph(projectId, graph)
  }
}
