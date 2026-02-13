import { Buffer } from "buffer";
import { readFile } from "node:fs/promises";
import { wasmDir } from "../config/env.ts";
export const loadWasmFile = async (fileName: string): Promise<Buffer> => {
  try {
    const buffer = await readFile(`${wasmDir}${fileName}.wasm`);
    return buffer;
  } catch (error) {
    console.error(`Error reading the WASM file: ${error}`);
    throw error;
  }
};
