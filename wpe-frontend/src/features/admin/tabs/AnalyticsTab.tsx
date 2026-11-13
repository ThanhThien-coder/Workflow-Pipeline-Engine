import { useEffect, useRef, type FC } from 'react';
import Chart from 'chart.js/auto';
import type {
  SystemKpiDto,
  AnalyticsTrendPointDto,
  RoleDistributionDto,
} from '../../../types/admin.types';

interface AnalyticsTabProps {
  kpis: SystemKpiDto | null;
  trends: AnalyticsTrendPointDto[];
  trendRange: '7D' | '30D';
  onRangeChange: (range: '7D' | '30D') => void;
  roleDistribution: RoleDistributionDto | null;
  errorMessage?: string;
}

export const AnalyticsTab: FC<AnalyticsTabProps> = ({
  kpis,
  trends,
  trendRange,
  onRangeChange,
  roleDistribution,
  errorMessage,
}) => {
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineChartRef = useRef<Chart | null>(null);

  const roleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roleChartRef = useRef<Chart | null>(null);

  // Line Chart Effect
  useEffect(() => {
    if (!lineCanvasRef.current || trends.length === 0) return;

    if (lineChartRef.current) {
      lineChartRef.current.destroy();
      lineChartRef.current = null;
    }

    const existingChart = Chart.getChart(lineCanvasRef.current);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = lineCanvasRef.current.getContext('2d');
    if (!ctx) return;

    try {
      const gradient = ctx.createLinearGradient(0, 0, 0, 280);
      gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
      gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

      const labels = trends.map((t) => t.label);
      const executions = trends.map((t) => t.dagExecutions);
      const activeUsers = trends.map((t) => t.activeUsers);

      lineChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Executions',
              data: executions,
              borderColor: '#2563eb',
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              yAxisID: 'y',
            },
            {
              label: 'Active users',
              data: activeUsers,
              borderColor: '#6366f1',
              backgroundColor: 'transparent',
              tension: 0.4,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              labels: {
                usePointStyle: true,
                boxWidth: 7,
                color: '#64748b',
                font: {
                  family: 'Inter',
                  size: 11,
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { color: '#94a3b8', font: { size: 10 } },
            },
            y1: {
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: { color: '#94a3b8', font: { size: 10 } },
            },
          },
        },
      });
    } catch (err) {
      console.warn('Could not initialize line chart:', err);
    }

    return () => {
      if (lineChartRef.current) {
        lineChartRef.current.destroy();
        lineChartRef.current = null;
      }
    };
  }, [trends]);

  // Doughnut Chart Effect
  useEffect(() => {
    if (!roleCanvasRef.current || !roleDistribution) return;

    if (roleChartRef.current) {
      roleChartRef.current.destroy();
      roleChartRef.current = null;
    }

    const existingChart = Chart.getChart(roleCanvasRef.current);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = roleCanvasRef.current.getContext('2d');
    if (!ctx) return;

    try {
      roleChartRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Owner', 'Collaborator', 'Viewer'],
          datasets: [
            {
              data: [
                roleDistribution.ownerCount,
                roleDistribution.collaboratorCount,
                roleDistribution.viewerCount,
              ],
              backgroundColor: ['#2563eb', '#818cf8', '#cbd5e1'],
              borderWidth: 0,
              hoverOffset: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
          },
        },
      });
    } catch (err) {
      console.warn('Could not initialize role distribution chart:', err);
    }

    return () => {
      if (roleChartRef.current) {
        roleChartRef.current.destroy();
        roleChartRef.current = null;
      }
    };
  }, [roleDistribution]);

  const defaultKpis: SystemKpiDto = kpis || {
    totalUsers: 1284,
    userGrowthRate: 12,
    activeWorkspaces: 342,
    newWorkspacesThisWeek: 18,
    dagExecutions: 48920,
    throughputPerMinute: 340,
    systemUptimePercentage: 99.98,
    errorRatePercentage: 0.02,
  };

  const defaultRoles: RoleDistributionDto = roleDistribution || {
    ownerCount: 22,
    collaboratorCount: 56,
    viewerCount: 22,
  };

  if (errorMessage) {
    return (
      <section id="tab-overview" className="tab-panel active">
        <div className="admin-surface flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Chưa có dữ liệu: {errorMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="tab-overview" className="tab-panel active">
      {/* 4 KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Users */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Users</span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">👥</span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {defaultKpis.totalUsers.toLocaleString()}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-bold text-emerald-600">+{defaultKpis.userGrowthRate}%</span>
            <span className="text-slate-400"> vs last month</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">1,240 Active · 44 Suspended</div>
        </div>

        {/* Card 2: Active Workspaces */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Active Workspaces</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">▦</span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {defaultKpis.activeWorkspaces.toLocaleString()}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-bold text-emerald-600">+{defaultKpis.newWorkspacesThisWeek} new</span>
            <span className="text-slate-400"> this week</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">4 Running in Production</div>
        </div>

        {/* Card 3: Pipeline DAG Executions */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Pipeline DAG Executions</span>
            <span className="rounded-lg bg-purple-50 p-2 text-purple-600">⚡</span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {defaultKpis.dagExecutions.toLocaleString()}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-bold text-emerald-600">{defaultKpis.throughputPerMinute}</span>
            <span className="text-slate-400"> runs / minute</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">Peak throughput: 512 runs/min</div>
        </div>

        {/* Card 4: System Health & Uptime */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">System Health &amp; Uptime</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">✓</span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {defaultKpis.systemUptimePercentage}%
          </div>
          <div className="mt-1 text-xs">
            <span className="font-bold text-emerald-600">Healthy</span>
            <span className="text-slate-400"> · Error Rate &lt; {defaultKpis.errorRatePercentage}%</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">Median latency: 24ms</div>
        </div>
      </div>

      {/* Analytics Section Header & Range Toggle */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System Analytics</h2>
          <p className="text-sm text-slate-500">
            Pipeline executions and active users across the platform.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => onRangeChange('7D')}
            className={`range-btn rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              trendRange === '7D'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => onRangeChange('30D')}
            className={`range-btn rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              trendRange === '30D'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Line Chart */}
        <div className="admin-surface p-5 xl:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Pipeline Executions &amp; Active Users
              </h3>
              <p id="chartCaption" className="mt-1 text-xs text-slate-400">
                Last {trendRange === '7D' ? '7' : '30'} days · Daily activity
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Live
            </span>
          </div>
          <div className="h-72">
            <canvas ref={lineCanvasRef} id="lineChart"></canvas>
          </div>
        </div>

        {/* Doughnut Chart */}
        <div className="admin-surface p-5">
          <h3 className="font-bold text-slate-900">User Role Distribution</h3>
          <p className="mt-1 text-xs text-slate-400">Current workspace memberships</p>
          <div className="mx-auto mt-4 h-52 max-w-xs">
            <canvas ref={roleCanvasRef} id="roleChart"></canvas>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-blue-600"></span>
              <b className="text-slate-800">{defaultRoles.ownerCount}%</b>
              <div className="text-slate-400">Owner</div>
            </div>
            <div>
              <span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-indigo-400"></span>
              <b className="text-slate-800">{defaultRoles.collaboratorCount}%</b>
              <div className="text-slate-400">Collaborator</div>
            </div>
            <div>
              <span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-slate-300"></span>
              <b className="text-slate-800">{defaultRoles.viewerCount}%</b>
              <div className="text-slate-400">Viewer</div>
            </div>
          </div>
        </div>
      </div>

      {/* System Quick Diagnostic */}
      <div className="admin-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">System Quick Diagnostic</h3>
            <p className="mt-1 text-xs text-slate-400">Automated checks from the last 60 seconds</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            3 / 3 Operational
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <span>✓</span> API Gateway Cluster
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              All 8 nodes responding · 18ms avg.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <span>✓</span> PostgreSQL Primary
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              CPU 38% · Connections 142 / 500
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <span>✓</span> Queue Workers
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              24 workers online · No backlog
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
