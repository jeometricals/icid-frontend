// NYC DOT's Pedestrian Ramp Inspection Form (version 1.6), as the backend stores it (migration 047): a corner's
// choices and fields (sections 1-3) and a ramp's (section 5), with the form's words for each

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }))

export const ENTITIES = options([['dob', 'DOB'], ['other', 'Other']])
export const TRAFFIC_CONTROLS = options([
  ['signal', 'Signal'], ['signal_aps', 'Signal with APS'], ['stop_yield', 'Stop / yield'], ['none', 'None'],
])
export const CORNER_TYPES = options([
  ['intersection_corner', 'Intersection corner'], ['island_median', 'Island / median'], ['mid_block', 'Mid-block'],
  ['top_of_t', 'Top of "T"'],
])
export const CORNER_DIRECTIONS = options(['SW', 'NW', 'NE', 'SE', 'N', 'S', 'E', 'W'].map(value => [value, value]))
export const CONTRACT_TYPES = options([['simple', 'Simple'], ['complex', 'Complex']])
export const CURB_MATERIALS = options([
  ['steel_faced', 'Steel faced'], ['concrete', 'Concrete'], ['concrete_and_gutter', 'Concrete and gutter'],
  ['granite', 'Granite'], ['bluestone', 'Bluestone'], ['cobblestone', 'Cobblestone'], ['other', 'Other'],
])
export const SIDEWALK_MATERIALS = options([
  ['concrete', 'Concrete'], ['pigmented_concrete', 'Pigmented concrete'], ['bluestone', 'Bluestone'],
  ['cobblestone', 'Cobblestone'], ['other', 'Other'],
])
export const YES_NO_NA = options([['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']])
export const DWS_COLORS = options([['red', 'Red'], ['white', 'White'], ['yellow', 'Yellow'], ['other', 'Other']])
export const DWS_MATERIALS = options([
  ['preformed_plastic', 'Preformed plastic'], ['cast_in_place_plastic', 'Cast-in-place plastic'],
  ['cast_iron', 'Cast iron'], ['stone', 'Stone'], ['other', 'Other'],
])
export const CONSTRUCTIONS = options([
  ['existing_ramp', 'Existing ramp'], ['ramp_removed', 'Ramp removed'], ['new_install', 'New install'],
  ['upgrade', 'Upgrade'],
])
export const ACTIONS_TAKEN = options([
  ['ada_compliant_constructed', 'ADA compliant ramp constructed'],
  ['max_extent_feasible', 'Constructed to the maximum extent feasible'],
  ['ada_compliant_exists', 'ADA compliant ramp exists'], ['ramp_removed', 'Ramp removed'], ['other', 'Other'],
])

// A corner's fields by the form's section: [key, label, type, options or max length]. type is 'text', 'date',
// 'select', 'yesno', 'number' or 'textarea'
export const CORNER_SECTIONS = [
  {
    title: '1. Inspection information',
    fields: [
      ['inspected_by', 'Inspected by', 'text', 200], ['inspection_date', 'Inspection date', 'date'],
      ['entity', 'Entity', 'select', ENTITIES], ['entity_if_other', 'Entity (if other)', 'text', 200],
    ],
  },
  {
    title: '2. Location information',
    fields: [
      ['boro', 'Borough', 'boro'], ['dot_corner_id', 'Corner ID', 'text', 50],
      ['north_south_street', 'North-south street', 'text', 200], ['east_west_street', 'East-west street', 'text', 200],
      ['traffic_control_ns', 'Traffic control (north-south)', 'select', TRAFFIC_CONTROLS],
      ['traffic_control_ew', 'Traffic control (east-west)', 'select', TRAFFIC_CONTROLS],
      ['corner_type', 'Corner type', 'select', CORNER_TYPES],
      ['corner_direction', 'Corner direction', 'select', CORNER_DIRECTIONS],
      ['corner_number', 'Corner No.', 'text', 50], ['number_of_ramps', 'Number of ramps at corner', 'ramps'],
      ['t_intersection', 'T-intersection', 'yesno'], ['painted_roadway', 'Painted roadway', 'yesno'],
    ],
  },
  {
    title: '3. Construction information',
    fields: [
      ['contractor_name', 'Contractor name', 'text', 200], ['permittee_id', 'Permittee ID', 'text', 100],
      ['fms_id', 'FMS ID', 'text', 100], ['permit_number', 'Permit number', 'text', 100],
      ['construction_completion_date', 'Construction completion date', 'date'],
      ['contract_type', 'Contract type', 'select', CONTRACT_TYPES],
      ['curb_material', 'Curb material', 'select', CURB_MATERIALS],
      ['sidewalk_material', 'Sidewalk material', 'select', SIDEWALK_MATERIALS],
    ],
  },
]
export const CORNER_COMMENTS_MAX = 2000
export const CORNER_REQUIRED = ['boro', 'north_south_street', 'east_west_street']

// A ramp's fields: [key, label, type, options]; type is 'text', 'yesno', 'select', 'pct' (a slope, %) or 'in'
// (inches). The answers first, as the form has them, then the measurements of each ramp type
const COMMON_ANSWERS = [
  ['ramp_id_label', 'Ramp ID', 'text'], ['is_there_ponding', 'Is there ponding', 'yesno'],
  ['maximum_curb_reveal_at_ramp_in', 'Maximum curb reveal at ramp', 'in'],
]
const DWS_ANSWERS = [
  ['dws_length_min_24_inch', 'DWS length min. 24 inch', 'yesno'], ['dws_full_ramp_width', 'DWS full ramp width', 'yesno'],
]
const DWS_DETAILS = [
  ['dws_left_offset_from_curb_in', 'DWS left offset from curb', 'in'],
  ['dws_right_offset_from_curb_in', 'DWS right offset from curb', 'in'],
  ['dws_color', 'DWS color', 'select', DWS_COLORS], ['dws_material', 'DWS material', 'select', DWS_MATERIALS],
  ['construction', 'Construction', 'select', CONSTRUCTIONS], ['action_taken', 'Action taken', 'select', ACTIONS_TAKEN],
]
const ALIGNED = ['dws_aligned_with_ramp', 'DWS aligned with ramp', 'select', YES_NO_NA]
const CLEAR_SPACE = ['clear_space_within_crosswalk', 'Clear space within crosswalk', 'yesno']
const GUTTER = [['gutter_cross_slope_pct', 'Gutter cross slope', 'pct'], ['gutter_flow_slope_pct', 'Gutter flow slope', 'pct']]

export const RAMP_FIELDS = {
  PERPENDICULAR: {
    answers: [
      ...COMMON_ANSWERS,
      ['left_flare_traversable_path', 'Left flare in traversable path', 'yesno'],
      ['right_flare_traversable_path', 'Right flare in traversable path', 'yesno'],
      CLEAR_SPACE, ['outside_of_parallel_travel_lane', 'Outside of parallel travel lane', 'yesno'],
      ...DWS_ANSWERS, ALIGNED, ...DWS_DETAILS,
    ],
    measurements: [
      ['ramp_running_slope_pct', 'Ramp running slope', 'pct'], ['ramp_cross_slope_pct', 'Ramp cross slope', 'pct'],
      ['ramp_length_in', 'Ramp length', 'in'], ['ramp_width_in', 'Ramp width', 'in'],
      ['landing_running_slope_pct', 'Landing running slope', 'pct'],
      ['landing_cross_slope_pct', 'Landing cross slope', 'pct'], ['landing_length_in', 'Landing length', 'in'],
      ['landing_width_in', 'Landing width', 'in'], ['left_flare_slope_pct', 'Left flare slope', 'pct'],
      ['right_flare_slope_pct', 'Right flare slope', 'pct'], ...GUTTER,
      ['left_sidewalk_approach_width_in', 'Left sidewalk approach width', 'in'],
      ['left_sidewalk_running_slope_pct', 'Left sidewalk running slope', 'pct'],
      ['left_sidewalk_cross_slope_pct', 'Left sidewalk cross slope', 'pct'],
      ['right_sidewalk_approach_width_in', 'Right sidewalk approach width', 'in'],
      ['right_sidewalk_running_slope_pct', 'Right sidewalk running slope', 'pct'],
      ['right_sidewalk_cross_slope_pct', 'Right sidewalk cross slope', 'pct'],
    ],
  },
  PARALLEL: {
    answers: [...COMMON_ANSWERS, CLEAR_SPACE, ...DWS_ANSWERS, ALIGNED, ...DWS_DETAILS],
    measurements: [
      ['bottom_landing_running_slope_pct', 'Bottom landing running slope', 'pct'],
      ['bottom_landing_cross_slope_pct', 'Bottom landing cross slope', 'pct'],
      ['bottom_landing_length_in', 'Bottom landing length', 'in'],
      ['bottom_landing_width_in', 'Bottom landing width', 'in'],
      ['left_ramp_running_slope_pct', 'Left ramp running slope', 'pct'],
      ['left_ramp_cross_slope_pct', 'Left ramp cross slope', 'pct'], ['left_ramp_length_in', 'Left ramp length', 'in'],
      ['left_ramp_width_in', 'Left ramp width', 'in'],
      ['right_ramp_running_slope_pct', 'Right ramp running slope', 'pct'],
      ['right_ramp_cross_slope_pct', 'Right ramp cross slope', 'pct'],
      ['right_ramp_length_in', 'Right ramp length', 'in'], ['right_ramp_width_in', 'Right ramp width', 'in'],
      ...GUTTER,
    ],
  },
  CUT_THROUGH: {
    answers: [...COMMON_ANSWERS, ...DWS_ANSWERS, ...DWS_DETAILS],
    measurements: [
      ['ramp_running_slope_pct', 'Ramp running slope', 'pct'], ['ramp_cross_slope_pct', 'Ramp cross slope', 'pct'],
      ['ramp_width_in', 'Ramp width', 'in'], ...GUTTER, ['cut_through_length_in', 'Cut-through length', 'in'],
      ['min_clearance_between_dws_in', 'Min. clearance between DWS', 'in'],
    ],
  },
}
export const RAMP_COMMENTS_MAX = 2000

/** A ramp type's fields, answers then measurements, then comments: the keys a save sends. */
export const rampKeys = (rampType) => [
  ...RAMP_FIELDS[rampType].answers, ...RAMP_FIELDS[rampType].measurements,
].map(([key]) => key).concat('comments')
