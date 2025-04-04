import { spawnSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import prompts from "prompts";
import { generateReadme } from "../templates/readme.js";
import { execa } from "execa";

export async function createProject(name?: string) {
  let projectName: string;

  if (!name) {
    const response = await prompts([
      {
        type: "text",
        name: "projectName",
        message: "What is the name of your MCP server project?",
        validate: (value: string) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : "Project name can only contain lowercase letters, numbers, and hyphens",
      },
    ]);

    if (!response.projectName) {
      console.log("Project creation cancelled");
      process.exit(1);
    }

    projectName = response.projectName as string;
  } else {
    projectName = name;
  }

  if (!projectName) {
    throw new Error("Project name is required");
  }

  const projectDir = join(process.cwd(), projectName);
  const srcDir = join(projectDir, "src");
  const toolsDir = join(srcDir, "tools");

  try {
    console.log("Creating project structure...");
    await mkdir(projectDir);
    await mkdir(srcDir);
    await mkdir(toolsDir);

    const packageJson = {
      name: projectName,
      version: "0.0.1",
      description: `${projectName} MCP server`,
      type: "module",
      bin: {
        [projectName]: "./dist/index.js",
      },
      files: ["dist"],
      scripts: {
        build: "tsc && mcp-build",
        prepare: "npm run build",
        watch: "tsc --watch",
        start: "node dist/index.js"
      },
      dependencies: {
        "@ronangrant/mcp-framework": "^1.0.4"
      },
      devDependencies: {
        "@types/node": "^20.11.24",
        "typescript": "^5.3.3"
      },
    };

    const tsconfig = {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "node",
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules"],
    };

    const indexTs = `import { MCPServer } from "@ronangrant/mcp-framework";
import ExampleTool from "./tools/ExampleTool.js";

const server = new MCPServer();
const exampleTool = new ExampleTool();

// Register the example tool
server["toolsMap"].set(exampleTool.name, exampleTool);

server.start();`;

    const exampleToolTs = `import { MCPTool } from "@ronangrant/mcp-framework";
import { z } from "zod";

interface ExampleInput {
  message: string;
}

class ExampleTool extends MCPTool<ExampleInput> {
  name = "example_tool";
  description = "An example tool that processes messages";

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  async execute(input: ExampleInput) {
    return \`Processed: \${input.message}\`;
  }
}

export default ExampleTool;`;

    console.log("Creating project files...");
    await Promise.all([
      writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2)),
      writeFile(join(projectDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2)),
      writeFile(join(projectDir, "README.md"), generateReadme(projectName)),
      writeFile(join(srcDir, "index.ts"), indexTs),
      writeFile(join(toolsDir, "ExampleTool.ts"), exampleToolTs),
    ]);

    process.chdir(projectDir);

    console.log("Initializing git repository...");
    const gitInit = spawnSync("git", ["init"], {
      stdio: "inherit",
      shell: true,
    });

    if (gitInit.status !== 0) {
      throw new Error("Failed to initialize git repository");
    }

    console.log("Installing dependencies...");
    const npmInstall = spawnSync("npm", ["install"], {
      stdio: "inherit",
      shell: true
    });

    if (npmInstall.status !== 0) {
      throw new Error("Failed to install dependencies");
    }

    console.log("Building project...");
    const tscBuild = await execa('npx', ['tsc'], {
      cwd: projectDir,
      stdio: "inherit",
    });

    if (tscBuild.exitCode !== 0) {
      throw new Error("Failed to build TypeScript");
    }

    const mcpBuild = await execa('npx', ['mcp-build'], {
      cwd: projectDir,
      stdio: "inherit",
      env: {
        ...process.env,
        MCP_SKIP_VALIDATION: "true"
      }
    });

    if (mcpBuild.exitCode !== 0) {
      throw new Error("Failed to run mcp-build");
    }

    console.log(`
Project ${projectName} created and built successfully!

You can now:
1. cd ${projectName}
2. Add more tools using:
   mcp add tool <name>
    `);
  } catch (error) {
    console.error("Error creating project:", error);
    process.exit(1);
  }
}
