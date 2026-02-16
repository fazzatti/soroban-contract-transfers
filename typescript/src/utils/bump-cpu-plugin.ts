import { Plugin } from "convee";

import {
  P_SimulateTransaction,
  SimulateTransactionOutput,
} from "@colibri/core";

export type PluginOutput = SimulateTransactionOutput;
export const PLUGIN_NAME = "RESOURCE_BUMPER";
export type PluginOptions = {
  resource:
    | "instructions"
    | "disk_read_bytes"
    | "disk_write_bytes"
    | "resource_fee";
  bumpAmount: number;
};

const create = ({ resource, bumpAmount }: PluginOptions) => {
  const plugin = Plugin.create({
    name: PLUGIN_NAME,
    processOutput: async (input: PluginOutput): Promise<PluginOutput> => {
      switch (resource) {
        case "instructions": {
          const data = input.transactionData.build();

          input.transactionData.setResources(
            data.resources().instructions() + bumpAmount,
            data.resources().diskReadBytes(),
            data.resources().writeBytes(),
          );

          break;
        }
        case "disk_read_bytes":
        case "disk_write_bytes":
        case "resource_fee":
        default:
          throw new Error(`Unsupported resource type: ${resource}`);
      }

      return await { ...input };
    },
  });
  return plugin;
};

export const PLG_ResourceBumper = {
  create,
  name: PLUGIN_NAME,
  target: P_SimulateTransaction().name,
};
