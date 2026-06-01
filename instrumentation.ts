export async function register() {
  // Ensure background tasks only run in the Node.js server environment, not in Edge or builds
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('dns')
    dns.setDefaultResultOrder('ipv4first')

    const { startWorkers } = await import('./lib/jobs/worker-loader')
    startWorkers()
  }
}
