class SharedUploadQueue {
  private queue: File[] = []
  private listeners: (() => void)[] = []

  addFiles(files: File[]) {
    this.queue.push(...files)
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch (err) {
        console.error('Error in upload queue listener:', err)
      }
    })
  }

  getAndClear(): File[] {
    const files = [...this.queue]
    this.queue = []
    return files
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }
}

export const sharedUploadQueue = new SharedUploadQueue()
