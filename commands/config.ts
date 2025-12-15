/**
 * Config command
 */

import {
  configExists,
  readConfig,
  saveConfig,
  deleteConfig,
  getConfigPath,
} from "../lib/config.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import chalk from "chalk";
import readline from "readline";

export async function showConfig(): Promise<void> {
  console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
  console.log(chalk.cyan.bold("Canvas CLI Configuration"));
  console.log(chalk.cyan("-".repeat(60)));

  const configPath = getConfigPath();
  const hasConfig = configExists();

  console.log(chalk.white("Configuration file: ") + configPath);
  console.log(
    chalk.white("Status: ") +
      (hasConfig ? chalk.green("Found") : chalk.red("Not found")) +
      "\n",
  );

  if (hasConfig) {
    const config = readConfig();
    if (config) {
      console.log(chalk.cyan("Current configuration:"));
      console.log(
        chalk.white("  Canvas Domain: ") + (config.domain || "Not set"),
      );
      console.log(
        chalk.white("  API Token: ") +
          (config.token ? config.token.substring(0, 10) + "..." : "Not set"),
      );
      console.log(
        chalk.white("  Created: ") +
          (config.createdAt
            ? new Date(config.createdAt).toLocaleString()
            : "Unknown"),
      );
      console.log(
        chalk.white("  Last Updated: ") +
          (config.lastUpdated
            ? new Date(config.lastUpdated).toLocaleString()
            : "Unknown"),
      );
    }
  } else {
    console.log(
      chalk.yellow("No configuration found, run canvas config setup to start."),
    );
  }
}

export async function setupConfig(): Promise<void> {
  const rl = createReadlineInterface();

  try {
    console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
    console.log(chalk.cyan.bold("Canvas CLI Configuration Setup"));
    console.log(chalk.cyan("-".repeat(60)));

    console.log(chalk.white("Get your Canvas API token:"));
    console.log(chalk.white("   - Log into your Canvas"));
    console.log(chalk.white("   - Go to Account → Settings"));
    console.log(chalk.white('   - Scroll down to "Approved Integrations"'));
    console.log(chalk.white('   - Click "+ New Access Token"'));
    console.log(chalk.white("   - Copy the generated token"));

    if (configExists()) {
      const config = readConfig();
      console.log(chalk.yellow("Existing configuration found:"));
      console.log(chalk.white("  Domain: ") + (config?.domain || "Not set"));
      console.log(
        chalk.white("  Token: ") +
          (config?.token ? "Set (hidden)" : "Not set") +
          "\n",
      );

      const overwrite = await askQuestion(
        rl,
        "Do you want to overwrite the existing configuration? (y/N): ",
      );
      if (
        overwrite.toLowerCase() !== "y" &&
        overwrite.toLowerCase() !== "yes"
      ) {
        console.log(chalk.yellow("Setup cancelled."));
        return;
      }
      console.log("");
    }

    const currentConfig = readConfig();
    let domain = await askQuestion(
      rl,
      `Enter your Canvas domain${currentConfig?.domain ? ` (${currentConfig.domain})` : ""}: `,
    );
    if (!domain && currentConfig?.domain) {
      domain = currentConfig.domain;
    }

    if (!domain) {
      console.log(chalk.red("Canvas domain is required."));
      return;
    }

    domain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!domain.includes(".")) {
      console.log(
        chalk.red(
          "Invalid domain format. Please enter a valid domain (e.g., school.instructure.com)",
        ),
      );
      return;
    }

    console.log(chalk.green(`Domain set to: ${domain}\n`));

    const defaultToken = currentConfig?.token || "";
    let token = await askQuestion(
      rl,
      `Enter your Canvas API token${defaultToken ? " (press Enter to keep current)" : ""}: `,
    );
    if (!token && defaultToken) {
      token = defaultToken;
    }

    if (!token) {
      console.log(chalk.red("Canvas API token is required."));
      console.log(chalk.cyan("\nTo get your API token:"));
      console.log(chalk.white("1. Log into your Canvas instance"));
      console.log(chalk.white("2. Go to Account → Settings"));
      console.log(chalk.white('3. Scroll down to "Approved Integrations"'));
      console.log(chalk.white('4. Click "+ New Access Token"'));
      console.log(chalk.white("5. Copy the generated token"));
      return;
    }

    if (token.length < 10) {
      console.log(
        chalk.red("API token seems too short. Please check your token."),
      );
      return;
    }

    console.log("Token received\n");

    const saved = saveConfig(domain, token);
    if (saved) {
      console.log(
        chalk.green("Success: Configuration setup completed successfully!"),
      );
      console.log(chalk.cyan("\nNext steps:"));
      console.log(
        chalk.white(
          "  canvas list              # Test your setup by listing courses",
        ),
      );
      console.log(
        chalk.white("  canvas profile           # View your profile"),
      );
      console.log(
        chalk.white("  canvas config show       # View your configuration"),
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error: Setup failed: ") + errorMessage);
  } finally {
    rl.close();
  }
}

export async function editConfig(): Promise<void> {
  const rl = createReadlineInterface();

  try {
    if (!configExists()) {
      console.log(
        'No configuration file found. Run "canvas config setup" first.',
      );
      return;
    }

    const config = readConfig();
    if (!config) {
      console.log(chalk.red("Error reading configuration."));
      return;
    }

    console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
    console.log(chalk.cyan.bold("Edit Canvas CLI Configuration"));
    console.log(chalk.cyan("-".repeat(60)));
    console.log(chalk.cyan("Current values:"));
    console.log(chalk.white("  Domain: ") + config.domain);
    console.log(
      chalk.white("  Token: ") +
        (config.token ? config.token.substring(0, 10) + "..." : "Not set") +
        "\n",
    );

    const newDomain = await askQuestion(
      rl,
      `New Canvas domain (${config.domain}): `,
    );
    const domain = newDomain.trim() || config.domain;

    const changeToken = await askQuestion(rl, "Change API token? (y/N): ");
    let token = config.token;

    if (
      changeToken.toLowerCase() === "y" ||
      changeToken.toLowerCase() === "yes"
    ) {
      const newToken = await askQuestion(rl, "New API token: ");
      if (newToken.trim()) {
        token = newToken.trim();
      }
    }

    console.log(chalk.cyan("New configuration:"));
    console.log(chalk.white("  Domain: ") + domain);
    console.log(
      chalk.white("  Token: ") +
        (token ? token.substring(0, 10) + "..." : "Not set"),
    );

    const confirm = await askQuestion(rl, "\nSave changes? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log(chalk.yellow("Changes cancelled."));
      return;
    }

    const saved = saveConfig(domain, token);
    if (saved) {
      console.log(chalk.green("Success: Configuration updated successfully!"));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error: Edit failed: ") + errorMessage);
  } finally {
    rl.close();
  }
}

export function showConfigPath(): void {
  console.log(chalk.cyan("Configuration file location: ") + getConfigPath());
  console.log(
    chalk.white("Exists: ") +
      (configExists() ? chalk.green("Yes") : chalk.red("No")),
  );
}

export function deleteConfigFile(): void {
  console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
  console.log(chalk.cyan.bold("Delete Configuration"));
  console.log(chalk.cyan("-".repeat(60)));

  if (!configExists()) {
    console.log(chalk.yellow("No configuration file found."));
    return;
  }

  const config = readConfig();
  console.log(chalk.cyan("Current configuration:"));
  console.log(chalk.white("  Domain: ") + (config?.domain || "N/A"));
  console.log(
    chalk.white("  Token: ") + (config?.token ? "Set (hidden)" : "Not set"),
  );
  console.log(chalk.white("  File: ") + getConfigPath() + "\n");

  console.log(
    chalk.red("This will permanently delete your Canvas CLI configuration."),
  );
  console.log(
    chalk.yellow(
      'You will need to run "canvas config setup" again to use the CLI.',
    ),
  );
  console.log(chalk.cyan("\nTo confirm deletion, type: DELETE"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Confirmation: ", (answer: string) => {
    if (answer === "DELETE") {
      deleteConfig();
      console.log(chalk.green("Success: Configuration deleted."));
    } else {
      console.log(chalk.yellow("Deletion cancelled."));
    }
    rl.close();
  });
}
