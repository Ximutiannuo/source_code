import api from './api'

export interface ProcessTemplate {
  id: number
  facility_type_id?: number | null
  facility_id?: number | null
  work_package?: string | null
  name: string
  applicable_qty_min?: number | null
  applicable_qty_max?: number | null
  min_required_workers?: number | null
  max_allowed_workers?: number | null
  suggested_min_days?: number | null
  suggested_max_days?: number | null
}

export interface ProcessTemplateCreate {
  facility_type_id?: number | null
  facility_id?: number | null
  work_package?: string | null
  name: string
  applicable_qty_min?: number | null
  applicable_qty_max?: number | null
  min_required_workers?: number | null
  max_allowed_workers?: number | null
  suggested_min_days?: number | null
  suggested_max_days?: number | null
}

export interface ActivityByFacilityItem {
  activity_id: string
  title?: string | null
  work_package?: string | null
  block?: string | null
  unit?: string | null
  discipline?: string | null
}

export interface TemplateActivityLink {
  id: number
  template_id: number
  predecessor_activity_id: string
  successor_activity_id: string
  link_type: string
  lag_days: number
  sort_order: number
}

export interface TemplateActivityLinkCreate {
  predecessor_activity_id: string
  successor_activity_id: string
  link_type?: string
  lag_days?: number
  sort_order?: number
}

export interface AdaptRequest {
  facility_id: number
  max_workers?: number | null
  work_package?: string | null
  work_package_estimated_qty?: number | null
  write_back?: boolean
}

export interface AdaptResult {
  facility_id: number
  work_package?: string
  estimated_qty?: number
  max_workers_used?: number
  matched_template_id?: number
  adjusted_template_name?: string | null
  adjusted_total_days?: number | null
  activity_links?: Array<{
    predecessor_activity_id: string
    successor_activity_id: string
    link_type: string
    lag_days: number
  }>
  activity_ids?: string[]
  message?: string
  write_back_updated_count?: number
  error?: string
}

const BASE = '/process-template'

export const processTemplateService = {
  listTemplates(params?: { facility_type_id?: number; facility_id?: number; work_package?: string }) {
    return api.get<ProcessTemplate[]>(`${BASE}/templates`, { params })
  },

  createTemplate(body: ProcessTemplateCreate) {
    return api.post<ProcessTemplate>(`${BASE}/templates`, body)
  },

  listTemplatesByWorkPackage(workPackage: string) {
    return api.get<ProcessTemplate[]>(`${BASE}/templates`, {
      params: { work_package: workPackage },
    })
  },

  listTemplatesByFacility(facilityId: number) {
    return api.get<ProcessTemplate[]>(`${BASE}/templates`, {
      params: { facility_id: facilityId },
    })
  },

  listTemplatesByFacilityType(facilityTypeId: number) {
    return api.get<ProcessTemplate[]>(`${BASE}/templates`, {
      params: { facility_type_id: facilityTypeId },
    })
  },

  getActivitiesByFacility(facilityId: number) {
    return api.get<ActivityByFacilityItem[]>(`${BASE}/activities-by-facility`, {
      params: { facility_id: facilityId },
    })
  },

  getTemplate(templateId: number) {
    return api.get<ProcessTemplate>(`${BASE}/templates/${templateId}`)
  },

  updateTemplate(templateId: number, body: Partial<ProcessTemplateCreate>) {
    return api.put<ProcessTemplate>(`${BASE}/templates/${templateId}`, body)
  },

  deleteTemplate(templateId: number) {
    return api.delete(`${BASE}/templates/${templateId}`)
  },

  createTemplateActivityLinks(templateId: number, links: TemplateActivityLinkCreate[]) {
    return api.post<TemplateActivityLink[]>(`${BASE}/templates/${templateId}/activity-links`, {
      links,
    })
  },

  listTemplateActivityLinks(templateId: number) {
    return api.get<TemplateActivityLink[]>(`${BASE}/templates/${templateId}/activity-links`)
  },

  deleteTemplateActivityLink(templateId: number, linkId: number) {
    return api.delete(`${BASE}/templates/${templateId}/activity-links/${linkId}`)
  },

  adapt(body: AdaptRequest) {
    return api.post<AdaptResult>(`${BASE}/adapt`, body)
  },

  listTemplateActivities(templateId: number) {
    return api.get<TemplateActivity[]>(`${BASE}/templates/${templateId}/activities`)
  },

  initTemplateFromWorkPackages(templateId: number) {
    return api.post<TemplateActivity[]>(`${BASE}/templates/${templateId}/activities/init-from-work-packages`)
  },

  updateTemplateActivity(
    templateId: number,
    activityId: number,
    body: { planned_duration?: number; standard_hours?: number; setup_hours?: number }
  ) {
    return api.patch<TemplateActivity>(`${BASE}/templates/${templateId}/activities/${activityId}`, null, {
      params: body,
    })
  },

  recalcTemplateDates(templateId: number) {
    return api.get<{ dates_by_activity_key: Record<string, { start_day: number; end_day: number; start_date_iso: string; end_date_iso: string }> }>(
      `${BASE}/templates/${templateId}/recalc-dates`
    )
  },

  generateRelationTable(body: { facility_type_id?: number; facility_ids?: number[] }) {
    return api.post<{ relation_table: Array<{ predecessor_activity_id: string; successor_activity_id: string; link_type: string; lag_days: number; facility_id?: number }> }>(
      `${BASE}/generate-relation-table`,
      body
    )
  },
}

export interface TemplateActivity {
  id: number
  template_id: number
  activity_key: string
  label?: string | null
  planned_duration?: number | null
  standard_hours?: number | null
  setup_hours?: number | null
  sort_order: number
}
