/*
A custom signer that assembles the auth entry with the given nonce and expiration ledger.
but does not actually sign the invocation, since the bypass-auth contract does not require signatures.
*/

import {
  LocalSigner,
  Signer,
  ContractId,
  Ed25519PublicKey,
} from "@colibri/core";

import { xdr } from "stellar-sdk";

export class BypassSigner implements Signer {
  private signer: LocalSigner;
  constructor(signer: LocalSigner) {
    this.signer = signer;
  }

  signSorobanAuthEntry(
    authEntry: xdr.SorobanAuthorizationEntry,
    validUntilLedgerSeq: number,
    _networkPassphrase: string,
  ): Promise<xdr.SorobanAuthorizationEntry> {
    // const randomNonce = new xdr.Int64(
    //   Math.floor(Math.random() * 100000000000000000),
    // );

    const bypassAuthEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: authEntry.credentials().address().address(),
          nonce: authEntry.credentials().address().nonce(),
          signatureExpirationLedger: Number(validUntilLedgerSeq),
          signature: xdr.ScVal.scvVoid(), // Placeholder, no signature is required for this contract
        }),
      ),
      rootInvocation: authEntry.rootInvocation(),
    });

    return Promise.resolve(bypassAuthEntry);
  }

  publicKey(): Ed25519PublicKey {
    return this.signer.publicKey();
  }

  sign: typeof this.signer.sign = (data) => {
    return this.signer.sign(data);
  };

  signTransaction: typeof this.signer.signTransaction = (transaction) => {
    return this.signer.signTransaction(transaction);
  };

  signsFor(target: Ed25519PublicKey | ContractId): boolean {
    return this.signer.signsFor(target);
  }

  addTarget(target: Ed25519PublicKey | ContractId): void {
    this.signer.addTarget(target);
  }
}
