export interface P5Config {
  project: {
    name: string;
    tagline?: string;
    repo?: string;      // "owner/repo"
    demoUrl?: string;
  };
  tests: {
    preCommit: string[]; // logical task names we map to actual commands
    prePush: string[];
  };
  notifications: {
    provider: "slack" | "discord" | "none";
    webhook?: string;
  };
  readme: {
    sections: ("STATUS" | "COMMITS")[];
  };
}

export interface Commit {
  sha: string;
  author: string;
  email: string;
  message: string;
  date: Date;
}

export interface TaskResult {
  name: string;
  success: boolean;
  output: string;
  error?: string;
  failingFiles?: string[];
}
