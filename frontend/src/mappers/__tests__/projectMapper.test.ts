import { describe, it, expect } from 'vitest'
import { mapProjectDtoToVm } from '../projectMapper'
import type { ProjectSummaryDto } from '../../types/workspace.types'

describe('projectMapper', () => {
  it('maps ProjectSummaryDto to ProjectCardVm with deterministic tone and icon', () => {
    const dto: ProjectSummaryDto = {
      id: 1,
      name: 'Marketing Campaign Q4',
      description: 'Test description',
      status: 'ACTIVE',
      role: 'OWNER',
      nodeCount: 24,
      criticalPathLength: 8,
      completionPercent: 72,
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      members: [
        { id: 'u1', displayName: 'Alex Kim' },
        { id: 'u2', displayName: 'Sarah Chen' },
      ],
    }

    const vm = mapProjectDtoToVm(dto)

    expect(vm.id).toBe(1)
    expect(vm.name).toBe('Marketing Campaign Q4')
    expect(vm.nodes).toBe(24)
    expect(vm.crit).toBe(8)
    expect(vm.done).toBe(72)
    expect(vm.status).toBe('ACTIVE')
    expect(vm.role).toBe('OWNER')
    expect(vm.roleLabel).toBe('Owner')
    expect(vm.tone).toBe('indigo')
    expect(vm.icon).toBe('◆')
    expect(vm.members).toEqual(['Alex Kim', 'Sarah Chen'])
    expect(vm.upd).toContain('2 hours ago')
  })

  it('correctly maps tone and icon for IDs 1 through 6 matching prototypes', () => {
    const expected = [
      { id: 1, tone: 'indigo', icon: '◆' },
      { id: 2, tone: 'amber', icon: '▲' },
      { id: 3, tone: 'sky', icon: '⬢' },
      { id: 4, tone: 'emerald', icon: '◉' },
      { id: 5, tone: 'violet', icon: '■' },
      { id: 6, tone: 'slate', icon: '▣' },
    ]

    for (const item of expected) {
      const vm = mapProjectDtoToVm({
        id: item.id,
        name: `Project ${item.id}`,
        description: '',
        status: 'ACTIVE',
        role: 'OWNER',
        nodeCount: 10,
        criticalPathLength: 2,
        completionPercent: 50,
        updatedAt: new Date().toISOString(),
        members: [],
      })

      expect(vm.tone).toBe(item.tone)
      expect(vm.icon).toBe(item.icon)
    }
  })
})
