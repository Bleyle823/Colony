import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits,
    formatUnits,
    type WalletClient,
    type PublicClient,
    type Account,
    min
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { mainnet } from "viem/chains";
import { blueAbi } from "@morpho-org/blue-sdk-viem";
import { IAgentRuntime, elizaLogger } from "@elizaos/core";

// Constants from user request
const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MF_ONE_ADDRESS = "0x238a700eD6165261Cf8b2e544ba797BC11e466Ba";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ORACLE_ADDRESS = "0x0cB1928EcA8783F05a07D9Ae2AfB33f38BFBEb78";
const IRM_ADDRESS = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC";
const LLTV = 915000000000000000n; // 91.5% in 1e18 scale

// Market Params struct for Morpho
const MARKET_PARAMS = {
    loanToken: USDC_ADDRESS,
    collateralToken: MF_ONE_ADDRESS,
    oracle: ORACLE_ADDRESS,
    irm: IRM_ADDRESS,
    lltv: LLTV
};

// Minimal ERC20 ABI
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
    },
    {
        constant: false,
        inputs: [
            { name: "_spender", type: "address" },
            { name: "_value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
    },
];


export class MorphoService {
    private walletClient: WalletClient;
    private publicClient: PublicClient;
    private account: Account;

    constructor(private runtime: IAgentRuntime) { }

    async initialize() {
        const privateKey = this.runtime.getSetting("WALLET_PRIVATE_KEY") || this.runtime.getSetting("EVM_PRIVATE_KEY");
        if (!privateKey) throw new Error("WALLET_PRIVATE_KEY or EVM_PRIVATE_KEY is missing");

        this.account = privateKeyToAccount(privateKey as `0x${string}`);

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

    async supplyCollateral(amountStr: string): Promise<string> {
        // Amount is expected to be in standard units (e.g., "1.0" for 1 mF-ONE)
        // We need to fetch decimals first to be safe, or hardcode 18 for mF-ONE
        const decimals = await this.publicClient.readContract({
            address: MF_ONE_ADDRESS,
            abi: ERC20_ABI,
            functionName: "decimals"
        }) as number;

        const amount = parseUnits(amountStr, decimals);

        // Check balance
        const balance = await this.publicClient.readContract({
            address: MF_ONE_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [this.account.address]
        }) as bigint;

        if (balance < amount) {
            throw new Error(`Insufficient mF-ONE balance. You have ${formatUnits(balance, decimals)} mF-ONE but tried to supply ${amountStr}.`);
        }

        // 1. Approve
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

        // 2. Supply
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

    async borrow(amountStr: string): Promise<string> {
        // USDC has 6 decimals
        const decimals = await this.publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "decimals"
        }) as number;

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

    async repay(amountStr: string): Promise<string> {
        // repayment logic with full repayment support
        // For simplicity, we repay specific amount first, but we can implement "repay all" logic if needed by user later
        // But the user prompt example showed checking shares. 

        // 1. Get borrow shares
        const { borrowShares } = (await this.publicClient.readContract({
            address: MORPHO_ADDRESS,
            abi: blueAbi,
            functionName: "position",
            args: [this.getMarketId(), this.account.address]
        })) as { borrowShares: bigint };

        if (borrowShares === 0n) {
            throw new Error("No debt to repay");
        }

        const decimals = await this.publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "decimals"
        }) as number;

        // If amountStr is "all", we try to repay everything. 
        // However, calculating exact assets for shares requires more calls or we just approve a large amount and repay by shares.
        // User example code: repay(marketParams, 0, borrowShares, ...) to repay all using shares.

        let isFullRepayment = amountStr.toLowerCase() === "all";
        let amount = 0n;
        let sharesToRepay = 0n;

        if (isFullRepayment) {
            sharesToRepay = borrowShares;
            // approximate assets needed + buffer for approval
            const market = (await this.publicClient.readContract({
                address: MORPHO_ADDRESS,
                abi: blueAbi,
                functionName: "market",
                args: [this.getMarketId()]
            })) as any; // Using any for simplicity of structure access

            // Simple estimation: shares * totalBorrowAssets / totalBorrowShares
            // We'll just approve a large amount for now to be safe for the "all" case
            amount = 115792089237316195423570985008687907853269984665640564039457584007913129639935n; // Max Uint256
        } else {
            amount = parseUnits(amountStr, decimals);
            // When repaying specific amount, we pass assets.
        }

        // Approve
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
                args: [MARKET_PARAMS, 0n, sharesToRepay, this.account.address, "0x"], // 0 assets, specific shares
                account: this.account
            });
        } else {
            tx = await this.walletClient.writeContract({
                address: MORPHO_ADDRESS,
                abi: blueAbi,
                functionName: "repay",
                args: [MARKET_PARAMS, amount, 0n, this.account.address, "0x"], // specific assets, 0 shares
                account: this.account
            });
        }

        await this.publicClient.waitForTransactionReceipt({ hash: tx });
        elizaLogger.log(`Repayment confirmed: ${tx}`);
        return tx;
    }

    async withdrawCollateral(amountStr: string): Promise<string> {
        const decimals = await this.publicClient.readContract({
            address: MF_ONE_ADDRESS,
            abi: ERC20_ABI,
            functionName: "decimals"
        }) as number;

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
            const position = (await this.publicClient.readContract({
                address: MORPHO_ADDRESS,
                abi: blueAbi,
                functionName: "position",
                args: [this.getMarketId(), this.account.address]
            })) as any;

            // We need market data to convert shares to assets for display
            const market = (await this.publicClient.readContract({
                address: MORPHO_ADDRESS,
                abi: blueAbi,
                functionName: "market",
                args: [this.getMarketId()]
            })) as any;

            // Simple conversions (approximate for display)
            // Collateral is direct amount
            const collateral = formatUnits(position.collateral || 0n, 18); // assuming 18 for mF-ONE

            // Borrow assets = check morpho SDK for precise math, but roughly:
            // assets = shares * totalBorrowAssets / totalBorrowShares
            let borrowed = "0";
            if (market.totalBorrowShares > 0n && position.borrowShares > 0n) {
                const borrowedAssets = (position.borrowShares * market.totalBorrowAssets) / market.totalBorrowShares;
                borrowed = formatUnits(borrowedAssets, 6); // USDC
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

    private getMarketId(): `0x${string}` {
        // We can pre-calculate or just use the one provided by user if confident
        // 0xef2c308b5abecf5c8750a1aa82b47c558005feb7a03f4f8e1ad682d71ac8d0ba matches user request
        return "0xef2c308b5abecf5c8750a1aa82b47c558005feb7a03f4f8e1ad682d71ac8d0ba";
    }
}
