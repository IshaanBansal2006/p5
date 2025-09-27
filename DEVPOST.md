# P5 CLI — Devpost Draft

## Inspiration
We wanted to create a comprehensive development workflow tool specifically designed for hackathons. Having participated in many hackathons, we noticed that teams often spend valuable time setting up basic development infrastructure instead of focusing on building their core product. P5 aims to solve this by providing a "devflow-in-a-box" solution that handles testing, CI/CD, documentation, and project management automatically.

## What It Does
P5 is a Node/TypeScript CLI that provides a complete development workflow for hackathon projects. It automates the setup of testing infrastructure, CI/CD pipelines, documentation generation, and project management tools. With simple commands like `p5 init`, `p5 test`, and `p5 devpost gen`, teams can focus on building their core product while P5 handles the development infrastructure.

## How We Built It
TypeScript, Node.js, esbuild, Playwright, Husky, GitHub Actions, Commander.js, Chalk, Prompts

## Challenges We Ran Into
One of the main challenges was creating a flexible configuration system that works across different project types and frameworks. We needed to detect build systems, testing frameworks, and project structures automatically while still allowing customization. Another challenge was ensuring the CLI works seamlessly in both local development and CI environments.

## Accomplishments that We're Proud Of
We're proud of creating a comprehensive solution that covers the entire development lifecycle for hackathon projects. The automatic detection of technologies and build systems, the seamless integration with popular tools like Playwright and Husky, and the ability to generate professional documentation and Devpost drafts are key accomplishments.

## What We Learned
We learned a lot about the different pain points in hackathon development workflows and how to create a tool that addresses them without being overly opinionated. We also gained experience in building CLI tools that need to work across different environments and project structures.

## What's next for P5 CLI
We plan to add more integrations with popular hackathon platforms, improve the technology detection algorithms, add support for more testing frameworks, and create templates for common hackathon project types. We also want to add features for team collaboration and project sharing.

## Built With
- commander@^13.0.0
- chalk@^5.3.0
- execa@^9.3.0
- fs-extra@^11.2.0
- globby@^14.0.2
- node-fetch@^3.3.2
- ora@^8.0.1
- prompts@^2.4.2
- semver@^7.6.3
- yaml@^2.5.1
- @octokit/rest@^21.0.0
- esbuild@^0.23.0
- typescript@^5.4.5
