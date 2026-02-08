// src/actions/supply.ts
import {
  elizaLogger as elizaLogger2
} from "@elizaos/core";

// src/morphoService.ts
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { blueAbi } from "@morpho-org/blue-sdk-viem";
import { elizaLogger } from "@elizaos/core";
var MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
var MF_ONE_ADDRESS = "0x238a700eD6165261Cf8b2e544ba797BC11e466Ba";
var USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
var ORACLE_ADDRESS = "0x0cB1928EcA8783F05a07D9Ae2AfB33f38BFBEb78";
var IRM_ADDRESS = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC";
var LLTV = 915000000000000000n;
var MARKET_PARAMS = {
  loanToken: USDC_ADDRESS,
  collateralToken: MF_ONE_ADDRESS,
  oracle: ORACLE_ADDRESS,
  irm: IRM_ADDRESS,
  lltv: LLTV
};
var ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function"
  }
];
var MorphoService = class {
  constructor(runtime) {
    this.runtime = runtime;
  }
  walletClient;
  publicClient;
  account;
  async initialize() {
    const privateKey = this.runtime.getSetting("WALLET_PRIVATE_KEY") || this.runtime.getSetting("EVM_PRIVATE_KEY");
    if (!privateKey) throw new Error("WALLET_PRIVATE_KEY or EVM_PRIVATE_KEY is missing");
    this.account = privateKeyToAccount(privateKey);
    const rpcUrl = this.runtime.getSetting("ETHEREUM_RPC_URL") || this.runtime.getSetting("EVM_PROVIDER_URL");
    const transport = http(rpcUrl);
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport
    });
    this.walletClient = createWalletClient({
      account: this.account,
      chain: mainnet,
      transport
    });
  }
  async supplyCollateral(amountStr) {
    const decimals = await this.publicClient.readContract({
      address: MF_ONE_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals"
    });
    const amount = parseUnits(amountStr, decimals);
    const balance = await this.publicClient.readContract({
      address: MF_ONE_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [this.account.address]
    });
    if (balance < amount) {
      throw new Error(`Insufficient mF-ONE balance. You have ${formatUnits(balance, decimals)} mF-ONE but tried to supply ${amountStr}.`);
    }
    elizaLogger.log(`Approving ${amountStr} mF-ONE for Morpho...`);
    const approveTx = await this.walletClient.writeContract({
      address: MF_ONE_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MORPHO_ADDRESS, amount],
      account: this.account
    });
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
    elizaLogger.log(`Approval confirmed: ${approveTx}`);
    elizaLogger.log(`Supplying ${amountStr} mF-ONE to Morpho...`);
    const tx = await this.walletClient.writeContract({
      address: MORPHO_ADDRESS,
      abi: blueAbi,
      functionName: "supplyCollateral",
      args: [MARKET_PARAMS, amount, this.account.address, "0x"],
      account: this.account
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
    elizaLogger.log(`Supply confirmed: ${tx}`);
    return tx;
  }
  async borrow(amountStr) {
    const decimals = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals"
    });
    const amount = parseUnits(amountStr, decimals);
    elizaLogger.log(`Borrowing ${amountStr} USDC from Morpho...`);
    const tx = await this.walletClient.writeContract({
      address: MORPHO_ADDRESS,
      abi: blueAbi,
      functionName: "borrow",
      args: [MARKET_PARAMS, amount, 0n, this.account.address, this.account.address],
      account: this.account
    });
    await this.publicClient.waitForTransactionReceipt({ hash: tx });
    elizaLogger.log(`Borrow confirmed: ${tx}`);
    return tx;
  }
  async repay(amountStr) {
    const { borrowShares } = await this.publicClient.readContract({
      address: MORPHO_ADDRESS,
      abi: blueAbi,
      functionName: "position",
      args: [this.getMarketId(), this.account.address]
    });
    if (borrowShares === 0n) {
      throw new Error("No debt to repay");
    }
    const decimals = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals"
    });
    let isFullRepayment = amountStr.toLowerCase() === "all";
    let amount = 0n;
    let sharesToRepay = 0n;
    if (isFullRepayment) {
      sharesToRepay = borrowShares;
      const market = await this.publicClient.readContract({
        address: MORPHO_ADDRESS,
        abi: blueAbi,
        functionName: "market",
        args: [this.getMarketId()]
      });
      amount = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
    } else {
      amount = parseUnits(amountStr, decimals);
    }
    elizaLogger.log(`Approving USDC for repayment...`);
    const approveTx = await this.walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MORPHO_ADDRESS, amount],
      account: this.account
    });
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
    elizaLogger.log(`Repaying...`);
    let tx;
    if (isFullRepayment) {
      tx = await this.walletClient.writeContract({
        address: MORPHO_ADDRESS,
        abi: blueAbi,
        functionName: "repay",
        args: [MARKET_PARAMS, 0n, sharesToRepay, this.account.address, "0x"],
        // 0 assets, specific shares
        account: this.account
      });
    } else {
      tx = await this.walletClient.writeContract({
        address: MORPHO_ADDRESS,
        abi: blueAbi,
        functionName: "repay",
        args: [MARKET_PARAMS, amount, 0n, this.account.address, "0x"],
        // specific assets, 0 shares
        account: this.account
      });
    }
    await this.publicClient.waitForTransactionReceipt({ hash: tx });
    elizaLogger.log(`Repayment confirmed: ${tx}`);
    return tx;
  }
  async withdrawCollateral(amountStr) {
    const decimals = await this.publicClient.readContract({
      address: MF_ONE_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals"
    });
    const amount = parseUnits(amountStr, decimals);
    elizaLogger.log(`Withdrawing ${amountStr} mF-ONE...`);
    const tx = await this.walletClient.writeContract({
      address: MORPHO_ADDRESS,
      abi: blueAbi,
      functionName: "withdrawCollateral",
      args: [MARKET_PARAMS, amount, this.account.address, this.account.address],
      account: this.account
    });
    await this.publicClient.waitForTransactionReceipt({ hash: tx });
    elizaLogger.log(`Withdrawal confirmed: ${tx}`);
    return tx;
  }
  async getPosition() {
    if (!this.account) return null;
    try {
      const position = await this.publicClient.readContract({
        address: MORPHO_ADDRESS,
        abi: blueAbi,
        functionName: "position",
        args: [this.getMarketId(), this.account.address]
      });
      const market = await this.publicClient.readContract({
        address: MORPHO_ADDRESS,
        abi: blueAbi,
        functionName: "market",
        args: [this.getMarketId()]
      });
      const collateral = formatUnits(position.collateral || 0n, 18);
      let borrowed = "0";
      if (market.totalBorrowShares > 0n && position.borrowShares > 0n) {
        const borrowedAssets = position.borrowShares * market.totalBorrowAssets / market.totalBorrowShares;
        borrowed = formatUnits(borrowedAssets, 6);
      }
      return {
        collateral,
        borrowed,
        collateralToken: "mF-ONE",
        loanToken: "USDC"
      };
    } catch (error) {
      elizaLogger.error("Error getting position:", error);
      return null;
    }
  }
  getMarketId() {
    return "0xef2c308b5abecf5c8750a1aa82b47c558005feb7a03f4f8e1ad682d71ac8d0ba";
  }
};

// src/actions/supply.ts
var supplyCollateralAction = {
  name: "SUPPLY_COLLATERAL_MORPHO",
  similes: ["SUPPLY_MORPHO", "DEPOSIT_MORPHO_COLLATERAL", "ADD_COLLATERAL_MORPHO", "SUPPLY_COLLATERAL", "DEPOSIT_COLLATERAL", "SUPPLY_TOKENS_MORPHO"],
  description: "Supply mF-ONE collateral to Morpho Blue market",
  validate: async (runtime, _message) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY"));
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting supplyCollateralAction handler...");
    const content = message.content.text;
    if (!content) return false;
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    if (!amountMatch) {
      if (callback) {
        callback({
          text: "I couldn't identify the amount of mF-ONE to supply. Please specify explicitly, e.g., 'Supply 10 mF-ONE'."
        });
      }
      return false;
    }
    const amount = amountMatch[0];
    try {
      const service = new MorphoService(runtime);
      await service.initialize();
      if (callback) {
        callback({
          text: `Initiating supply of ${amount} mF-ONE to Morpho Blue...`
        });
      }
      const txHash = await service.supplyCollateral(amount);
      if (callback) {
        callback({
          text: `Successfully supplied ${amount} mF-ONE to Morpho Blue.
Transaction Hash: ${txHash}`
        });
      }
      return true;
    } catch (error) {
      elizaLogger2.error("Error in supplyCollateralAction:", error);
      if (callback) {
        callback({
          text: `Failed to supply collateral: ${error.message}`
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Supply 100 mF-ONE to Morpho" }
      },
      {
        user: "{{user2}}",
        content: { text: "I'll supply 100 mF-ONE as collateral to the Morpho Blue market for you." }
      }
    ]
  ]
};

// src/actions/borrow.ts
import {
  elizaLogger as elizaLogger3
} from "@elizaos/core";
var borrowAction = {
  name: "BORROW_MORPHO",
  similes: ["BORROW_USDC_MORPHO", "TAKE_LOAN_MORPHO"],
  description: "Borrow USDC from Morpho Blue market against mF-ONE collateral",
  validate: async (runtime, _message) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY"));
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.log("Starting borrowAction handler...");
    const content = message.content.text;
    if (!content) return false;
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    if (!amountMatch) {
      if (callback) {
        callback({
          text: "I couldn't identify the amount of USDC to borrow. Please specify, e.g., 'Borrow 50 USDC'."
        });
      }
      return false;
    }
    const amount = amountMatch[0];
    try {
      const service = new MorphoService(runtime);
      await service.initialize();
      if (callback) {
        callback({
          text: `Initiating borrow of ${amount} USDC from Morpho Blue...`
        });
      }
      const txHash = await service.borrow(amount);
      if (callback) {
        callback({
          text: `Successfully borrowed ${amount} USDC.
Transaction Hash: ${txHash}`
        });
      }
      return true;
    } catch (error) {
      elizaLogger3.error("Error in borrowAction:", error);
      if (callback) {
        callback({
          text: `Failed to borrow USDC: ${error.message}`
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Borrow 200 USDC from Morpho" }
      },
      {
        user: "{{user2}}",
        content: { text: "I'll borrow 200 USDC against your collateral on Morpho Blue." }
      }
    ]
  ]
};

// src/actions/repay.ts
import {
  elizaLogger as elizaLogger4
} from "@elizaos/core";
var repayAction = {
  name: "REPAY_MORPHO",
  similes: ["REPAY_LOAN_MORPHO", "PAY_BACK_MORPHO"],
  description: "Repay USDC loan on Morpho Blue market",
  validate: async (runtime, _message) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY"));
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger4.log("Starting repayAction handler...");
    const content = message.content.text;
    if (!content) return false;
    const isAll = content.toLowerCase().includes("all") || content.toLowerCase().includes("full");
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    let amount = "";
    if (isAll) {
      amount = "all";
    } else if (amountMatch) {
      amount = amountMatch[0];
    } else {
      if (callback) {
        callback({
          text: "I couldn't identify the amount to repay. Please specify 'all' or an amount, e.g., 'Repay 50 USDC'."
        });
      }
      return false;
    }
    try {
      const service = new MorphoService(runtime);
      await service.initialize();
      if (callback) {
        callback({
          text: `Initiating repayment of ${amount === "all" ? "full loan" : amount + " USDC"} to Morpho Blue...`
        });
      }
      const txHash = await service.repay(amount);
      if (callback) {
        callback({
          text: `Successfully repaid ${amount === "all" ? "loan" : amount + " USDC"}.
Transaction Hash: ${txHash}`
        });
      }
      return true;
    } catch (error) {
      elizaLogger4.error("Error in repayAction:", error);
      if (callback) {
        callback({
          text: `Failed to repay loan: ${error.message}`
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Repay all my debt on Morpho" }
      },
      {
        user: "{{user2}}",
        content: { text: "I'll repay your full USDC debt on Morpho Blue." }
      }
    ]
  ]
};

// src/actions/withdraw.ts
import {
  elizaLogger as elizaLogger5
} from "@elizaos/core";
var withdrawCollateralAction = {
  name: "WITHDRAW_COLLATERAL_MORPHO",
  similes: ["WITHDRAW_MORPHO", "REMOVE_COLLATERAL_MORPHO"],
  description: "Withdraw mF-ONE collateral from Morpho Blue market",
  validate: async (runtime, _message) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY"));
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger5.log("Starting withdrawCollateralAction handler...");
    const content = message.content.text;
    if (!content) return false;
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    if (!amountMatch) {
      if (callback) {
        callback({
          text: "I couldn't identify the amount of mF-ONE to withdraw. Please specify, e.g., 'Withdraw 10 mF-ONE'."
        });
      }
      return false;
    }
    const amount = amountMatch[0];
    try {
      const service = new MorphoService(runtime);
      await service.initialize();
      if (callback) {
        callback({
          text: `Initiating withdrawal of ${amount} mF-ONE from Morpho Blue...`
        });
      }
      const txHash = await service.withdrawCollateral(amount);
      if (callback) {
        callback({
          text: `Successfully withdrawn ${amount} mF-ONE.
Transaction Hash: ${txHash}`
        });
      }
      return true;
    } catch (error) {
      elizaLogger5.error("Error in withdrawCollateralAction:", error);
      if (callback) {
        callback({
          text: `Failed to withdraw collateral: ${error.message}`
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Withdraw 50 mF-ONE from Morpho" }
      },
      {
        user: "{{user2}}",
        content: { text: "I'll withdraw 50 mF-ONE collateral from Morpho Blue for you." }
      }
    ]
  ]
};

// src/providers/morphoProvider.ts
var morphoProvider = {
  get: async (runtime, _message, _state) => {
    try {
      const service = new MorphoService(runtime);
      await service.initialize();
      const position = await service.getPosition();
      if (!position) {
        return "Morpho Blue: No active position or wallet not configured.";
      }
      return `Morpho Blue Position (mF-ONE/USDC):
- Collateral: ${position.collateral} ${position.collateralToken}
- Borrowed: ${position.borrowed} ${position.loanToken}
`;
    } catch (error) {
      return `Morpho Blue: Error fetching position (${error instanceof Error ? error.message : "Unknown error"})`;
    }
  }
};

// src/index.ts
var morphoPlugin = {
  name: "morpho-ethereum",
  description: "Morpho Blue integration (Ethereum mainnet) for supplying collateral and borrowing assets",
  actions: [
    supplyCollateralAction,
    borrowAction,
    repayAction,
    withdrawCollateralAction
  ],
  providers: [morphoProvider]
};
export {
  morphoPlugin
};
