import { ToolProtocol } from "../tools/BaseTool.js";
import { join, dirname } from "path";
import { promises as fs } from "fs";
import { logger } from "./Logger.js";

export class ToolLoader {
  private readonly TOOLS_DIR: string;
  private readonly EXCLUDED_FILES = ["BaseTool.js", "*.test.js", "*.spec.js"];

  constructor() {
    const mainModulePath = process.argv[1];
    this.TOOLS_DIR = join(dirname(mainModulePath), "tools");
    logger.debug(`Initialized ToolLoader with directory: ${this.TOOLS_DIR}`);
  }

  private isToolFile(file: string): boolean {
    if (!file.endsWith(".js")) return false;
    const isExcluded = this.EXCLUDED_FILES.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace("*", ".*"));
        return regex.test(file);
      }
      return file === pattern;
    });

    logger.debug(
      `Checking file ${file}: ${isExcluded ? "excluded" : "included"}`
    );
    return !isExcluded;
  }

  private validateTool(tool: any): tool is ToolProtocol {
    const isValid = Boolean(
      tool &&
        typeof tool.name === "string" &&
        tool.toolDefinition &&
        typeof tool.toolCall === "function"
    );

    if (isValid) {
      logger.debug(`Validated tool: ${tool.name}`);
    } else {
      logger.warn(`Invalid tool found: missing required properties`);
    }

    return isValid;
  }

  async loadTools(): Promise<ToolProtocol[]> {
    try {
      logger.debug(`Attempting to load tools from: ${this.TOOLS_DIR}`);

      let stats;
      try {
        stats = await fs.stat(this.TOOLS_DIR);
      } catch (error) {
        logger.error(`Error accessing tools directory: ${error}`);
        return [];
      }

      if (!stats.isDirectory()) {
        logger.error(`Path is not a directory: ${this.TOOLS_DIR}`);
        return [];
      }

      const files = await fs.readdir(this.TOOLS_DIR);
      logger.debug(`Found files in directory: ${files.join(", ")}`);

      const tools: ToolProtocol[] = [];

      for (const file of files) {
        if (!this.isToolFile(file)) {
          continue;
        }

        try {
          const fullPath = join(this.TOOLS_DIR, file);
          logger.debug(`Attempting to load tool from: ${fullPath}`);

          const importPath = `file://${fullPath}`;
          const { default: ToolClass } = await import(importPath);

          if (!ToolClass) {
            logger.warn(`No default export found in ${file}`);
            continue;
          }

          const tool = new ToolClass();
          if (this.validateTool(tool)) {
            tools.push(tool);
          }
        } catch (error) {
          logger.error(`Error loading tool ${file}: ${error}`);
        }
      }

      logger.debug(
        `Successfully loaded ${tools.length} tools: ${tools
          .map((t) => t.name)
          .join(", ")}`
      );
      return tools;
    } catch (error) {
      logger.error(`Failed to load tools: ${error}`);
      return [];
    }
  }
}
