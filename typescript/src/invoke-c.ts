import {
  Contract,
  LocalSigner,
  NativeAccount,
  SIM_ERRORS,
  StellarAssetContract,
} from "@colibri/core";
import chalk from "chalk";
import { networkConfig } from "./config/env.ts";
import { readFromJsonFile } from "./utils/io.ts";
import { loadWasmFile } from "./utils/load-wasm.ts";
import { DeploymentData } from "./config/types.ts";
import { nativeToScVal, Operation, xdr } from "stellar-sdk";
import { getArgs } from "./utils/get-args.ts";
import { BypassSigner } from "./utils/custom-signer.ts";
import { PLG_ResourceBumper } from "./utils/bump-cpu-plugin.ts";

const [fnInput, countInput] = await getArgs(2);

enum functionNames {
  OneToOne = "one_to_one",
  OneToMany = "one_to_many",
  ManyToMany = "many_to_many",
  ManyToOne = "many_to_one",
}

if (!Object.values(functionNames).includes(fnInput as functionNames)) {
  throw new Error(
    `Invalid function name. Must be one of: ${Object.values(functionNames).join(
      ", ",
    )}`,
  );
}

const fnName = fnInput as functionNames;
const count = parseInt(countInput, 10);

const {
  bulkTransferId,
  gUsers: usersSecrets,
  cUsers: users,
} = await readFromJsonFile<DeploymentData>("deployment");

const admin: LocalSigner = LocalSigner.fromSecret(usersSecrets[0]);

const asset = StellarAssetContract.NativeXLM(networkConfig);
const amount = BigInt(Math.floor(Math.random() * 10) + 1); // between 1 and 10 stroops

const assetScVal = nativeToScVal(asset.contractId, { type: "address" });
const amountScVal = nativeToScVal(amount, { type: "i128" });

const signers: BypassSigner[] = [];
for (const user of users) {
  const signer = new BypassSigner(LocalSigner.fromSecret(admin.secretKey()));
  signer.addTarget(user);
  signers.push(signer);
}

let args: xdr.ScVal[] = [];

switch (fnName) {
  case functionNames.OneToOne: {
    const to = users.pop();
    const from = users.pop();
    if (!from || !to) throw new Error("Not enough users for OneToOne");
    const fromScVal = nativeToScVal(from, { type: "address" });
    const toScVal = nativeToScVal(to, { type: "address" });
    args = [
      assetScVal,
      fromScVal,
      toScVal,
      amountScVal,
      nativeToScVal(count, { type: "u32" }),
    ];

    break;
  }

  case functionNames.OneToMany: {
    const from = users.pop();
    if (!from) throw new Error("Not enough users for OneToMany");
    const fromScVal = nativeToScVal(from, { type: "address" });
    const tos: xdr.ScVal[] = [];
    for (let i = 0; i < count; i++) {
      const u = users.pop();
      if (!u) throw new Error("Not enough users for OneToMany targets");
      tos.push(nativeToScVal(u, { type: "address" }));
    }
    const toScVal = xdr.ScVal.scvVec(tos);
    args = [assetScVal, fromScVal, toScVal, amountScVal];
    break;
  }
  case functionNames.ManyToMany: {
    const froms: xdr.ScVal[] = [];
    const tos: xdr.ScVal[] = [];
    for (let i = 0; i < count; i++) {
      const u = users.pop();
      if (!u) throw new Error("Not enough users for ManyToMany (from)");
      froms.push(nativeToScVal(u, { type: "address" }));
    }
    for (let i = 0; i < count; i++) {
      const u = users.pop();
      if (!u) throw new Error("Not enough users for ManyToMany (to)");
      tos.push(nativeToScVal(u, { type: "address" }));
    }
    const fromScVal = xdr.ScVal.scvVec(froms);
    const toScVal = xdr.ScVal.scvVec(tos);
    args = [assetScVal, fromScVal, toScVal, amountScVal];
    break;
  }
  case functionNames.ManyToOne: {
    const froms: xdr.ScVal[] = [];
    for (let i = 0; i < count; i++) {
      const u = users.pop();
      if (!u) throw new Error("Not enough users for ManyToOne (from)");
      froms.push(nativeToScVal(u, { type: "address" }));
    }
    const to = users.pop();
    if (!to) throw new Error("Not enough users for ManyToOne (to)");
    const fromScVal = xdr.ScVal.scvVec(froms);
    const toScVal = nativeToScVal(to, { type: "address" });
    args = [assetScVal, fromScVal, toScVal, amountScVal];
    break;
  }
  default:
    throw new Error("Invalid function name");
}

const wasm = await loadWasmFile("bulk_transfer");
const bulkTransfer = new Contract({
  networkConfig,
  contractConfig: {
    wasm: wasm as any,
    contractId: bulkTransferId,
  },
});

await bulkTransfer.loadSpecFromWasm();

//
// const result = await bulkTransfer
//   .invokeRaw({
//     operationArgs: {
//       function: fnName,
//       args: args,
//     },
//     config: {
//       source: admin.publicKey(),
//       fee: "100000000",
//       signers: [admin, ...signers],
//       timeout: 45,
//     },
//   })
//   .catch((e) => {
//     // console.error(
//     //   "Error during bulk transfer(): ",
//     //   (e as SIM_ERRORS.SIMULATION_FAILED).meta.data.input.transaction.toXDR(),
//     // );
//     console.error("Error during bulk transfer(): ", e);
//     throw e;
//   });

const operation = Operation.invokeContractFunction({
  function: fnName,
  args: args,
  contract: bulkTransferId,
});

// Manually bumping the CPU as the simulation always set it shorter than the actual execution,
// causing the fee estimation to be off and the transaction to fail due to exceeding resource usage.
const pluginCPU = PLG_ResourceBumper.create({
  resource: "instructions",
  bumpAmount: 20000000,
});

bulkTransfer.invokePipe.addPlugin(pluginCPU, PLG_ResourceBumper.target);

const result = await bulkTransfer.invokePipe
  .run({
    operations: [operation],
    config: {
      source: admin.publicKey(),
      fee: "100000000",
      signers: [admin, ...signers],
      timeout: 45,
    },
  })
  .catch((e) => {
    // console.error(
    //   "Error during bulk transfer(): ",
    //   (e as SIM_ERRORS.SIMULATION_FAILED).meta.data.input.transaction.toXDR(),
    // );
    console.error("Error during bulk transfer(): ", e);
    throw e;
  });

console.log(chalk.bgGreen.black("\n=== Complete ==="));
console.log("tx hash: ", result.hash);
