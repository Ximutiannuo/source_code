/**
 * 图片压缩工具
 * 将图片压缩到 1080p (1920x1080) 及以下，并控制文件大小
 */

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const JPEG_QUALITY = 0.85

export interface CompressResult {
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

/**
 * 压缩图片到 1080p 及以下，输出 JPEG
 */
export async function compressImage(
  file: File,
  maxWidth: number = MAX_WIDTH,
  maxHeight: number = MAX_HEIGHT,
  maxSizeBytes: number = MAX_SIZE_BYTES,
  quality: number = JPEG_QUALITY
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas 上下文'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const tryCompress = (q: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'))
              return
            }
            if (blob.size > maxSizeBytes && q > 0.3) {
              tryCompress(q - 0.1)
            } else {
              resolve({
                blob,
                width,
                height,
                originalSize: file.size,
                compressedSize: blob.size,
              })
            }
          },
          'image/jpeg',
          q
        )
      }
      tryCompress(quality)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export const MAX_FILE_SIZE = MAX_SIZE_BYTES
export const MAX_FILE_SIZE_MB = 5
