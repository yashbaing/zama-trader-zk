/**
 * FHE Client Library
 *
 * This module handles ALL encryption and decryption operations on the client side.
 * Key principles:
 *   1. FHE keys are generated IN THE BROWSER — never sent to any server
 *   2. Values are encrypted before being sent to the blockchain
 *   3. Encrypted balances are decrypted locally after reencryption
 *   4. The backend and blockchain NEVER see plaintext user data
 *
 * Uses Zama's fhevmjs SDK for browser-compatible FHE operations.
 */

import { BrowserProvider } from "ethers";

// FHE instance type (from fhevmjs)
interface FheInstance {
  generatePublicKey: (opts: { verifyingContract: string }) => Promise<{
    publicKey: string;
    eip712: any;
  }>;
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string
  ) => {
    add64: (value: number | bigint) => any;
    encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
  };
  decrypt: (contractAddress: string, ciphertext: string) => Promise<bigint>;
}

let instance: FheInstance | null = null;

/**
 * Initialize the FHE instance for the connected user.
 *
 * This creates a browser-side FHE context that can:
 *   - Generate keypairs for reencryption requests
 *   - Encrypt values before sending to contracts
 *   - Decrypt reencrypted values returned from contracts
 *
 * The FHE public key for the NETWORK is fetched from the chain.
 * The user's PERSONAL keypair stays in the browser.
 */
export async function initFheClient(provider: BrowserProvider): Promise<FheInstance> {
  if (instance) return instance;

  try {
    // Try to import the real fhevmjs first, fall back to shim if it fails
    let createInstance;
    try {
      const fhevmjs = await import("fhevmjs");
      createInstance = fhevmjs.createInstance;
    } catch (shimError) {
      console.warn("[FHE] Real fhevmjs not available, using shim");
      const fhevmShim = await import("./fhevm-shim");
      createInstance = fhevmShim.createInstance;
    }

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Fetch the network's FHE public key from a well-known contract
    // On Zama's fhEVM, this is available at a precompiled address
    const FHE_LIB_ADDRESS = "0x000000000000000000000000000000000000005d";

    const publicKeyResponse = await provider.call({
      to: FHE_LIB_ADDRESS,
      data: "0xd9d47bb001", // getFhePubKey selector
    });

    instance = (await createInstance({
      chainId,
      publicKey: publicKeyResponse,
    })) as unknown as FheInstance;

    console.log("[FHE] Client initialized for chain", chainId);
    return instance;
  } catch (error) {
    console.error("[FHE] Initialization failed:", error);
    throw new Error("Failed to initialize FHE client. Is this a Zama fhEVM network?");
  }
}

/**
 * Encrypt a uint64 value for submission to a contract.
 *
 * USAGE EXAMPLE (placing an order):
 *   const { handles, inputProof } = await encryptValue(
 *     60000,                    // limit price: $60,000
 *     contractAddresses.orderBook,
 *     userAddress
 *   );
 *   // handles[0] is the encrypted price
 *   // inputProof proves the encryption is valid
 *
 * The contract receives (einput, bytes proof) and calls
 * TFHE.asEuint64(einput, proof) to verify and load the value.
 */
export async function encryptValue(
  value: number | bigint,
  contractAddress: string,
  userAddress: string
): Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }> {
  if (!instance) throw new Error("FHE client not initialized");

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  return input.encrypt();
}

/**
 * Encrypt multiple uint64 values in one batch.
 *
 * More efficient than encrypting individually — generates a single proof.
 * Used for order placement (encrypt price AND amount together).
 */
export async function encryptValues(
  values: (number | bigint)[],
  contractAddress: string,
  userAddress: string
): Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }> {
  if (!instance) throw new Error("FHE client not initialized");

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  for (const val of values) {
    input.add64(val);
  }
  return input.encrypt();
}

/**
 * Generate a reencryption keypair for viewing encrypted on-chain data.
 *
 * FLOW:
 *   1. Generate a fresh keypair in the browser
 *   2. Sign an EIP-712 message proving we own this keypair
 *   3. Send the public key to the contract's view function
 *   4. Contract reencrypts the data under our public key
 *   5. We decrypt the response locally with our private key
 *
 * The contract never sees the plaintext — it just re-encrypts
 * from the network key to our personal key.
 */
export async function generateReencryptionKeypair(
  contractAddress: string,
  provider: BrowserProvider
): Promise<{ publicKey: string; signature: string }> {
  if (!instance) throw new Error("FHE client not initialized");

  const { publicKey, eip712 } = await instance.generatePublicKey({
    verifyingContract: contractAddress,
  });

  const signer = await provider.getSigner();
  const signature = await signer.signTypedData(
    eip712.domain,
    { Reencrypt: eip712.types.Reencrypt },
    eip712.message
  );

  return { publicKey, signature };
}

/**
 * Decrypt a reencrypted value returned from a contract view function.
 *
 * The input is a bytes value that was reencrypted under our personal key.
 * Only our browser can decrypt this — no server, no other user.
 */
export async function decryptReencrypted(
  contractAddress: string,
  ciphertext: string
): Promise<bigint> {
  if (!instance) throw new Error("FHE client not initialized");
  return instance.decrypt(contractAddress, ciphertext);
}

/**
 * Get the current FHE instance (or null if not initialized).
 */
export function getFheInstance(): FheInstance | null {
  return instance;
}

/**
 * Reset the FHE instance (e.g., on wallet disconnect).
 */
export function resetFheClient(): void {
  instance = null;
}
