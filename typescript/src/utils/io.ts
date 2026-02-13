import chalk from "chalk";
import { outputDir } from "../config/env.ts";

export const saveToJsonFile = async <T>(obj: T, fileName: string) => {
  const filePath = `${outputDir}/${fileName}.json`;

  try {
    await Deno.mkdir(outputDir, { recursive: true });
    await Deno.writeTextFile(filePath, JSON.stringify(obj, null, 2));
    console.log(`Saved to ${chalk.green(filePath)}`);
  } catch (error) {
    console.error(chalk.red(`Error saving JSON to ${filePath}:`), error);
    throw error;
  }
};

export const readFromJsonFile = async <T>(fileName: string): Promise<T> => {
  const filePath = `${outputDir}/${fileName}.json`;

  try {
    const data = await Deno.readTextFile(filePath);
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(chalk.red(`Error reading JSON from ${filePath}:`), error);
    throw error;
  }
};
