import api from './api'

export interface FacilityType {
  id: number
  name: string
  sort_order: number
}

export interface FacilityTypeCreate {
  name: string
  sort_order?: number
}

const BASE = '/facility-type'

export const facilityTypeService = {
  list() {
    return api.get<FacilityType[]>(BASE + '/')
  },
  create(body: FacilityTypeCreate) {
    return api.post<FacilityType>(BASE + '/', body)
  },
  get(id: number) {
    return api.get<FacilityType>(`${BASE}/${id}`)
  },
  update(id: number, body: Partial<FacilityTypeCreate>) {
    return api.put<FacilityType>(`${BASE}/${id}`, body)
  },
  delete(id: number) {
    return api.delete(`${BASE}/${id}`)
  },
}
