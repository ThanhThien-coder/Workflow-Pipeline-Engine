import type {
  TemplateDetailDto,
  PhaseDto,
  PhaseEdgeDto,
  TemplateNodeDto,
  NodeEdgeDto,
  TemplateCategory,
} from '../../types/template.types';

interface RawNodeSpec {
  id: string;
  title: string;
  description?: string;
  joinPolicy?: 'ALL_COMPLETED' | 'ANY_COMPLETED';
  children?: RawNodeSpec[];
}

interface RawPhaseSpec {
  id: string;
  name: string;
  root: RawNodeSpec;
}

function buildTemplateDetail(
  id: string,
  name: string,
  description: string,
  category: TemplateCategory,
  isSystemStandard: boolean,
  cloneCount: number,
  phaseSpecs: RawPhaseSpec[],
  crossDependencies: Array<{ id: string; parentId: string; childId: string }> = []
): TemplateDetailDto {
  const phases: PhaseDto[] = [];
  const phaseEdges: PhaseEdgeDto[] = [];
  const nodes: TemplateNodeDto[] = [];
  const edges: NodeEdgeDto[] = crossDependencies.map((d) => ({
    id: d.id,
    parentId: d.parentId,
    childId: d.childId,
    kind: 'DEPENDENCY',
  }));

  // Build sequential phase edges
  for (let i = 0; i < phaseSpecs.length; i++) {
    const spec = phaseSpecs[i];
    phases.push({
      id: spec.id,
      name: spec.name,
      order: i,
      rootNodeId: spec.root.id,
      uiMetadata: { position: { x: i * 370, y: 0 } },
    });

    if (i > 0) {
      phaseEdges.push({
        parentPhaseId: phaseSpecs[i - 1].id,
        childPhaseId: spec.id,
      });
    }

    // Traverse root tree to produce flat nodes
    function traverse(
      curr: RawNodeSpec,
      parentId: string | null,
      trackId: string | null,
      level: number
    ) {
      const assignedTrackId = level === 1 ? curr.id : trackId;
      nodes.push({
        id: curr.id,
        phaseId: spec.id,
        parentId,
        trackId: assignedTrackId,
        title: curr.title,
        description: curr.description || '',
        level,
        joinPolicy: curr.joinPolicy || 'ALL_COMPLETED',
        uiMetadata: { position: { x: level * 280, y: 0 } },
      });

      if (curr.children) {
        for (const child of curr.children) {
          traverse(child, curr.id, assignedTrackId, level + 1);
        }
      }
    }

    traverse(spec.root, null, null, 0);
  }

  const now = new Date('2026-03-15T09:00:00Z').toISOString();

  return {
    id,
    name,
    description,
    category,
    isSystemStandard,
    phaseCount: phases.length,
    nodeCount: nodes.length,
    cloneCount,
    createdBy: 'Root Admin',
    createdAt: now,
    updatedAt: now,
    graphData: {
      schemaVersion: 2,
      phases,
      phaseEdges,
      nodes,
      edges,
      metadata: {
        version: '1.0',
      },
    },
  };
}

export const initialMockTemplates: TemplateDetailDto[] = [
  // 1. Standard Software Development (SDLC)
  buildTemplateDetail(
    'tpl-sdlc',
    'Standard Software Development (SDLC)',
    'Quy trình phát triển phần mềm chuẩn: từ phân tích yêu cầu, thiết kế kiến trúc, lập trình frontend/backend đến kiểm thử và phát hành.',
    'Software Engineering',
    true,
    128,
    [
      {
        id: 'ph-sdlc-1',
        name: 'Foundation',
        root: {
          id: 'nd-f-0',
          title: 'Foundation',
          children: [
            {
              id: 'nd-f-req',
              title: 'Requirements',
              children: [
                {
                  id: 'nd-f-req-1',
                  title: 'Gather stakeholder needs',
                  children: [
                    { id: 'nd-f-req-1-a', title: 'Interview users' },
                    { id: 'nd-f-req-1-b', title: 'Draft user stories' },
                  ],
                },
                { id: 'nd-f-req-2', title: 'Write SRS document' },
              ],
            },
            {
              id: 'nd-f-arch',
              title: 'Architecture',
              children: [
                { id: 'nd-f-arch-1', title: 'Select tech stack' },
                {
                  id: 'nd-f-arch-2',
                  title: 'Design system diagram',
                  children: [{ id: 'nd-f-arch-2-a', title: 'Review with team' }],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-sdlc-2',
        name: 'Core Services',
        root: {
          id: 'nd-c-0',
          title: 'Core Services',
          children: [
            {
              id: 'nd-c-fe',
              title: 'Frontend Development',
              children: [
                {
                  id: 'nd-c-fe-1',
                  title: 'Build UI components',
                  children: [
                    { id: 'nd-c-fe-1-a', title: 'Design tokens' },
                    { id: 'nd-c-fe-1-b', title: 'Component library' },
                  ],
                },
                {
                  id: 'nd-c-fe-2',
                  title: 'Integrate API & State',
                  joinPolicy: 'ANY_COMPLETED',
                },
              ],
            },
            {
              id: 'nd-c-be',
              title: 'Backend Services',
              children: [
                { id: 'nd-c-be-1', title: 'Design database schema' },
                {
                  id: 'nd-c-be-2',
                  title: 'Implement REST API',
                  children: [
                    { id: 'nd-c-be-2-a', title: 'Auth module' },
                    { id: 'nd-c-be-2-b', title: 'Core services' },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-sdlc-3',
        name: 'Release',
        root: {
          id: 'nd-r-0',
          title: 'Release',
          children: [
            {
              id: 'nd-r-qa',
              title: 'Quality Assurance',
              children: [
                { id: 'nd-r-qa-1', title: 'Write test plans' },
                { id: 'nd-r-qa-2', title: 'Run regression tests' },
              ],
            },
            {
              id: 'nd-r-dep',
              title: 'Deployment & Rollout',
              children: [
                { id: 'nd-r-dep-1', title: 'Deploy to staging' },
                { id: 'nd-r-dep-2', title: 'Production rollout' },
              ],
            },
          ],
        },
      },
    ]
  ),

  // 2. Marketing Campaign Launch
  buildTemplateDetail(
    'tpl-mkt',
    'Marketing Campaign Launch',
    'Mẫu chiến dịch marketing: nghiên cứu thị trường, sản xuất nội dung sáng tạo, phân bổ ngân sách và triển khai đa kênh.',
    'Marketing',
    true,
    86,
    [
      {
        id: 'ph-mkt-1',
        name: 'Research',
        root: {
          id: 'nd-m1-0',
          title: 'Research',
          children: [
            {
              id: 'nd-m1-trk-1',
              title: 'Market Analysis',
              children: [
                { id: 'nd-m1-task-1', title: 'Competitor audit' },
                { id: 'nd-m1-task-2', title: 'Audience personas' },
              ],
            },
            {
              id: 'nd-m1-trk-2',
              title: 'Strategy',
              children: [
                { id: 'nd-m1-task-3', title: 'Define KPIs' },
                { id: 'nd-m1-task-4', title: 'Budget allocation' },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-mkt-2',
        name: 'Creative Production',
        root: {
          id: 'nd-m2-0',
          title: 'Creative Production',
          children: [
            {
              id: 'nd-m2-trk-1',
              title: 'Content Creation',
              children: [
                {
                  id: 'nd-m2-task-1',
                  title: 'Write copywriting',
                  children: [
                    { id: 'nd-m2-task-1-a', title: 'Landing page copy' },
                    { id: 'nd-m2-task-1-b', title: 'Email drip sequence' },
                  ],
                },
                { id: 'nd-m2-task-2', title: 'Produce video teaser' },
              ],
            },
            {
              id: 'nd-m2-trk-2',
              title: 'Design Assets',
              children: [
                { id: 'nd-m2-task-3', title: 'Brand graphic assets' },
                { id: 'nd-m2-task-4', title: 'Ad creatives banner' },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-mkt-3',
        name: 'Launch & Measure',
        root: {
          id: 'nd-m3-0',
          title: 'Launch & Measure',
          children: [
            {
              id: 'nd-m3-trk-1',
              title: 'Channels Distribution',
              children: [
                { id: 'nd-m3-task-1', title: 'Social media rollout' },
                { id: 'nd-m3-task-2', title: 'Paid ads PPC setup' },
              ],
            },
            {
              id: 'nd-m3-trk-2',
              title: 'Performance & Analytics',
              children: [
                { id: 'nd-m3-task-3', title: 'Weekly performance review' },
                { id: 'nd-m3-task-4', title: 'ROI optimization' },
              ],
            },
          ],
        },
      },
    ]
  ),

  // 3. Data Science / ETL Pipeline
  buildTemplateDetail(
    'tpl-etl',
    'Data Science / ETL Pipeline',
    'Quy trình thu thập, làm sạch, biến đổi dữ liệu, huấn luyện mô hình học máy và giám sát inference drift.',
    'DevOps & Infra',
    false,
    4,
    [
      {
        id: 'ph-etl-1',
        name: 'Ingestion',
        root: {
          id: 'nd-e1-0',
          title: 'Ingestion',
          children: [
            {
              id: 'nd-e1-trk-1',
              title: 'Data Sources',
              children: [
                { id: 'nd-e1-task-1', title: 'Connect transactional databases' },
                { id: 'nd-e1-task-2', title: 'Setup streaming API collectors' },
              ],
            },
            {
              id: 'nd-e1-trk-2',
              title: 'Data Lake Storage',
              children: [
                { id: 'nd-e1-task-3', title: 'Provision bronze raw buckets' },
                { id: 'nd-e1-task-4', title: 'Configure schema validation' },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-etl-2',
        name: 'Transformation',
        root: {
          id: 'nd-e2-0',
          title: 'Transformation',
          children: [
            {
              id: 'nd-e2-trk-1',
              title: 'Cleaning & Normalization',
              children: [
                { id: 'nd-e2-task-1', title: 'Remove duplicates & outliers' },
                { id: 'nd-e2-task-2', title: 'Impute missing values' },
              ],
            },
            {
              id: 'nd-e2-trk-2',
              title: 'Modeling & Training',
              children: [
                {
                  id: 'nd-e2-task-3',
                  title: 'Feature engineering',
                  children: [{ id: 'nd-e2-task-3-a', title: 'Encode categorical vectors' }],
                },
                { id: 'nd-e2-task-4', title: 'Train baseline ML model' },
              ],
            },
          ],
        },
      },
      {
        id: 'ph-etl-3',
        name: 'Serving',
        root: {
          id: 'nd-e3-0',
          title: 'Serving',
          children: [
            {
              id: 'nd-e3-trk-1',
              title: 'Deployment & Endpoint',
              children: [
                { id: 'nd-e3-task-1', title: 'Package model container (ONNX)' },
                { id: 'nd-e3-task-2', title: 'Expose inference REST/gRPC API' },
              ],
            },
            {
              id: 'nd-e3-trk-2',
              title: 'Monitoring & Drift',
              children: [
                { id: 'nd-e3-task-3', title: 'Setup data drift detection' },
                { id: 'nd-e3-task-4', title: 'Latency and throughput alerts' },
              ],
            },
          ],
        },
      },
    ]
  ),
];
