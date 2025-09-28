export default {
  "project": {
    "name": "p5",
    "tagline": "the 5th man",
    "repo": "IshaanBansal2006/p5",
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