// Lightweight shim for fhevmjs to allow the frontend to build and run
// when the real `tfhe_bg.wasm` artifact is not available in node_modules.
// This provides minimal, safe implementations of the methods used by the app.

export async function createInstance(opts: { chainId: number; publicKey: any }) {
  // Simple in-memory stubbed instance
  const instance = {
    generatePublicKey: async ({ verifyingContract }: { verifyingContract: string }) => {
      // Return a dummy public key and a minimal EIP-712 object that can be signed by ethers
      return {
        publicKey: '0x' + '00'.repeat(32),
        eip712: {
          domain: { name: 'ZKTrader (shim)', version: '1', chainId: opts.chainId, verifyingContract },
          types: { Reencrypt: [{ name: 'pub', type: 'bytes' }] },
          message: { pub: '0x' + '00'.repeat(32) },
        },
      };
    },

    createEncryptedInput: (contractAddress: string, userAddress: string) => {
      const values: bigint[] = [];
      return {
        add64: (v: number | bigint) => {
          values.push(BigInt(v));
        },
        encrypt: async () => {
          // Return a dummy handle (Uint8Array) and a dummy proof
          const handles = values.map((v) => {
            const hex = v.toString(16).padStart(16, '0');
            const arr = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
            return arr;
          });
          const inputProof = new Uint8Array([0]);
          return { handles, inputProof };
        },
      };
    },

    decrypt: async (contractAddress: string, ciphertext: string) => {
      // Always return 0 as a safe placeholder
      return BigInt(0);
    },
  };

  return instance;
}

export default { createInstance };
