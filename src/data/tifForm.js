// NYC DOT's Pedestrian Ramp Technical Infeasibility Form (version 1.9), as the backend stores it (migration 049): its
// sections 1-7 by the form's own order and words. Each field is [key, label, type, options or max length]; type is
// 'text', 'date', 'select', 'check' (a tick box) or 'textarea'. Section 3's borough, streets and corner come from the
// corner; section 10 (the RE's signature) is the approval's; DOT's "for internal use only" block is never filled.

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }))

export const PROJECT_CATEGORIES = options([
  ['city_agency', 'City agency'], ['state_agency', 'State agency'], ['transit_authority', 'Transit authority'],
  ['other', 'Other'],
])
export const RAMP_CONSTRUCTIONS = options([['new_installation', 'New installation'], ['upgrade', 'Upgrade']])

export const TIF_SECTIONS = [
  {
    id: 'submission',
    title: '1. Submission information',
    fields: [
      ['submitted_by', 'Submitted by', 'text', 200], ['submission_date', 'Submission date', 'date'],
      ['application_tracking_no', 'Application tracking No.', 'text', 100], ['sequence_no', 'Sequence No.', 'text', 100],
      ['permittee_name', 'Permittee name', 'text', 200], ['permittee_id', 'Permittee ID', 'text', 100],
      ['business_name', 'Business name', 'text', 200], ['street_address', 'Street address', 'text', 200],
      ['city', 'City', 'text', 100], ['state', 'State', 'text', 50], ['zip_code', 'ZIP code', 'text', 20],
      ['email', 'E-mail', 'text', 200], ['phone', 'Phone', 'text', 50],
    ],
  },
  {
    id: 'project',
    title: '2. Project information',
    fields: [
      ['project_category', 'Category', 'select', PROJECT_CATEGORIES],
      ['project_category_name', 'Agency or entity name', 'text', 200],
      ['dot_project_id', 'Project ID', 'text', 100], ['type_of_project', 'Type of project', 'text', 200],
    ],
  },
  {
    id: 'location',
    title: '3. Location information',
    fields: [
      ['dot_corner_id', 'Corner ID', 'text', 50], ['dot_ramp_id', 'Ramp ID', 'text', 50],
      ['ramp_construction', 'Ramp construction', 'select', RAMP_CONSTRUCTIONS],
    ],
  },
  {
    id: 'reasons',
    title: '4. Explanation for technical infeasibility (check all that apply)',
    fields: [
      ['reason_limited_row', 'Limited right-of-way', 'check'],
      ['reason_existing_topography', 'Existing topography', 'check'],
      ['reason_existing_utilities', 'Existing utilities', 'check'],
      ['reason_structures', 'Structures, buildings, vaults, bridges', 'check'],
      ['reason_trees_natural', 'Trees, natural features', 'check'],
      ['reason_nyct_structures', 'NYCT – structures, entrances, vents', 'check'],
      ['reason_historic_features', 'Historic features', 'check'], ['reason_other', 'Other', 'check'],
      ['reason_other_text', 'Other (explain)', 'text', 500],
    ],
  },
  {
    id: 'why',
    title: '5. Why requirements cannot be achieved',
    fields: [['why_requirements_cannot_be_achieved', 'Explanation', 'textarea', 4000]],
  },
  {
    id: 'elements',
    title: '6. Ramp elements that do not meet the minimum ADA standards (check all that apply)',
    fields: [
      ['element_ramp_width', 'Ramp width', 'check'], ['element_running_slope', 'Ramp running slope', 'check'],
      ['element_cross_slope', 'Ramp cross slope', 'check'], ['element_flare_slopes', 'Flare slopes', 'check'],
      ['element_dws', 'Detectable warning surface', 'check'],
      ['element_landing_dimensions', 'Landing dimensions', 'check'], ['element_landing_slopes', 'Landing slopes', 'check'],
      ['element_gutter_cross_slope', 'Gutter cross slope', 'check'],
      ['element_gutter_flow_slope', 'Gutter flow slope', 'check'], ['element_other', 'Other', 'check'],
      ['element_other_text', 'Other (explain)', 'text', 500],
    ],
  },
  {
    id: 'investigation',
    title: '7. Investigation',
    fields: [
      ['investigation_confirmed', 'All design solutions, including NYC DOT H-1011, NYSDOT 608-01 and PROWAG, have been considered and a technical infeasibility form is still required.', 'check'],
      ['additional_explanation', 'Additional explanation', 'textarea', 4000],
    ],
  },
]

/** Every field's [key, label, type, extra], across the sections. */
export const TIF_FIELDS = TIF_SECTIONS.flatMap(section => section.fields)
