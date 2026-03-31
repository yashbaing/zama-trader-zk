import { ethers } from "hardhat";
import { Signer } from "ethers";

export interface TestSigners {
  deployer: Signer;
  alice: Signer;
  bob: Signer;
  carol: Signer;
  relayer: Signer;
}

export async function getSigners(): Promise<TestSigners> {
  const signers = await ethers.getSigners();
  return {
    deployer: signers[0],
    alice: signers[1],
    bob: signers[2],
    carol: signers[3],
    relayer: signers[4],
  };
}
