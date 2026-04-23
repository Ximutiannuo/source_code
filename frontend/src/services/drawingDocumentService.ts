import api from './api'

export interface DrawingDocumentMaterial {
  id: number
  code: string
  name: string
  drawing_no?: string | null
}

export interface DrawingDocumentBomHeader {
  id: number
  product_code: string
  version: string
  bom_type?: string | null
  cad_document_no?: string | null
}

export interface DrawingDocument {
  id: number
  document_number: string
  document_name: string
  document_type: string
  source_type: string
  status: string
  version?: string | null
  revision?: string | null
  discipline?: string | null
  cad_software?: string | null
  tags?: string | null
  description?: string | null
  product_code?: string | null
  material_id?: number | null
  material_code?: string | null
  bom_header_id?: number | null
  file_name: string
  file_ext?: string | null
  mime_type?: string | null
  file_size: number
  source_relative_path?: string | null
  ocr_status?: string | null
  ocr_text?: string | null
  uploader_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  download_url: string
  material?: DrawingDocumentMaterial | null
  bom_header?: DrawingDocumentBomHeader | null
}

export interface DrawingDocumentQuery {
  skip?: number
  limit?: number
  search?: string
  document_type?: string
  source_type?: string
  material_code?: string
  product_code?: string
  bom_header_id?: number
}

export interface DrawingDocumentUploadPayload {
  document_number: string
  document_name: string
  document_type: string
  source_type: string
  status: string
  version?: string
  revision?: string
  discipline?: string
  cad_software?: string
  tags?: string
  description?: string
  product_code?: string
  material_code?: string
  bom_header_id?: number
  source_relative_path?: string
  ocr_status?: string
  ocr_text?: string
}

export interface DrawingBatchImportPayload {
  source_type?: string
  status?: string
  version?: string
  revision?: string
  discipline?: string
  cad_software?: string
  tags?: string
  description?: string
  product_code?: string
  material_code?: string
  bom_header_id?: number
  replace_existing?: boolean
}

export interface DrawingBatchImportItem {
  file_name: string
  relative_path?: string | null
  document_number?: string | null
  action: 'imported' | 'replaced' | 'skipped'
  message: string
  validation_status: string
  document?: DrawingDocument | null
}

export interface DrawingBatchImportResult {
  total: number
  imported: number
  replaced: number
  skipped: number
  results: DrawingBatchImportItem[]
}

type FileWithRelativePath = File & { webkitRelativePath?: string }

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const drawingDocumentService = {
  listDocuments: async (params?: DrawingDocumentQuery) => {
    const response = await api.get<DrawingDocument[]>('/plm/drawings', { params })
    return response.data
  },

  uploadDocument: async (payload: DrawingDocumentUploadPayload, file: File) => {
    const formData = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value))
      }
    })
    formData.append('file', file)
    const response = await api.post<DrawingDocument>('/plm/drawings/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  batchImportDocuments: async (payload: DrawingBatchImportPayload, files: File[]) => {
    const formData = new FormData()
    const relativePaths: string[] = []

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value))
      }
    })

    files.forEach(file => {
      const relativePath = (file as FileWithRelativePath).webkitRelativePath || file.name
      relativePaths.push(relativePath)
      formData.append('files', file)
    })
    formData.append('relative_paths_json', JSON.stringify(relativePaths))

    const response = await api.post<DrawingBatchImportResult>('/plm/drawings/batch-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getDocument: async (documentId: number) => {
    const response = await api.get<DrawingDocument>(`/plm/drawings/${documentId}`)
    return response.data
  },

  getDrawingsByBOM: async (bomId: number) => {
    const response = await api.get<DrawingDocument[]>(`/plm/drawings/by-bom/${bomId}`)
    return response.data
  },

  downloadDocument: async (document: Pick<DrawingDocument, 'id' | 'file_name' | 'document_number'>) => {
    const response = await api.get(`/plm/drawings/${document.id}/download`, {
      responseType: 'blob',
    })
    triggerDownload(response.data as Blob, document.file_name || `${document.document_number}.bin`)
  },
}
