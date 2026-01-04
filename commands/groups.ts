/**
 * Groups command - View Canvas group memberships
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { Table, printInfo, printSeparator } from "../lib/display.js";
import chalk from "chalk";
import type {
  CanvasGroup,
  CanvasUser,
  ShowGroupsOptions,
} from "../types/index.js";

function formatMemberCount(count: number): string {
  if (count === 1) return "1 member";
  return `${count} members`;
}

export async function showGroups(
  options: ShowGroupsOptions = {},
): Promise<void> {
  try {
    printInfo("\n" + "-".repeat(60));
    printInfo("Loading your groups...");

    // Fetch user's groups
    const groups = await makeCanvasRequest<CanvasGroup[]>(
      "get",
      "users/self/groups",
      ["per_page=100", "include[]=users"],
    );

    if (!groups || groups.length === 0) {
      console.log(chalk.yellow("\nYou are not a member of any groups."));
      return;
    }

    console.log(chalk.cyan.bold(`\nYour Groups (${groups.length})`));
    printSeparator();

    // Group by context type (course vs account)
    const courseGroups = groups.filter((g) => g.context_type === "Course");
    const otherGroups = groups.filter((g) => g.context_type !== "Course");

    // Display course groups
    if (courseGroups.length > 0) {
      console.log(chalk.cyan.bold("\nCourse Groups"));

      const courseTable = new Table(
        [
          {
            key: "name",
            header: "Group Name",
            flex: 2,
            minWidth: 15,
            maxWidth: 40,
          },
          {
            key: "members",
            header: "Members",
            minWidth: 10,
            maxWidth: 15,
          },
          {
            key: "role",
            header: "Role",
            minWidth: 8,
            maxWidth: 15,
          },
          {
            key: "joinLevel",
            header: "Join Level",
            minWidth: 12,
            maxWidth: 20,
          },
        ],
        { title: "" },
      );

      courseGroups.forEach((group) => {
        courseTable.addRow({
          name: group.name,
          members: formatMemberCount(group.members_count),
          role: group.role || "Member",
          joinLevel: group.join_level?.replace(/_/g, " ") || "N/A",
        });
      });

      courseTable.render();
    }

    // Display other groups
    if (otherGroups.length > 0) {
      console.log(chalk.cyan.bold("\nOther Groups"));

      const otherTable = new Table(
        [
          {
            key: "name",
            header: "Group Name",
            flex: 2,
            minWidth: 15,
            maxWidth: 40,
          },
          {
            key: "members",
            header: "Members",
            minWidth: 10,
            maxWidth: 15,
          },
          {
            key: "type",
            header: "Type",
            minWidth: 8,
            maxWidth: 15,
          },
        ],
        { title: "" },
      );

      otherGroups.forEach((group) => {
        otherTable.addRow({
          name: group.name,
          members: formatMemberCount(group.members_count),
          type: group.context_type || "General",
        });
      });

      otherTable.render();
    }

    // Show detailed member information if verbose
    if (options.members || options.verbose) {
      console.log(chalk.cyan.bold("\nGroup Members"));
      printSeparator();

      for (const group of groups) {
        if (group.users && group.users.length > 0) {
          console.log(chalk.white.bold(`\n${group.name}:`));

          const memberTable = new Table(
            [
              {
                key: "name",
                header: "Name",
                flex: 2,
                minWidth: 15,
                maxWidth: 30,
              },
              {
                key: "email",
                header: "Email",
                flex: 1,
                minWidth: 15,
                maxWidth: 35,
              },
            ],
            { title: "" },
          );

          group.users.forEach((user: CanvasUser) => {
            memberTable.addRow({
              name: user.name || user.short_name || "Unknown",
              email: user.email || user.login_id || "-",
            });
          });

          memberTable.render();
        } else {
          // Fetch members if not included
          try {
            const members = await makeCanvasRequest<CanvasUser[]>(
              "get",
              `groups/${group.id}/users`,
              ["per_page=50"],
            );

            if (members && members.length > 0) {
              console.log(chalk.white.bold(`\n${group.name}:`));

              const memberTable = new Table(
                [
                  {
                    key: "name",
                    header: "Name",
                    flex: 2,
                    minWidth: 15,
                    maxWidth: 30,
                  },
                  {
                    key: "email",
                    header: "Email",
                    flex: 1,
                    minWidth: 15,
                    maxWidth: 35,
                  },
                ],
                { title: "" },
              );

              members.forEach((user) => {
                memberTable.addRow({
                  name: user.name || user.short_name || "Unknown",
                  email: user.email || user.login_id || "-",
                });
              });

              memberTable.render();
            }
          } catch {
            console.log(
              chalk.gray(`  Could not fetch members for ${group.name}`),
            );
          }
        }
      }
    }

    // Summary
    console.log("");
    console.log(
      chalk.gray(
        `Total: ${groups.length} group(s) | Course: ${courseGroups.length} | Other: ${otherGroups.length}`,
      ),
    );

    if (!options.members && !options.verbose) {
      console.log(chalk.gray("Tip: Use -m or --members to see group members."));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle permission errors gracefully
    if (
      errorMessage.includes("Access denied") ||
      errorMessage.includes("permission")
    ) {
      console.log(chalk.yellow("\nUnable to access groups."));
      console.log(
        chalk.gray("You may not have permission to view group information."),
      );
      return;
    }

    console.error(chalk.red("Error:"), errorMessage);
  }
}
