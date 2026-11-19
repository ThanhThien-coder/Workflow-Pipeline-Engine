import { ShieldCheck } from 'lucide-react'
import type { ProjectRole } from '../../types/settings.types'
import {
  ROLE_DESCRIPTIONS,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  ROLE_TITLES,
  permissionForRole,
  type PermissionValue,
} from './rolePermissions'

interface RolesPermissionsSectionProps {
  myRole: ProjectRole
}

function Cell({ value }: { value: PermissionValue }) {
  if (value === true) {
    return <span aria-label="Allowed" className="font-bold text-emerald-600">✓</span>
  }
  if (value === false) {
    return <span aria-label="Not allowed" className="text-slate-300">–</span>
  }
  return <span className="text-[11px] font-medium text-emerald-700">{value}</span>
}

export function RolesPermissionsSection({ myRole }: RolesPermissionsSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Roles and permissions">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div>
          <h2 className="text-sm font-bold text-slate-800">Roles &amp; permissions</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            What each project role can do. Your role is highlighted.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-3 py-2 font-semibold text-slate-500">Action</th>
              {ROLE_ORDER.map((role) => (
                <th
                  key={role}
                  scope="col"
                  data-role={role}
                  data-current={role === myRole ? 'true' : 'false'}
                  title={ROLE_DESCRIPTIONS[role]}
                  className={`px-3 py-2 text-center font-semibold ${
                    role === myRole ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                  }`}
                >
                  {ROLE_TITLES[role]}
                  {role === myRole && <span className="ml-1 text-[10px] font-medium">(you)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_PERMISSIONS.map((r) => (
              <tr key={r.action} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="px-3 py-2 font-medium text-slate-700">{r.action}</th>
                {ROLE_ORDER.map((role) => (
                  <td
                    key={role}
                    data-role={role}
                    data-current={role === myRole ? 'true' : 'false'}
                    className={`px-3 py-2 text-center ${role === myRole ? 'bg-indigo-50/60' : ''}`}
                  >
                    <Cell value={permissionForRole(r, role)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        ✓ allowed · – not allowed · text = allowed with a limit (for example, only tasks assigned to you).
      </p>
    </section>
  )
}
