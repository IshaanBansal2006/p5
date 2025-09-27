import { P5Config } from './src/types/config.js';

export default {
  "project": {
    "name": "Test Project",
    "tagline": "",
    "repo": "",
    "demoUrl": ""
  },
  "tests": {
    "preCommit": [
      "lint",
      "typecheck"
    ],
    "prePush": [
      "build",
      "e2e:smoke"
    ]
  },
  "notifications": {
    "provider": "none",
    "webhook": ""
  },
  "readme": {
    "sections": [
      "STATUS",
      "COMMITS"
    ]
  }
} satisfies P5Config;