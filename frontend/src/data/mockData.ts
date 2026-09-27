import { Phase, Task, User } from '../types/workflow'
export const users: User[] = [
  { id: 'jamie', name: 'Jamie Doe', initials: 'JD', color: '#f9d8ea', role: 'Frontend Engineer' },
  { id: 'alex', name: 'Alex Kim', initials: 'AK', color: '#dfe5ff', role: 'Product Owner' },
  { id: 'sarah', name: 'Sarah Chen', initials: 'SC', color: '#d7f2e9', role: 'Designer' },
  { id: 'marcus', name: 'Marcus Liu', initials: 'ML', color: '#ffe6c7', role: 'Backend Engineer' },
]
export const tasks: Task[] = [
  { id: 'wpe-001', title: 'Requirements Analysis', description: 'Document the project scope, success criteria, and stakeholder needs.', status: 'DONE', phase: 'Phase 1 · Foundation', assignee: users[1], dueDate: 'Sep 08, 2026', progress: 100, joinLogic: 'ALL_COMPLETED', dependencies: [], accent: '#18b981' },
  { id: 'wpe-002', title: 'Core DB Schema', description: 'Define the data model and migration strategy for the workflow engine.', status: 'DONE', phase: 'Phase 1 · Foundation', assignee: users[3], dueDate: 'Sep 08, 2026', progress: 100, joinLogic: 'ALL_COMPLETED', dependencies: [], accent: '#18b981' },
  { id: 'wpe-014', title: 'Build UI Library', description: 'Build reusable components, state management, and design tokens across all screens.', status: 'IN_PROGRESS', phase: 'Phase 2A · Frontend Dev', assignee: users[0], dueDate: 'Sep 20, 2026', progress: 62, joinLogic: 'ALL_COMPLETED', dependencies: ['wpe-001'], accent: '#f59e0b' },
  { id: 'wpe-015', title: 'Integrate Auth Flow', description: 'Connect sign-in, SSO and project-level access controls.', status: 'IN_PROGRESS', phase: 'Phase 2A · Frontend Dev', assignee: users[0], dueDate: 'Sep 25, 2026', progress: 38, joinLogic: 'ALL_COMPLETED', dependencies: ['wpe-014'], accent: '#f59e0b' },
  { id: 'wpe-016', title: 'Setup Database', description: 'Provision environments and connect the persistence layer.', status: 'IN_PROGRESS', phase: 'Phase 2B · Backend & APIs', assignee: users[3], dueDate: 'Sep 20, 2026', progress: 50, joinLogic: 'ALL_COMPLETED', dependencies: ['wpe-002'], accent: '#f59e0b' },
  { id: 'wpe-017', title: 'API Endpoints', description: 'Implement task and dependency APIs for the canvas experience.', status: 'IN_PROGRESS', phase: 'Phase 2B · Backend & APIs', assignee: users[3], dueDate: 'Sep 26, 2026', progress: 45, joinLogic: 'ALL_COMPLETED', dependencies: ['wpe-016'], accent: '#f59e0b' },
  { id: 'wpe-020', title: 'Integration Test', description: 'Verify both workstreams merge cleanly before release.', status: 'LOCKED', phase: 'Phase 3 · Verification & Delivery', assignee: users[2], dueDate: 'Oct 03, 2026', progress: 0, joinLogic: 'ALL_COMPLETED', dependencies: ['wpe-015', 'wpe-017'], accent: '#94a3b8' },
]
export const phases: Phase[] = [
  { id: 'p1', title: 'Phase 1', subtitle: 'Foundation', status: 'COMPLETED', progress: 100, tasks: tasks.slice(0, 2) },
  { id: 'p2a', title: 'Phase 2A', subtitle: 'Frontend Dev', status: 'IN_PROGRESS', progress: 50, tasks: tasks.slice(2, 4) },
  { id: 'p2b', title: 'Phase 2B', subtitle: 'Backend & APIs', status: 'IN_PROGRESS', progress: 50, tasks: tasks.slice(4, 6) },
  { id: 'p3', title: 'Phase 3', subtitle: 'Verification & Delivery', status: 'LOCKED', tasks: tasks.slice(6) },
]
