export class TelegramProvider {
  static async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ success: boolean; telegramFileId?: string; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      return { success: false, error: 'Telegram credentials missing in environment variables' }
    }

    try {
      const formData = new FormData()
      formData.append('chat_id', chatId)

      // Convert Buffer to Blob for native FormData appending
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType })
      formData.append('document', blob, fileName)

      const url = `https://api.telegram.org/bot${token}/sendDocument`
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorText = await res.text()
        return { success: false, error: `Telegram API error (${res.status}): ${errorText}` }
      }

      const responseData = await res.json()
      if (responseData.ok && responseData.result && responseData.result.document) {
        const fileId = responseData.result.document.file_id
        return { success: true, telegramFileId: fileId }
      } else {
        return { success: false, error: `Invalid Telegram API response: ${JSON.stringify(responseData)}` }
      }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }
}
