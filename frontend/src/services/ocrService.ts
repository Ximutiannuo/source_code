import api from './api'

const API_URL = '/ocr'

export interface OcrTextBlock {
  text: string
  confidence: number
  box: number[][]
}

export interface OcrRecognizeResponse {
  blocks: OcrTextBlock[]
  full_text: string
}

export type OcrLang = 'ch' | 'en' | 'ru' | 'en_ru' | 'ch_ru'
export type OcrModelType = 'server' | 'mobile'

/** PP-StructureV3 文档解析结果 */
export interface OcrStructureResponse {
  markdown: string
  tables: string[][][]
}

/** 带边框表格识别结果：网格检测 + OCR 单元格分配 */
export interface OcrBorderedTableResponse {
  markdown: string
  tables: string[][][]
  merges: number[][]  // [r0, c0, r1, c1][]
  grid_detected: boolean
}

/** PDF 元素提取结果（仅电子版，不做 OCR） */
export interface OcrPdfExtractResponse {
  markdown: string
  tables: string[][][]
  page_count: number
  scanned_or_empty: boolean
}

export const ocrService = {
  /**
   * 图片文字识别（返回结构化结果）
   * @param noiseCheck 是否启用噪点检查（移除箭头、格式符号等），默认 true
   */
  recognize: async (
    file: File,
    lang: OcrLang = 'ch',
    modelType: OcrModelType = 'mobile',
    noiseCheck: boolean = true
  ): Promise<OcrRecognizeResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<OcrRecognizeResponse>(
      `${API_URL}/recognize`,
      formData,
      {
        params: { lang, format: 'blocks', model_type: modelType, noise_check: noiseCheck },
        timeout: 120000,
      }
    )
    return response.data
  },

  /**
   * PP-StructureV3 文档解析（含表格结构、合并单元格）
   */
  recognizeStructure: async (file: File): Promise<OcrStructureResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<OcrStructureResponse>(
      `${API_URL}/recognize/structure`,
      formData,
      { timeout: 120000 }
    )
    return response.data
  },

  /**
   * 带边框表格识别：形态学检测网格线 + OCR 单元格分配，格式完美匹配（含合并单元格）
   */
  recognizeBorderedTable: async (
    file: File,
    lang: OcrLang = 'ru'
  ): Promise<OcrBorderedTableResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<OcrBorderedTableResponse>(
      `${API_URL}/recognize/bordered-table`,
      formData,
      { params: { lang }, timeout: 120000 }
    )
    return response.data
  },

  /**
   * PDF 元素提取：仅抓取文本与表格，不做 OCR（仅电子版 PDF）
   */
  recognizePdfExtract: async (file: File): Promise<OcrPdfExtractResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<OcrPdfExtractResponse>(
      `${API_URL}/recognize/pdf-extract`,
      formData,
      { timeout: 60000 }
    )
    return response.data
  },

  /**
   * 仅获取纯文本
   */
  recognizeText: async (
    file: File,
    lang: OcrLang = 'ch'
  ): Promise<{ text: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ text: string }>(
      `${API_URL}/recognize/text`,
      formData,
      {
        params: { lang },
        timeout: 60000,
      }
    )
    return response.data
  },

  /**
   * 导出带边框表格为 XLSX
   * @param flatten 为 true 时不合并单元格，输出扁平表格，避免合并导致内容丢失
   */
  exportBorderedTableXlsx: async (
    tables: string[][][],
    merges: number[][] = [],
    flatten: boolean = false
  ): Promise<Blob> => {
    const response = await api.post(
      `${API_URL}/export/bordered-table-xlsx`,
      { tables, merges, flatten },
      { responseType: 'blob', timeout: 30000 }
    )
    return response.data as Blob
  },

  /**
   * 导出 OCR 结果为 Word（正文 + 所有表格）
   */
  exportDocx: async (
    markdown: string,
    tables: string[][][] = []
  ): Promise<Blob> => {
    const response = await api.post(
      `${API_URL}/export/docx`,
      { markdown, tables },
      { responseType: 'blob', timeout: 30000 }
    )
    return response.data as Blob
  },
}
