import { readFile } from "fs/promises";
import { findUp } from 'find-up';

export async function validateMCPProject() {
  try {
    const packageJsonPath = await findUp('package.json');
    
    if (!packageJsonPath) {
      throw new Error("Could not find package.json in current directory or any parent directories");
    }

    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const package_json = JSON.parse(packageJsonContent);

    if (
      !package_json.dependencies?.["@ronangrant/mcp-framework"] &&
      !package_json.devDependencies?.["@ronangrant/mcp-framework"]
    ) {
      throw new Error(
        "This directory is not an MCP project (@ronangrant/mcp-framework not found in dependencies or devDependencies)"
      );
    }
  } catch (error) {
    console.error("Error: Must be run from an MCP project directory");
    process.exit(1);
  }
}
