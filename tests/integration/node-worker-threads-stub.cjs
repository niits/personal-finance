// Next.js imports node:worker_threads while booting its server bundle. Route
// handlers under test do not spawn workers, but workerd cannot resolve this
// builtin from the prebuilt handler, so provide the import shape it needs.
module.exports = {
  isMainThread: true,
  parentPort: null,
  workerData: null,
  threadId: 0,
  Worker: class Worker {},
  MessageChannel: class MessageChannel {},
  MessagePort: class MessagePort {},
};
