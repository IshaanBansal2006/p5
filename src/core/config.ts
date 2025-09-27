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
      // Match export default { ... } with optional satisfies clause
      // Find the start of the object and then find the matching closing brace
      const startMatch = content.match(/export\s+default\s+(\{)/);
      if (startMatch) {
        const startPos = startMatch.index! + startMatch[0].length - 1; // Position of the opening brace
        let braceCount = 0;
        let endPos = startPos;
        
        for (let i = startPos; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endPos = i;
              break;
            }
          }
        }
        
        const configStr = content.substring(startPos, endPos + 1);
        
        // Simple JSON-like parsing - this is a simplified approach
        // First, handle unquoted keys (but not inside strings)
        let parsedConfigStr = configStr;
        
        // Replace unquoted keys with quoted keys, but avoid keys that are already quoted
        parsedConfigStr = parsedConfigStr.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        
        // Replace single quotes with double quotes
        parsedConfigStr = parsedConfigStr.replace(/'/g, '"');
        
        // Remove trailing commas before closing brackets/braces
        parsedConfigStr = parsedConfigStr.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(parsedConfigStr);
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
