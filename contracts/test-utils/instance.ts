/**
 * Test Utilities — fhevmjs Instance Creation
 *
 * Creates fhevmjs instances for each test signer, enabling
 * encryption/decryption/reencryption in tests exactly as
 * the browser client does in production.
 */

import { createInstance, FhevmInstance } from "fhevmjs";
import { ethers, JsonRpcProvider, Signer } from "ethers";

const FHE_LIB_ADDRESS = "0x000000000000000000000000000000000000005d";

export interface TestInstances {
  [key: string]: FhevmInstance & {
    generateKeypair: () => { publicKey: string; privateKey: string };
    keypair: { publicKey: string; privateKey: string };
  };
}

/**
 * Create fhevmjs instances for all test signers.
 * Each instance shares the network public key but has its own
 * encryption context and keypair for reencryption.
 */
export async function createInstances(
  contractAddress: string,
  provider: JsonRpcProvider,
  signers: Record<string, Signer>
): Promise<TestInstances> {
  // Fetch the network's FHE public key
  const publicKeyResponse = await provider.call({
    to: FHE_LIB_ADDRESS,
    data: "0xd9d47bb001",
  });

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const instances: TestInstances = {};

  for (const [name, signer] of Object.entries(signers)) {
    const instance = await createInstance({
      chainId,
      publicKey: publicKeyResponse,
    });

    // Generate a reencryption keypair for this signer
    const keypair = instance.generateKeypair({ verifyingContract: contractAddress });

    instances[name] = Object.assign(instance, {
      generateKeypair: () => ({
        publicKey: keypair.publicKey,
        privateKey: keypair.eip712.message,
      }),
      keypair: {
        publicKey: keypair.publicKey,
        privateKey: keypair.eip712.message,
      },
    }) as any;
  }

  return instances;
}
