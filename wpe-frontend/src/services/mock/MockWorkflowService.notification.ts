import type { INotificationService } from '../contracts/INotificationService'
import type { NotificationDto, NotificationListDto } from '../../types/notification.types'
import { MockConfig } from './MockConfig'

const KEY = 'wpe_mock_notifications_read'

type Seed = Omit<NotificationDto, 'createdAt' | 'isRead'> & { minutesAgo: number; unread: boolean }

const SEED: Seed[] = [
  { id: 'n1', kind: 'approval', actorName: 'Sarah Chen', text: 'approved schema for WPE-009', minutesAgo: 2, unread: true, targetPath: '/project/1/workflow?node=WPE-009' },
  { id: 'n2', kind: 'comment', actorName: 'Alex Kim', text: 'commented on WPE-012: "JWT expiration policy is still unclear"', minutesAgo: 18, unread: true, targetPath: '/project/1/my-tasks' },
  { id: 'n3', kind: 'overdue', actorName: null, text: 'WPE-014 is overdue and blocking the release', minutesAgo: 62, unread: true, targetPath: '/project/1/overview' },
  { id: 'n4', kind: 'pr', actorName: 'Marcus Liu', text: 'submitted PR for WPE-012', minutesAgo: 190, unread: true, targetPath: '/project/1/workflow?node=WPE-012' },
  { id: 'n5', kind: 'assignment', actorName: 'Jamie Doe', text: 'assigned you to Login Form Component', minutesAgo: 320, unread: false, targetPath: '/project/1/my-tasks' },
  { id: 'n6', kind: 'comment', actorName: 'Lan Nguyen', text: 'requested clarification on Schema Design (WPE-009)', minutesAgo: 1500, unread: false, targetPath: '/project/1/workflow?node=WPE-009' },
  { id: 'n7', kind: 'system', actorName: 'Sarah Chen', text: 'published the pipeline for Phase 2', minutesAgo: 2900, unread: false, targetPath: '/project/1/overview' },
  { id: 'n8', kind: 'comment', actorName: 'Minh Nguyen', text: 'replied to your feedback on Auth API', minutesAgo: 4300, unread: false, targetPath: '/project/1/workflow' },
  { id: 'n9', kind: 'assignment', actorName: 'Sarah Chen', text: 'added you to Marketing Campaign Q4', minutesAgo: 8600, unread: false, targetPath: '/project/1/overview' },
  { id: 'n10', kind: 'approval', actorName: 'Alex Kim', text: 'approved your artifact for WPE-004', minutesAgo: 11500, unread: false, targetPath: '/project/1/my-tasks' },
  { id: 'n11', kind: 'pr', actorName: 'Marcus Liu', text: 'merged branch feat/flyway-migration-v3 into develop', minutesAgo: 15800, unread: false, targetPath: '/project/1/workflow' },
  { id: 'n12', kind: 'system', actorName: null, text: 'Automated dependency audit completed with zero vulnerabilities', minutesAgo: 20100, unread: false, targetPath: '/project/1/overview' },
  { id: 'n13', kind: 'comment', actorName: 'Lan Nguyen', text: 'marked task WPE-002 as ready for security review', minutesAgo: 24500, unread: false, targetPath: '/project/1/workflow?node=WPE-002' },
  { id: 'n14', kind: 'approval', actorName: 'Alex Kim', text: 'signed off on architecture RFC #14', minutesAgo: 31000, unread: false, targetPath: '/project/1/overview' },
  { id: 'n15', kind: 'assignment', actorName: 'Sarah Chen', text: 'assigned you to Core Engine Performance Benchmark', minutesAgo: 41000, unread: false, targetPath: '/project/1/my-tasks' },
  { id: 'n16', kind: 'overdue', actorName: null, text: 'WPE-001 (Legacy Migration) marked as archived', minutesAgo: 53000, unread: false, targetPath: '/project/1/overview' },
  { id: 'n17', kind: 'comment', actorName: 'Jamie Doe', text: 'shared profiling telemetry logs on Slack #devops', minutesAgo: 65000, unread: false, targetPath: '/project/1/overview' },
  { id: 'n18', kind: 'system', actorName: null, text: 'Weekly system backup completed successfully', minutesAgo: 82000, unread: false, targetPath: '/project/1/overview' },
]

export class MockNotificationApi implements INotificationService {
  private readonly base = Date.now()
  private readIds: Set<string> = this.restore()

  private restore(): Set<string> {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY) || '[]') as string[])
    } catch {
      return new Set<string>()
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.readIds]))
    } catch {
      /* ignore */
    }
  }

  private async tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, MockConfig.latencyMs))
    if (MockConfig.fakeError500) throw new Error('Mock 500: Internal Server Error')
  }

  private toDto(s: Seed): NotificationDto {
    const { minutesAgo, unread, ...rest } = s
    return { ...rest, createdAt: new Date(this.base - minutesAgo * 60000).toISOString(), isRead: !unread || this.readIds.has(s.id) }
  }

  async list(limit = 30): Promise<NotificationListDto> {
    await this.tick()
    const items = SEED.slice(0, limit).map((s) => this.toDto(s))
    return { items, unreadCount: items.filter((i) => !i.isRead).length }
  }

  async markAsRead(id: string): Promise<NotificationDto> {
    await this.tick()
    const seed = SEED.find((s) => s.id === id)
    if (!seed) throw new Error('Notification not found')
    this.readIds.add(id)
    this.persist()
    return this.toDto(seed)
  }

  async markAllAsRead(): Promise<void> {
    await this.tick()
    SEED.forEach((s) => this.readIds.add(s.id))
    this.persist()
  }
}
