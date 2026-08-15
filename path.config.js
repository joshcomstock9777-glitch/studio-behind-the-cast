// path.config.js
// Moonshadow Studio — Firebase + Cloudflare Workers Configuration

// ─── Firebase ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCcLtr8Ci2HKa-c9E-Ky2-XZoiUjNmF0ik",
  authDomain: "moonshadow-wake-relay-poc.firebaseapp.com",
  databaseURL: "https://moonshadow-wake-relay-poc-default-rtdb.firebaseio.com",
  projectId: "moonshadow-wake-relay-poc",
  storageBucket: "moonshadow-wake-relay-poc.firebasestorage.app",
  messagingSenderId: "10900801081",
  appId: "1:10900801081:web:78b796d45e05c2c69e2fe8",
};

// ─── Cloudflare Workers ───────────────────────────────────────────────────────
const workersConfig = {
  core: {
    name: "moonshadow-path-core-gen1",
    main: "src/core.ts",
    compatibilityDate: "2026-08-10",
    workersDev: true,
    vars: {
      ALLOWED_ORIGIN: "https://REPLACE-WITH-NEW-PATH-CLIENT.example",
      SOURCE_VERSION: "gen1-local-review",
    },
    durableObjects: [
      {
        name: "PATH_STATE",
        className: "PathState",
      },
    ],
    migrations: [
      {
        tag: "gen1",
        newSqliteClasses: ["PathState"],
      },
    ],
    queues: {
      producers: [
        {
          binding: "PATH_QUEUE",
          queue: "moonshadow-wake-path-gen1",
        },
      ],
      consumers: [
        {
          queue: "moonshadow-wake-path-gen1",
          maxBatchSize: 1,
          maxRetries: 2,
          deadLetterQueue: "moonshadow-wake-path-gen1-dlq",
        },
      ],
    },
    services: [
      { binding: "ALLIE", service: "moonshadow-path-allie-gen1" },
      { binding: "AMBER", service: "moonshadow-path-amber-gen1" },
    ],
  },

  allie: {
    name: "moonshadow-path-allie-gen1",
    main: "src/allie.ts",
    compatibilityDate: "2026-08-10",
    workersDev: false,
    ai: { binding: "AI" },
    vars: {
      AI_MODEL: "REPLACE_WITH_VERIFIED_FREE_WORKERS_AI_MODEL",
      SOURCE_VERSION: "gen1-local-review",
    },
  },

  amber: {
    name: "moonshadow-path-amber-gen1",
    main: "src/amber.ts",
    compatibilityDate: "2026-08-10",
    workersDev: false,
    ai: { binding: "AI" },
    vars: {
      AI_MODEL: "REPLACE_WITH_VERIFIED_FREE_WORKERS_AI_MODEL",
      SOURCE_VERSION: "gen1-local-review",
    },
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = { firebaseConfig, workersConfig };
} else {
  window.__PATH_CONFIG__ = { firebaseConfig, workersConfig };
}
