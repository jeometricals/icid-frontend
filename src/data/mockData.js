// Mock project data - centralized source of truth
// In production, this would come from Supabase

export const PROJECTS = {
  'HWS0023': {
    contractNo: 'HWS0023',
    regNo: '2024123457',
    description: 'Installation of Curb, Sidewalk and Ped-Ramp Various locations',
    borough: 'Queens',
    contractor: 'Benny Bowers Contracting Co.'
  },
  'SE384': {
    contractNo: 'SE384',
    regNo: '2024198765',
    description: 'Sewer System Rehabilitation',
    borough: 'Brooklyn',
    contractor: 'Empire Sewer Works Inc.'
  },
  'WMB092': {
    contractNo: 'WMB092',
    regNo: '2024156789',
    description: 'Water Main Replacement Project',
    borough: 'Manhattan',
    contractor: 'Metropolitan Water Solutions'
  }
}

// Legacy standalone report pages. General is no longer here: it lives inside an IDR (see data/reportTypes.js).
export const REPORT_TYPES = [
  {
    id: 'daily-patrol',
    title: 'Daily Site Patrol',
    description: 'Maintenance and Safety Checklist',
    path: '/report/daily-patrol'
  },
  {
    id: 'curb-sidewalk',
    title: 'Curb, Sidewalk, Concrete Base & Pedestrian Ramp',
    description: 'Infrastructure Installation Report',
    path: '/report/curb-sidewalk'
  }
]
