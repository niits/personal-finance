// Minimal `node:worker_threads` replacement for the vitest-pool-workers environment.
//
// The pre-built Next.js/OpenNext server bundle dynamically `require`s
// `node:worker_threads` (transitively, for Node crypto helpers), but the pool's
// workerd cannot resolve that builtin from the dynamically-required bundle (it
// works in real `wrangler dev`). The test request path never spawns real worker
// threads, so a stub reporting "main thread, no workers" is safe.

const workerThreads = {
  isMainThread: true,
  parentPort: null,
  workerData: null,
  threadId: 0,
  SHARE_ENV: Symbol("nodejs.worker_threads.SHARE_ENV"),
  resourceLimits: {},
  MessageChannel: class MessageChannel {},
  MessagePort: class MessagePort {},
  Worker: class Worker {},
  markAsUntransferable: () => {},
  moveMessagePortToContext: () => {},
  receiveMessageOnPort: () => undefined,
};

module.exports = workerThreads;
module.exports.default = workerThreads;
