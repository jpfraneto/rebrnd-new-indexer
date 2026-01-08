import { createConfig } from "ponder";

import { BRNDSEASON1Abi } from "./abis/BRNDSEASON1";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453!,
    },
  },

  // database: {
  //   kind: "postgres",
  //   connectionString: process.env.DATABASE_URL!,
  // },
  contracts: {
    BRNDSEASON1: {
      chain: "base",
      abi: BRNDSEASON1Abi,
      address: process.env.CONTRACT_ADDRESS as `0x${string}`,
      startBlock: parseInt(process.env.START_BLOCK || "0"),
    },
  },
});
