import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  StellarAssetContract,
  TransactionConfig,
} from "@colibri/core";
import chalk from "chalk";
import { networkConfig } from "./config/env.ts";
import { saveToJsonFile } from "./utils/io.ts";
import { loadWasmFile } from "./utils/load-wasm.ts";
import { DeploymentData } from "./config/types.ts";

const admin = LocalSigner.generateRandom();
const usersToCreate = 100;

const XLM = StellarAssetContract.NativeXLM(networkConfig);

console.log(chalk.gray(`Funding admin: ${chalk.green(admin.publicKey())}`));
await initializeWithFriendbot(
  networkConfig.friendbotUrl as string,
  admin.publicKey(),
);

const txConfig: TransactionConfig = {
  source: admin.publicKey(),
  fee: "10000",
  signers: [admin],
  timeout: 45,
};

console.log(chalk.gray("Loading WASM..."));

const btWasm = await loadWasmFile("bulk_transfer");

const bulkTransfer = new Contract({
  networkConfig,
  contractConfig: { wasm: btWasm as any },
});

await bulkTransfer.loadSpecFromWasm();

console.log(chalk.gray("Uploading bulk transfer WASM..."));
await bulkTransfer.uploadWasm(txConfig);

console.log(chalk.gray("Deploying bulk transfer   ..."));
await bulkTransfer.deploy({
  config: txConfig,
});

console.log(`Bulk Transfer ID: ${chalk.green(bulkTransfer.getContractId())}`);

const abWasm = await loadWasmFile("auth_bypass");

const authBypass = new Contract({
  networkConfig,
  contractConfig: { wasm: abWasm as any },
});

await authBypass.loadSpecFromWasm();

console.log(chalk.gray("Uploading auth bypass WASM..."));
await authBypass.uploadWasm(txConfig);

const gusers = [];
const cUsers = [];
for (let i = 0; i < usersToCreate; i++) {
  console.log(chalk.gray(`Deploying auth bypass for c-user ${i}...`));

  const cAccount = new Contract({
    networkConfig,
    contractConfig: { wasm: abWasm as any, wasmHash: authBypass.getWasmHash() },
  });

  await cAccount.loadSpecFromWasm();

  await cAccount.deploy({
    config: {
      source: admin.publicKey(),
      fee: "10000",
      signers: [admin],
      timeout: 45,
    },
  });

  console.log(
    chalk.gray(
      `Deployed auth bypass for c-user ${i} at ${chalk.green(cAccount.getContractId())}`,
    ),
  );

  const dummyUser = LocalSigner.generateRandom();
  await initializeWithFriendbot(
    networkConfig.friendbotUrl as string,
    dummyUser.publicKey(),
  );

  await XLM.transfer({
    from: dummyUser.publicKey(),
    to: cAccount.getContractId(),
    amount: 10000000000n,
    config: {
      source: dummyUser.publicKey(),
      fee: "10000",
      signers: [dummyUser],
      timeout: 45,
    },
  });

  console.log(
    chalk.gray(
      `Funded auth bypass for c-user ${i} at ${chalk.green(cAccount.getContractId())}`,
    ),
  );

  cUsers.push(cAccount);

  console.log(chalk.gray(`Generating account for g-user ${i}...`));

  const user = LocalSigner.generateRandom();
  console.log(
    chalk.gray(`Funding user ${i}: ${chalk.green(user.publicKey())}`),
  );
  await initializeWithFriendbot(
    networkConfig.friendbotUrl as string,
    user.publicKey(),
  );
  gusers.push(user);
}

await saveToJsonFile<DeploymentData>(
  {
    bulkTransferId: bulkTransfer.getContractId(),
    gUsers: gusers.map((u) => u.secretKey()),
    cUsers: cUsers.map((c) => c.getContractId()),
  },
  "deployment",
);

console.log(chalk.blue(" Setup Complete"));
