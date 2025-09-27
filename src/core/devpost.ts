import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import prompts from 'prompts';
import { P5Config } from '../types/config.js';
import chalk from 'chalk';

export async function generateDevpost(projectRoot: string, config: P5Config): Promise<void> {
  const devpostPath = join(projectRoot, 'DEVPOST.md');
  
  // Check if we're in CI mode (no prompts)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  let devpostData: any = {
    name: config.project.name,
    inspiration: '',
    what_it_does: config.project.tagline || '',
    how_built: '',
    challenges: '',
    accomplishments: '',
    learned: '',
    whats_next: '',
    built_with_list: ''
  };
  
  if (!isCI) {
    console.log(chalk.blue('📝 Generating Devpost draft...'));
    
    // Prompt for missing information
    const responses = await prompts([
      {
        type: 'text',
        name: 'inspiration',
        message: 'What inspired this project?',
        initial: devpostData.inspiration
      },
      {
        type: 'text',
        name: 'what_it_does',
        message: 'What does your project do?',
        initial: devpostData.what_it_does
      },
      {
        type: 'text',
        name: 'how_built',
        message: 'How did you build it?',
        initial: await detectTechnologies(projectRoot)
      },
      {
        type: 'text',
        name: 'challenges',
        message: 'What challenges did you run into?'
      },
      {
        type: 'text',
        name: 'accomplishments',
        message: 'What accomplishments are you proud of?'
      },
      {
        type: 'text',
        name: 'learned',
        message: 'What did you learn?'
      },
      {
        type: 'text',
        name: 'whats_next',
        message: 'What\'s next for your project?'
      }
    ]);
    
    devpostData = { ...devpostData, ...responses };
  } else {
    // In CI, use defaults and detected tech
    devpostData.how_built = await detectTechnologies(projectRoot);
  }
  
  // Generate built with list
  devpostData.built_with_list = await generateBuiltWithList(projectRoot);
  
  // Load template and replace placeholders
  const templatePath = join(projectRoot, 'templates', 'devpost.md.tpl');
  let template = '';
  
  if (existsSync(templatePath)) {
    template = readFileSync(templatePath, 'utf-8');
  } else {
    // Fallback template
    template = `# {{name}} — Devpost Draft

## Inspiration
{{inspiration}}

## What It Does
{{what_it_does}}

## How We Built It
{{how_built}}

## Challenges We Ran Into
{{challenges}}

## Accomplishments that We're Proud Of
{{accomplishments}}

## What We Learned
{{learned}}

## What's next for {{name}}
{{whats_next}}

## Built With
{{built_with_list}}
`;
  }
  
  // Replace placeholders
  let content = template;
  for (const [key, value] of Object.entries(devpostData)) {
    const placeholder = `{{${key}}}`;
    content = content.replace(new RegExp(placeholder, 'g'), (value || '').toString());
  }
  
  writeFileSync(devpostPath, content);
  console.log(chalk.green('✅ DEVPOST.md generated successfully'));
}

async function detectTechnologies(projectRoot: string): Promise<string> {
  const packageJsonPath = join(projectRoot, 'package.json');
  const technologies: string[] = [];
  
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Detect common frameworks and libraries
      if (deps.next) technologies.push('Next.js');
      if (deps.react) technologies.push('React');
      if (deps.vue) technologies.push('Vue.js');
      if (deps.angular) technologies.push('Angular');
      if (deps.express) technologies.push('Express.js');
      if (deps.fastify) technologies.push('Fastify');
      if (deps.koa) technologies.push('Koa');
      if (deps.typescript) technologies.push('TypeScript');
      if (deps.tailwindcss) technologies.push('Tailwind CSS');
      if (deps['styled-components']) technologies.push('Styled Components');
      if (deps.prisma) technologies.push('Prisma');
      if (deps.mongoose) technologies.push('Mongoose');
      if (deps.sequelize) technologies.push('Sequelize');
      if (deps.postgresql || deps.pg) technologies.push('PostgreSQL');
      if (deps.mysql) technologies.push('MySQL');
      if (deps.mongodb) technologies.push('MongoDB');
      if (deps.redis) technologies.push('Redis');
      if (deps.docker) technologies.push('Docker');
      if (deps['aws-sdk']) technologies.push('AWS');
      if (deps.vercel) technologies.push('Vercel');
      if (deps.netlify) technologies.push('Netlify');
    } catch (_error) {
      // Ignore JSON parse errors
    }
  }
  
  // Detect other files
  if (existsSync(join(projectRoot, 'Dockerfile'))) {
    technologies.push('Docker');
  }
  if (existsSync(join(projectRoot, 'docker-compose.yml'))) {
    technologies.push('Docker Compose');
  }
  if (existsSync(join(projectRoot, 'requirements.txt'))) {
    technologies.push('Python');
  }
  if (existsSync(join(projectRoot, 'Cargo.toml'))) {
    technologies.push('Rust');
  }
  if (existsSync(join(projectRoot, 'go.mod'))) {
    technologies.push('Go');
  }
  
  return technologies.length > 0 
    ? technologies.join(', ') 
    : 'Modern web technologies and best practices';
}

async function generateBuiltWithList(projectRoot: string): Promise<string> {
  const packageJsonPath = join(projectRoot, 'package.json');
  const builtWith: string[] = [];
  
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Include key dependencies
      const keyDeps = [
        'react', 'next', 'vue', 'angular', 'express', 'fastify', 'koa',
        'typescript', 'tailwindcss', 'styled-components', 'prisma',
        'mongoose', 'sequelize', 'postgresql', 'pg', 'mysql', 'mongodb',
        'redis', 'docker', 'aws-sdk', 'vercel', 'netlify'
      ];
      
      for (const dep of keyDeps) {
        if (deps[dep]) {
          builtWith.push(`- ${dep}@${deps[dep]}`);
        }
      }
    } catch (_error) {
      // Ignore JSON parse errors
    }
  }
  
  if (builtWith.length === 0) {
    builtWith.push('- Modern web technologies');
  }
  
  return builtWith.join('\n');
}
