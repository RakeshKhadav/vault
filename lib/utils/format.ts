/**
 * Format a byte count (number, bigint, or numeric string) into a human-readable string.
 */
export function formatBytes(bytes: number | bigint | string, decimals = 2): string {
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : Number(bytes)
  if (isNaN(numBytes) || numBytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(numBytes) / Math.log(k))
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
