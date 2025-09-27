export default {
  project: {
    name: "{{name}}",
    tagline: "{{tagline}}",
    repo: "{{repo}}",
    demoUrl: "{{demoUrl}}"
  },
  tests: { preCommit: ["lint","typecheck"], prePush: ["build","e2e:smoke"] },
  notifications: { provider: "none", webhook: "" },
  readme: { sections: ["STATUS","COMMITS"] }
} satisfies P5Config;
