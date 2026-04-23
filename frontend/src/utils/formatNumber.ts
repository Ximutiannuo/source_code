/**
 * 格式化 manpower/machinery/achieved 数值 (流水账模式)
 * - 保持高精度，避免 JavaScript 浮点数精度丢失
 * - 去除尾随的 0（整数不显示小数点）
 * - 0 始终显示为 "0"
 * 用于 VFACTDB/MPDB 流水账页面
 */
export const formatHighPrecisionValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0'
  
  // 转换为字符串进行处理，避免精度丢失
  const strValue = String(value).trim()
  
  // 检查是否为有效的数字格式
  if (!/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(strValue)) {
    return strValue
  }

  // 处理科学计数法 (如 0E-20)
  if (strValue.toLowerCase().includes('e')) {
    const numValue = Number(strValue)
    if (isNaN(numValue)) return '0'
    if (numValue === 0) return '0'
    // 对于非零值，转为固定小数位并去除末尾 0
    const fixed = numValue.toFixed(20)
    return fixed.replace(/\.?0+$/, '')
  }

  // 如果包含小数点，去除末尾无用的 0 和小数点
  if (strValue.includes('.')) {
    return strValue.replace(/0+$/, '').replace(/\.$/, '')
  }
  
  // 如果是 "000" 这种格式，转为 "0"
  if (/^0+$/.test(strValue)) return '0'
  
  return strValue
}

/**
 * 格式化数值为标准显示格式 (固定小数位)
 * 用于非流水账页面，如 ActivityListAdvanced, DailyReportManagement 等
 * @param value 要格式化的值
 * @param decimals 小数位数，默认为 3
 * @param emptyValue 当值为 null/undefined/'' 时的返回值，默认为 '0.000'
 * @param useGrouping 是否使用千位分隔符，默认为 false
 */
export const formatQuantity = (
  value: string | number | null | undefined, 
  decimals: number = 3, 
  emptyValue?: string,
  useGrouping: boolean = false
): string => {
  const defaultEmpty = decimals > 0 ? '0.' + '0'.repeat(decimals) : '0'
  const finalEmpty = emptyValue !== undefined ? emptyValue : defaultEmpty

  if (value === null || value === undefined || value === '') {
    return finalEmpty
  }

  const strValue = String(value).trim()
  
  // 检查是否为有效的数字格式
  if (!/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(strValue)) {
    return strValue
  }

  const num = Number(strValue)
  if (isNaN(num)) return strValue
  
  if (useGrouping) {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }
  
  return num.toFixed(decimals)
}

/**
 * 兼容旧代码的格式化函数
 */
export const formatManpowerValue = formatHighPrecisionValue;
