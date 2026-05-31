export async function register() {
  // Ensure background tasks only run in the Node.js server environment, not in Edge or builds
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkers } = await import('./lib/jobs/worker-loader')
    startWorkers()
  }
}
