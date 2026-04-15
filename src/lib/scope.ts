export type ScopeStarterKind = 'text' | 'number' | 'select' | 'multiline'
export type ScopeStarterSection = 'project' | 'layout' | 'features'

export type ScopeStarterDefinition = {
  scope_type: string
  label: string
  kind: ScopeStarterKind
  section: ScopeStarterSection
  sort_order: number
  options?: string[]
  placeholder?: string
  helpText?: string
}

export const SCOPE_STARTER_DEFINITIONS: ScopeStarterDefinition[] = [
  {
    scope_type: 'job_type',
    label: 'Job Type',
    kind: 'select',
    section: 'project',
    sort_order: 10,
    options: ['Custom Home', 'Spec Home', 'Addition', 'Renovation', 'Remodel', 'Other'],
    helpText: 'High-level project type only. Keep it broad and editable.',
  },
  {
    scope_type: 'project_category',
    label: 'Project Category',
    kind: 'select',
    section: 'project',
    sort_order: 20,
    options: ['Residential', 'Light Commercial', 'Mixed Scope', 'Other'],
    helpText: 'Useful later for filtering and downstream planning.',
  },
  {
    scope_type: 'construction_type',
    label: 'Construction Type',
    kind: 'select',
    section: 'project',
    sort_order: 30,
    options: ['Ground Up', 'Interior Renovation', 'Addition', 'Renovation + Addition', 'Finish-Out', 'Other'],
    helpText: 'Do not enter trade-by-trade details here.',
  },
  {
    scope_type: 'bedroom_count',
    label: 'Bedrooms',
    kind: 'number',
    section: 'layout',
    sort_order: 40,
    placeholder: '4',
    helpText: 'Whole-number target count only.',
  },
  {
    scope_type: 'bathroom_count',
    label: 'Bathrooms',
    kind: 'number',
    section: 'layout',
    sort_order: 50,
    placeholder: '3.5',
    helpText: 'Use the planned bathroom count, not fixture quantity takeoff.',
  },
  {
    scope_type: 'stories',
    label: 'Stories',
    kind: 'select',
    section: 'layout',
    sort_order: 60,
    options: ['1', '1.5', '2', '3', 'Split-Level', 'Other'],
    helpText: 'Broad vertical layout only.',
  },
  {
    scope_type: 'garage_stalls',
    label: 'Garage Stalls',
    kind: 'number',
    section: 'layout',
    sort_order: 70,
    placeholder: '3',
    helpText: 'Use stall count, not garage square footage.',
  },
  {
    scope_type: 'basement_type',
    label: 'Basement Type',
    kind: 'select',
    section: 'features',
    sort_order: 80,
    options: ['None', 'Unfinished Basement', 'Finished Basement', 'Walkout Basement', 'Partial Basement', 'Other'],
    helpText: 'High-level basement intent only.',
  },
  {
    scope_type: 'outdoor_living',
    label: 'Outdoor Living',
    kind: 'text',
    section: 'features',
    sort_order: 90,
    placeholder: 'Covered porch, screened porch, patio, deck',
    helpText: 'List the major outdoor living components at a high level.',
  },
  {
    scope_type: 'special_features',
    label: 'Special Features',
    kind: 'multiline',
    section: 'features',
    sort_order: 100,
    placeholder: 'Elevator, golf simulator, safe room, wine wall, etc.',
    helpText: 'Capture unusual features that should affect takeoff later.',
  },
  {
    scope_type: 'scope_summary',
    label: 'Scope Summary',
    kind: 'multiline',
    section: 'features',
    sort_order: 110,
    placeholder: 'Plain-language scope summary for the job.',
    helpText: 'Short narrative summary only. Do not turn this into a spec book.',
  },
]

export const STARTER_SCOPE_TYPES = new Set(
  SCOPE_STARTER_DEFINITIONS.map((definition) => definition.scope_type)
)

export function isStarterScopeType(scopeType: string | null | undefined) {
  return !!scopeType && STARTER_SCOPE_TYPES.has(scopeType)
}

export function buildDefaultScopeItems(jobId: string) {
  return SCOPE_STARTER_DEFINITIONS.map((definition) => ({
    job_id: jobId,
    scope_type: definition.scope_type,
    label: definition.label,
    value_text: null,
    value_number: null,
    notes: null,
    sort_order: definition.sort_order,
  }))
}
