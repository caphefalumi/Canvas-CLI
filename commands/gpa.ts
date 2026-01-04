/**
 * GPA Calculator command - Calculate overall GPA across all courses
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  Table,
  printInfo,
  printError,
  printSeparator,
} from "../lib/display.js";
import chalk from "chalk";
import type { CanvasCourse, CanvasEnrollment } from "../types/index.js";

interface CourseGrade {
  courseName: string;
  courseCode: string;
  currentScore: number | null;
  finalScore: number | null;
  letterGrade: string | null;
  gradePoints: number;
  credits: number;
  state: string;
}

/**
 * Convert letter grade to 4.0 scale
 */
function letterGradeToGPA(
  letterGrade: string | null,
  score: number | null,
): number {
  if (!letterGrade && score === null) return 0;

  // If we have a score but no letter grade, calculate from score
  if (!letterGrade && score !== null) {
    if (score >= 80) return 4.0; // HD
    if (score >= 70) return 3.0; // D
    if (score >= 60) return 2.0; // C
    if (score >= 50) return 1.0; // P
    return 0.0; // N
  }

  // Standard letter grade conversion
  const grade = letterGrade?.toUpperCase().trim() || "";

  const gradeMap: Record<string, number> = {
    // Australian grading system
    HD: 4.0, // High Distinction (80-100)
    D: 3.0, // Distinction (70-79)
    C: 2.0, // Credit (60-69)
    P: 1.0, // Pass (50-59)
    N: 0.0, // Fail (0-49)
    F: 0.0, // Fail
    // US grading system (as fallback)
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    "C-": 1.7,
    "D+": 1.3,
    "D-": 0.7,
    E: 0.0,
  };

  return gradeMap[grade] ?? 0.0;
}

/**
 * Calculate "What grade do I need" for a specific course
 */
export async function calculateWhatIfGrade(): Promise<void> {
  try {
    const { createReadlineInterface } = await import("../lib/interactive.js");
    const rl = createReadlineInterface();

    printSeparator("=");
    printInfo("Grade Calculator - What grade do I need?");
    printSeparator("=");

    const getCurrentGrade = (): Promise<number> => {
      return new Promise((resolve) => {
        rl.question(
          chalk.cyan("\nWhat is your current grade in the course? (%): "),
          (answer) => {
            const num = parseFloat(answer);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              resolve(num);
            } else {
              console.log(chalk.red("Please enter a valid percentage (0-100)"));
              resolve(getCurrentGrade());
            }
          },
        );
      });
    };

    const getCurrentWeight = (): Promise<number> => {
      return new Promise((resolve) => {
        rl.question(
          chalk.cyan("What percentage of the final grade is this? (%): "),
          (answer) => {
            const num = parseFloat(answer);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              resolve(num);
            } else {
              console.log(chalk.red("Please enter a valid percentage (0-100)"));
              resolve(getCurrentWeight());
            }
          },
        );
      });
    };

    const getDesiredGrade = (): Promise<number> => {
      return new Promise((resolve) => {
        rl.question(
          chalk.cyan("What final grade do you want? (%): "),
          (answer) => {
            const num = parseFloat(answer);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              resolve(num);
            } else {
              console.log(chalk.red("Please enter a valid percentage (0-100)"));
              resolve(getDesiredGrade());
            }
          },
        );
      });
    };

    const currentGrade = await getCurrentGrade();
    const currentWeight = await getCurrentWeight();
    const desiredGrade = await getDesiredGrade();

    rl.close();
    const remainingWeight = 100 - currentWeight;

    if (remainingWeight <= 0) {
      printError("Current weight cannot be 100% or more!");
      return;
    }

    // Calculate: desiredGrade = (currentGrade * currentWeight + neededGrade * remainingWeight) / 100
    // Solve for neededGrade:
    const neededGrade =
      (desiredGrade * 100 - currentGrade * currentWeight) / remainingWeight;

    printSeparator("-");
    console.log(chalk.white.bold("\nGrade Calculation Results:\n"));

    console.log(
      chalk.cyan(
        `Current Grade: ${currentGrade}% (${currentWeight}% of final)`,
      ),
    );
    console.log(
      chalk.cyan(`Remaining Work: ${remainingWeight}% of final grade`),
    );
    console.log(chalk.cyan(`Desired Final Grade: ${desiredGrade}%\n`));

    if (neededGrade > 100) {
      console.log(
        chalk.red.bold(`You need ${neededGrade.toFixed(2)}% on remaining work`),
      );
      console.log(chalk.red("Unfortunately, this is not achievable (>100%)"));
      console.log(
        chalk.yellow(
          `\nMaximum possible grade: ${((currentGrade * currentWeight) / 100 + remainingWeight).toFixed(2)}%`,
        ),
      );
    } else if (neededGrade < 0) {
      console.log(
        chalk.green.bold(`You already have ${desiredGrade}% or better!`),
      );
      console.log(
        chalk.green(
          `You could score 0% on remaining work and still meet your goal.`,
        ),
      );
    } else {
      const color =
        neededGrade <= 60
          ? chalk.green
          : neededGrade <= 80
            ? chalk.yellow
            : chalk.red;
      console.log(
        color.bold(
          `You need ${neededGrade.toFixed(2)}% on the remaining ${remainingWeight}% of work`,
        ),
      );

      if (neededGrade <= 90) {
        console.log(chalk.green("This is achievable! Keep up the good work!"));
      } else if (neededGrade <= 95) {
        console.log(chalk.yellow("This will be challenging but possible!"));
      } else {
        console.log(
          chalk.yellow(
            "This will require excellent performance on all remaining work!",
          ),
        );
      }
    }

    printSeparator("-");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printError(`Error calculating grade: ${errorMessage}`);
  }
}

/**
 * Calculate overall GPA across all courses (including completed courses)
 */
export async function calculateOverallGPA(
  options: { includePast?: boolean } = {},
): Promise<void> {
  try {
    printSeparator("=");
    printInfo("Loading all courses and calculating GPA...");
    printSeparator("=");

    // Fetch all courses with enrollments
    const queryParams: string[] = [
      "include[]=total_scores",
      "include[]=current_grading_period_scores",
      "include[]=term",
      "per_page=100",
    ];

    // Include both active and completed courses
    if (options.includePast) {
      queryParams.push("enrollment_state[]=active");
      queryParams.push("enrollment_state[]=completed");
    } else {
      queryParams.push("enrollment_state=active");
    }

    const courses = await makeCanvasRequest<CanvasCourse[]>(
      "get",
      "courses",
      queryParams,
    );

    if (!courses || courses.length === 0) {
      printError("No courses found.");
      return;
    }

    // Get enrollments for each course to get grades
    const courseGrades: CourseGrade[] = [];
    const coursesWithoutGrades: string[] = [];

    for (const course of courses) {
      try {
        const enrollmentParams = [
          "user_id=self",
          "include[]=total_scores",
          "include[]=current_grading_period_scores",
          "include[]=computed_final_score",
          "include[]=computed_current_score",
          "state[]=active",
          "state[]=completed",
          "state[]=invited",
        ];

        const enrollments = await makeCanvasRequest<CanvasEnrollment[]>(
          "get",
          `courses/${course.id}/enrollments`,
          enrollmentParams,
        );

        if (enrollments && enrollments.length > 0) {
          const enrollment = enrollments[0];

          if (enrollment && enrollment.grades) {
            const grades = enrollment.grades;
            const finalScore = grades.final_score;
            const currentScore = grades.current_score;
            const letterGrade = grades.final_grade || grades.current_grade;
            const score = finalScore ?? currentScore;

            // Calculate GPA points (assuming each course is worth 3 credits by default)
            const gradePoints = letterGradeToGPA(letterGrade, score);

            // Include course ONLY if it has actual grade information
            // (score must be a number, not null/undefined, OR letterGrade must be a non-empty string)
            const hasScore = score !== null && score !== undefined;
            const hasLetterGrade = letterGrade && letterGrade.trim() !== "";

            if (hasScore || hasLetterGrade) {
              courseGrades.push({
                courseName: course.name,
                courseCode: course.course_code,
                currentScore: currentScore,
                finalScore: finalScore,
                letterGrade: letterGrade,
                gradePoints: gradePoints,
                credits: 3,
                state: course.workflow_state,
              });
            } else {
              // Track courses without available grades
              coursesWithoutGrades.push(course.name);
            }
          } else {
            coursesWithoutGrades.push(course.name);
          }
        } else {
          coursesWithoutGrades.push(course.name);
        }
      } catch {
        // Skip courses with enrollment errors
        continue;
      }
    }

    if (courseGrades.length === 0) {
      printError("No graded courses found.");
      return;
    }

    // Calculate overall GPA
    let totalQualityPoints = 0;
    let totalCredits = 0;

    for (const grade of courseGrades) {
      if (
        grade.gradePoints > 0 ||
        grade.finalScore !== null ||
        grade.currentScore !== null
      ) {
        totalQualityPoints += grade.gradePoints * grade.credits;
        totalCredits += grade.credits;
      }
    }

    const overallGPA = totalCredits > 0 ? totalQualityPoints / totalCredits : 0;

    // Display results
    console.log(chalk.white.bold("\nIndividual Course Grades:\n"));

    courseGrades.forEach((grade, index) => {
      const score = grade.finalScore ?? grade.currentScore;
      const scoreText =
        score !== null && score !== undefined ? `${score.toFixed(1)}%` : "N/A";
      const letterGrade = grade.letterGrade || "N/A";
      const gpaPoints = grade.gradePoints.toFixed(2);

      // Color coding for scores
      let scoreColor = chalk.gray;
      if (score !== null && score !== undefined) {
        scoreColor =
          score >= 80 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
      }

      // Color coding for letter grades
      let gradeColor = chalk.gray;
      if (letterGrade !== "N/A") {
        const gradeChar = letterGrade.charAt(0);
        if (gradeChar === "H" || gradeChar === "A")
          gradeColor = chalk.green.bold;
        else if (gradeChar === "D" || gradeChar === "B")
          gradeColor = chalk.cyan.bold;
        else if (gradeChar === "C") gradeColor = chalk.yellow.bold;
        else gradeColor = chalk.red.bold;
      }

      // Color coding for GPA
      const gpaNum = parseFloat(gpaPoints);
      let gpaColor = chalk.gray;
      if (!isNaN(gpaNum)) {
        gpaColor =
          gpaNum >= 3.5
            ? chalk.green.bold
            : gpaNum >= 3.0
              ? chalk.cyan
              : gpaNum >= 2.0
                ? chalk.yellow
                : chalk.red;
      }

      console.log(chalk.bold(`${index + 1}. ${grade.courseName}`));
      console.log(chalk.gray(`   Code: ${grade.courseCode || "N/A"}`));
      console.log(
        `   Score: ${scoreColor(scoreText)} | Grade: ${gradeColor(letterGrade)} | GPA: ${gpaColor(gpaPoints)} | Credits: ${grade.credits}`,
      );
      console.log();
    });

    // Summary
    printSeparator("=");
    console.log(chalk.white.bold("\nGPA Summary:\n"));

    const summaryTable = new Table(
      [
        { key: "metric", header: "Metric", flex: 1.5, minWidth: 20 },
        {
          key: "value",
          header: "Value",
          flex: 1,
          minWidth: 15,
          color: (val, row) => {
            if (row.metric.includes("GPA")) {
              const num = parseFloat(val);
              if (isNaN(num)) return chalk.cyan.bold(val);
              return num >= 3.5
                ? chalk.green.bold(val)
                : num >= 3.0
                  ? chalk.cyan.bold(val)
                  : num >= 2.0
                    ? chalk.yellow.bold(val)
                    : chalk.red.bold(val);
            }
            return chalk.cyan.bold(val);
          },
        },
      ],
      { showRowNumbers: false, title: undefined },
    );

    summaryTable.addRows([
      { metric: "Courses with Grades", value: courseGrades.length.toString() },
      { metric: "Total Credits Counted", value: totalCredits.toString() },
      { metric: "Total Quality Points", value: totalQualityPoints.toFixed(2) },
      { metric: "Overall GPA (4.0 scale)", value: overallGPA.toFixed(3) },
    ]);

    summaryTable.render();

    // Show courses without grades if any
    if (coursesWithoutGrades.length > 0) {
      console.log();
      console.log(
        chalk.yellow.bold(
          `${coursesWithoutGrades.length} course(s) excluded (no grades available):`,
        ),
      );
      coursesWithoutGrades.forEach((courseName) => {
        console.log(chalk.gray(`   • ${courseName}`));
      });
      console.log(
        chalk.gray(
          "\nNote: These courses may be pending grade publication or have been completed",
        ),
      );
      console.log(chalk.gray("without final grades posted in Canvas."));
    }

    // GPA interpretation
    console.log();
    if (overallGPA >= 3.7) {
      console.log(
        chalk.green.bold("Outstanding! You're maintaining an excellent GPA!"),
      );
    } else if (overallGPA >= 3.3) {
      console.log(chalk.green("Great work! You're doing very well!"));
    } else if (overallGPA >= 3.0) {
      console.log(chalk.cyan("Good job! You're on the right track!"));
    } else if (overallGPA >= 2.7) {
      console.log(chalk.yellow("Keep working! There's room for improvement."));
    } else {
      console.log(
        chalk.yellow(
          "Stay focused! Consider reaching out for academic support.",
        ),
      );
    }

    printSeparator("=");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printError(`Error calculating GPA: ${errorMessage}`);
  }
}
