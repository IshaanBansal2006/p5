import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { P5Config } from '../types/config.js';

export { P5Config } from '../types/config.js';

const CONFIG_FILES = ['p5.config.ts', '.p5rc.json'];

export function findConfigFile(projectRoot: string): string | null {
  for (const file of CONFIG_FILES) {
    const path = join(projectRoot, file);
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

export function loadConfig(projectRoot: string): P5Config | null {
  const configFile = findConfigFile(projectRoot);
  if (!configFile) {
    return null;
  }

  try {
    if (configFile.endsWith('.ts')) {
      // For TypeScript config files, we'll use a simple eval approach
      // In production, you might want to use a proper TypeScript compiler
      const content = readFileSync(configFile, 'utf-8');
      const configMatch = content.match(/export\s+default\s+({[\s\S]*?})\s*;?\s*$/m);
      if (configMatch) {
        // Simple JSON-like parsing - this is a simplified approach
        const configStr = configMatch[1]
          .replace(/(\w+):/g, '"$1":')
          .replace(/'/g, '"')
          .replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(configStr);
      }
    } else {
      const content = readFileSync(configFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to load config from ${configFile}:`, error);
  }

  return null;
}

export function getDefaultConfig(): P5Config {
  return {
    project: {
      name: "",
      tagline: "",
      repo: "",
      demoUrl: ""
    },
    tests: {
      preCommit: ["lint", "typecheck"],
      prePush: ["build", "e2e:smoke"]
    },
    notifications: {
      provider: "none",
      webhook: ""
    },
    readme: {
      sections: ["STATUS", "COMMITS"]
    }
  };
}

export function saveConfig(projectRoot: string, config: P5Config): void {
  const configFile = join(projectRoot, 'p5.config.ts');
  const configContent = `export default ${JSON.stringify(config, null, 2)} satisfies P5Config;`;
  writeFileSync(configFile, configContent);
}

export function setConfigValue(projectRoot: string, key: string, value: string): boolean {
  const config = loadConfig(projectRoot) || getDefaultConfig();
  
  // Parse dot notation key
  const keys = key.split('.');
  let current: any = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  // Set the value
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
  
  saveConfig(projectRoot, config);
  return true;
}
