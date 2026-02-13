import { ContractId, Ed25519SecretKey } from "@colibri/core";

export type DeploymentData = {
  bulkTransferId: ContractId;
  gUsers: Ed25519SecretKey[];
  cUsers: ContractId[];
};
