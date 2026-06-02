// Minimal `node:os` replacement for the vitest-pool-workers environment.
//
// The pre-built Next.js server bundle (next/dist/server/config-shared.js) pulls
// in `node:os` via CommonJS `require`, but the pool's workerd cannot resolve that
// builtin from the dynamically-required bundle (it works in real `wrangler dev`).
// Aliasing `node:os` to this CJS stub lets Vite bundle a working module in its
// place. The test request path never depends on real host values.

const os = {
  EOL: "\n",
  platform: () => "linux",
  arch: () => "x64",
  type: () => "Linux",
  release: () => "0.0.0",
  hostname: () => "localhost",
  tmpdir: () => "/tmp",
  homedir: () => "/",
  endianness: () => "LE",
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  loadavg: () => [0, 0, 0],
  uptime: () => 0,
  availableParallelism: () => 1,
  networkInterfaces: () => ({}),
  userInfo: () => ({ username: "", uid: -1, gid: -1, shell: null, homedir: "/" }),
  constants: {},
};

module.exports = os;
module.exports.default = os;
