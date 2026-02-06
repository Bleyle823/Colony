import { Service, IAgentRuntime, logger } from "@elizaos/core";
import {
  createPublicClient,
  createWalletClient,
  http,
  WalletClient,
  type PublicClient,
  parseUnits,
  isAddress,
} from "viem";
import { base, baseSepolia, mainnet } from "viem/chains";
import { AccrualPosition, MarketParams, MarketId } from "@morpho-org/blue-sdk";
import { Time } from "@morpho-org/morpho-ts";
import "@morpho-org/blue-sdk-viem/lib/augment"; // augment MarketParams for .fetch

import BigNumber from "bignumber.js";
import {
  MorphoMarketData,
  MorphoVaultData,
  MarketSummary,
  UserPosition,
  UserVaultPosition
} from "../types";
import {
  Q_MARKETS,
  Q_VAULTS,
  Q_USER_MARKET_POSITIONS,
  Q_USER_VAULT_POSITIONS,
  Q_VAULT_BY_ADDRESS,
  Q_MARKET_SUMMARY
} from "./queries";

// Helper function to check if input is a valid Market ID (bytes32 hex string)
// Helper function to check if input is a valid Market ID (bytes32 hex string)
function isKnownMarketId(id: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(id);
}

export class MorphoService extends Service {
  private gql = {
    query: async <T>(query: string, variables: any = {}) => {
      const response = await fetch("https://blue-api.morpho.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const json: any = await response.json();
      if (json.errors) {
        // Log or throw? Throwing is safer for debugging.
        throw new Error(`Morpho GQL Error: ${JSON.stringify(json.errors)}`);
      }
      return json.data as T;
    },
  };

  private KNOWN_TOKENS: Record<string, string> = {
    "MF-ONE": "0x238a700eD6165261Cf8b2e544ba797BC11e466Ba",
    "AA_FALCONXUSDC": "0xC26A6Fa2C37b38E549a4a1807543801Db684f99C",
    "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  };

  private async getMarketId(input: string): Promise<string> {
    return isKnownMarketId(input) ? input : this.resolveMarketIdFromPair(input);
  }

  private async resolveMarketIdFromPair(pair: string): Promise<string> {
    const part = pair.trim().split("/");
    if (part.length !== 2) {
      throw new Error(
        `Invalid pair "${pair}". Expected "Collateral/Loan", e.g. "cbBTC/USDC".`
      );
    }
    const [cSym, lSym] = part.map((s) => s.trim());

    // Check known tokens
    const cKnown = this.KNOWN_TOKENS[cSym?.toUpperCase()];
    const lKnown = this.KNOWN_TOKENS[lSym?.toUpperCase()];

    const chainId = this.getChainId();
    const markets = await this.fetchMarketsFromApi(chainId);

    const match = markets.find((m) => {
      const cValid =
        (cKnown && m.collateralAsset?.address?.toLowerCase() === cKnown.toLowerCase()) ||
        m.collateralAsset?.symbol?.toLowerCase() === cSym.toLowerCase();

      const lValid =
        (lKnown && m.loanAsset?.address?.toLowerCase() === lKnown.toLowerCase()) ||
        m.loanAsset?.symbol?.toLowerCase() === lSym.toLowerCase();

      return cValid && lValid;
    });

    if (!match) {
      throw new Error(
        `No Morpho market found for pair "${pair}" on chain ${chainId}.`
      );
    }
    return match.uniqueKey;
  }

  private async fetchMarketsFromApi(chainId: number): Promise<any[]> {
    const data = await this.gql.query<{ markets: { items: any[] } }>(
      Q_MARKETS,
      {
        chainIds: [chainId],
        first: 1000,
      }
    );
    const items = data?.markets?.items ?? [];
    return items;
  }

  private async fetchVaultsFromApi(chainId: number): Promise<any[]> {
    const data = await this.gql.query<{ vaults: { items: any[] } }>(Q_VAULTS, {
      chainIds: [chainId],
      first: 1000,
    });
    return data?.vaults?.items ?? [];
  }

  private async fetchPositionsFromApi(
    address: `0x${string}`,
    chainId: number
  ): Promise<string[]> {
    const data = await this.gql.query<{
      userByAddress?: {
        marketPositions?: { market?: { uniqueKey?: string } }[];
      };
    }>(Q_USER_MARKET_POSITIONS, { chainId, address });
    const items = data?.userByAddress?.marketPositions ?? [];
    return items
      .map((p) => p?.market?.uniqueKey)
      .filter((x): x is string => typeof x === "string");
  }

  // ----------------------------
  // Mapping helpers
  // ----------------------------
  private mapMarketSummary(m: any): MarketSummary {
    return {
      marketId: m.uniqueKey,
      lltvPct: Number(m.lltv) / 1e16,
      totalSupplyUsd: m.state?.supplyAssetsUsd ?? 0,
      totalBorrowUsd: m.state?.borrowAssetsUsd ?? 0,
      totalLiquidityUsd: m.state?.liquidityAssetsUsd ?? 0,
      supplyRatePct: pct(m.state?.supplyApy ?? 0),
      borrowRatePct: pct(m.state?.borrowApy ?? 0),
      utilization: m.state?.utilization ?? 0,
      loanAsset: {
        address: m.loanAsset?.address ?? "0x",
        symbol: m.loanAsset?.symbol ?? "UNKNOWN",
        decimals: m.loanAsset?.decimals ?? 18,
      },
      collateralAsset: {
        address: m.collateralAsset?.address ?? "0x",
        symbol: m.collateralAsset?.symbol ?? "UNKNOWN",
        decimals: m.collateralAsset?.decimals ?? 18,
      },
    };
  }

  private mapVault(v: any): MorphoVaultData {
    const dec = Number(v?.asset?.decimals ?? 18);
    const totalAssets = fromBaseUnits(v?.state?.totalAssets ?? "0", dec);
    const totalSupply =
      v?.state?.totalSupply != null ? bn(v.state.totalSupply) : null;

    return {
      address: v?.address,
      name: v?.name ?? "UNKNOWN",
      asset: {
        address: v?.asset?.address ?? "0x",
        symbol: v?.asset?.symbol ?? "UNKNOWN",
        decimals: dec,
      },
      totalDepositsTokens: totalAssets,
      totalDepositsUsd:
        v?.state?.totalAssetsUsd != null ? bn(v.state.totalAssetsUsd) : null,
      totalSupplyShares: totalSupply,
      apy: {
        apy: typeof v?.state?.apy === "number" ? v.state.apy : null,
        daily: typeof v?.state?.dailyApy === "number" ? v.state.dailyApy : null,
        weekly:
          typeof v?.state?.weeklyApy === "number" ? v.state.weeklyApy : null,
        monthly:
          typeof v?.state?.monthlyApy === "number" ? v.state.monthlyApy : null,
        yearly:
          typeof v?.state?.yearlyApy === "number" ? v.state.yearlyApy : null,
      },
    };
  }

  private mapVaultAllocations(out: MorphoVaultData, v: any) {
    if (!v?.state?.allocation?.length) return out;
    const dec = out.asset.decimals;
    out.allocations = (v.state.allocation as any[]).map((a) => ({
      marketId: a?.market?.uniqueKey ?? "",
      supplyAssetsTokens: fromBaseUnits(a?.supplyAssets ?? "0", dec),
      supplyAssetsUsd:
        a?.supplyAssetsUsd != null ? bn(a.supplyAssetsUsd) : null,
      supplyCapTokens:
        a?.supplyCap != null ? fromBaseUnits(a.supplyCap, dec) : null,
    }));
    return out;
  }

  // ----------------------------
  // Resolvers
  // ----------------------------
  private async resolveVaultAddress(vault: string): Promise<`0x${string}`> {
    const q = vault.trim().toLowerCase();
    const chainId = this.getChainId();
    const items = await this.fetchVaultsFromApi(chainId);

    if (isAddress(q)) return q as `0x${string}`;

    const byNameExact = items.find(
      (v: any) => (v?.name ?? "").toLowerCase() === q
    );
    if (byNameExact?.address) return byNameExact.address as `0x${string}`;

    const byNameContains = items.find((v: any) =>
      (v?.name ?? "").toLowerCase().includes(q)
    );
    if (byNameContains?.address) return byNameContains.address as `0x${string}`;

    throw new Error(
      `No whitelisted Morpho vault found for "${vault}" on chainId ${chainId}.`
    );
  }

  // ----------------------------
  // Public API
  // ----------------------------
  async getMarketData(market?: string): Promise<MorphoMarketData[]> {
    this.ensurePublicClient();
    const out: MorphoMarketData[] = [];

    // Single market path: on-chain LIF + summary
    if (market) {
      try {
        const marketId = await this.getMarketId(market);
        const [summary, params] = await Promise.all([
          this.fetchMarketSummaryById(marketId),
          MarketParams.fetch(marketId as MarketId, this.publicClient!),
        ]);

        const symbol = `${summary.collateralAsset.symbol} / ${summary.loanAsset.symbol}`;
        const liquidationPenalty =
          (Number(params.liquidationIncentiveFactor) / 1e18 - 1) * 100;

        out.push({
          name: symbol,
          marketId,
          totalSupply: bn(summary.totalSupplyUsd),
          totalBorrow: bn(summary.totalBorrowUsd),
          supplyRate: summary.supplyRatePct,
          borrowRate: summary.borrowRatePct,
          utilizationRate: summary.utilization,
          liquidity: bn(summary.totalLiquidityUsd),
          decimals: summary.loanAsset.decimals,
          lltv: summary.lltvPct,
          liquidationPenalty,
        });
      } catch (err) {
        logger.warn(`Error fetching market ${market}: ${err}`);
      }
      return out;
    }

    // All markets path: single GraphQL call + inline filters
    try {
      const items = await this.fetchMarketsFromApi(this.getChainId());
      for (const m of items) {
        const cSym = (m?.collateralAsset?.symbol ?? "").trim();
        const lSym = (m?.loanAsset?.symbol ?? "").trim();
        if (
          !cSym ||
          !lSym ||
          cSym.toUpperCase() === "UNKNOWN" ||
          lSym.toUpperCase() === "UNKNOWN"
        )
          continue;

        const lltv = Number(m?.lltv ?? 0);
        if (!Number.isFinite(lltv) || lltv <= 0) continue;

        const size = Number(m?.state?.supplyAssetsUsd ?? 0);
        if (!Number.isFinite(size) || size < 25_000) continue;

        const borrowApy = Number(m?.state?.borrowApy ?? 0);
        if (!Number.isFinite(borrowApy) || borrowApy < 0) continue;
        if (borrowApy > 2.0 && size < 1_000_000) continue;

        const symbol = `${cSym} / ${lSym}`;
        const lltvPct = Number(m.lltv) / 1e16;
        const totalSupplyUsd = m?.state?.supplyAssetsUsd ?? 0;
        const totalBorrowUsd = m?.state?.borrowAssetsUsd ?? 0;
        const totalLiquidityUsd = m?.state?.liquidityAssetsUsd ?? 0;

        out.push({
          name: symbol,
          marketId: m.uniqueKey,
          totalSupply: bn(totalSupplyUsd),
          totalBorrow: bn(totalBorrowUsd),
          supplyRate: pct(m?.state?.supplyApy ?? 0),
          borrowRate: pct(m?.state?.borrowApy ?? 0),
          utilizationRate: m?.state?.utilization ?? 0,
          liquidity: bn(totalLiquidityUsd),
          decimals: m?.loanAsset?.decimals ?? 18,
          lltv: lltvPct,
          liquidationPenalty: NaN,
        });
      }
    } catch (err) {
      logger.warn(`Error fetching all markets: ${err}`);
    }
    return out;
  }

  async getUserPositions(market?: string): Promise<UserPosition[]> {
    this.ensurePublicClient();
    const wallet = this.ensureWalletClient();

    const address = wallet.account?.address;
    if (!address) throw new Error("Wallet account address is required");

    if (market?.trim()) {
      const marketId = await this.getMarketId(market);
      const result = await this.buildUserPosition(address, marketId);
      return [result];
    }

    const chainId = this.getChainId();
    const positions = await this.fetchPositionsFromApi(address, chainId);

    const BATCH_SIZE = 8;
    const results: UserPosition[] = [];

    for (let i = 0; i < positions.length; i += BATCH_SIZE) {
      const batch = positions.slice(i, i + BATCH_SIZE);
      const out = await Promise.all(
        batch.map((id) => this.buildUserPosition(address, id).catch(() => null))
      );
      for (const r of out) if (r?.hasPosition) results.push(r);
    }

    return results;
  }

  public async getVaultData(vault?: string): Promise<MorphoVaultData[]> {
    this.ensurePublicClient();
    const chainId = this.getChainId();

    // Single vault
    if (vault?.trim()) {
      const address = await this.resolveVaultAddress(vault);
      const data = await this.gql.query<{ vaultByAddress?: any }>(
        Q_VAULT_BY_ADDRESS,
        {
          address,
          chainId,
        }
      );
      const v = data?.vaultByAddress;
      if (!v) return [];
      const out = this.mapVault(v);
      return [this.mapVaultAllocations(out, v)];
    }

    // All vaults
    const items = await this.fetchVaultsFromApi(chainId);
    return items.map(this.mapVault);
  }

  public async getUserVaultPositions(): Promise<UserVaultPosition[]> {
    const address = this.runtime.getSetting(
      "MORPHO_USER_ADDRESS"
    ) as `0x${string}`;
    if (!address) throw new Error("MORPHO_USER_ADDRESS is required");

    const data = await this.gql.query<{
      userByAddress?: { vaultPositions?: any[] };
    }>(Q_USER_VAULT_POSITIONS, { chainId: this.getChainId(), address });

    const raw = data?.userByAddress?.vaultPositions ?? [];
    return raw.map((vp: any) => ({
      vault: {
        address: vp?.vault?.address,
        name: vp?.vault?.name,
        asset: {
          address: vp?.vault?.asset?.address,
          symbol: vp?.vault?.asset?.symbol,
          decimals: vp?.vault?.asset?.decimals ?? 18,
        },
        state: {
          dailyApy: vp?.vault?.state?.dailyApy ?? null,
          weeklyApy: vp?.vault?.state?.weeklyApy ?? null,
          monthlyApy: vp?.vault?.state?.monthlyApy ?? null,
          yearlyApy: vp?.vault?.state?.yearlyApy ?? null,
        },
      },
      shares: String(vp?.shares ?? "0"),
      assets: String(vp?.assets ?? "0"),
    }));
  }

  public async getMarketSummary(market: string): Promise<MarketSummary> {
    const uniqueKey = await this.getMarketId(market);
    return this.fetchMarketSummaryById(uniqueKey);
  }

  private async fetchMarketSummaryById(
    uniqueKey: string
  ): Promise<MarketSummary> {
    const data = await this.gql.query<{ marketByUniqueKey?: any }>(
      Q_MARKET_SUMMARY,
      {
        uniqueKey,
        chainId: this.getChainId(),
      }
    );
    const m = data?.marketByUniqueKey;
    if (!m)
      throw new Error(
        `Market ${uniqueKey} not found on chainId ${this.getChainId()}`
      );
    return this.mapMarketSummary(m);
  }

  // ----------------------------
  // Pricing & positions
  // ----------------------------
  async fetchDexScreenerData(tokenAddress: string): Promise<{
    priceUsd: number;
    liquidityUsd: number;
    volumeUsd24h: number;
    marketCap: number;
  } | null> {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`DEX Screener request failed: ${response.status}`);
        return null;
      }
      const data: any = await response.json();
      const p = data?.pairs?.[0];
      if (!p) return null;
      return {
        priceUsd: parseFloat(p.priceUsd || "0"),
        liquidityUsd: parseFloat(p.liquidity?.usd || "0"),
        volumeUsd24h: parseFloat(p.volume?.h24 || "0"),
        marketCap: parseFloat(p.fdv || "0"),
      };
    } catch (error) {
      logger.warn("Failed to fetch from DEX Screener:", error);
      return null;
    }
  }

  private async buildUserPosition(
    address: `0x${string}`,
    marketId: string
  ): Promise<UserPosition> {
    const pc = this.ensurePublicClient();

    const raw = await AccrualPosition.fetch(address, marketId as MarketId, pc);
    const pos = raw.accrueInterest(Time.timestamp());

    const summary = await this.fetchMarketSummaryById(marketId);
    const collMeta = summary.collateralAsset;
    const loanMeta = summary.loanAsset;

    const collDecimals = Number(collMeta.decimals ?? 18);
    const loanDecimals = Number(loanMeta.decimals ?? 18);

    const borrowAssetsBase: bigint = (pos as any).borrowAssets ?? 0n;
    const collateralBase: bigint = (pos as any).collateral ?? 0n;

    const loanTokens = fromBaseUnits(borrowAssetsBase, loanDecimals);
    const collateralTokens = fromBaseUnits(collateralBase, collDecimals);

    const LLTV = summary.lltvPct / 100;

    let pLiqLoanPerColl: BigNumber | null = null;
    if (collateralTokens.gt(0) && LLTV > 0) {
      pLiqLoanPerColl = loanTokens.div(collateralTokens.times(LLTV));
    }

    const [loanPx, collPx] = await Promise.all([
      this.fetchDexScreenerData(loanMeta.address).catch(() => null),
      this.fetchDexScreenerData(collMeta.address).catch(() => null),
    ]);

    const loanUsdPx =
      loanPx?.priceUsd ?? (loanMeta.symbol.toUpperCase() === "USDC" ? 1 : null);
    const collUsdPx = collPx?.priceUsd ?? null;

    const loanUsd = loanUsdPx != null ? loanTokens.times(loanUsdPx) : null;
    const collUsd =
      collUsdPx != null ? collateralTokens.times(collUsdPx) : null;

    const pCurrLoanPerColl =
      loanUsdPx != null && collUsdPx != null
        ? bn(collUsdPx).div(loanUsdPx)
        : null;

    const ltvPct =
      pCurrLoanPerColl && collateralTokens.gt(0)
        ? loanTokens
          .div(collateralTokens.times(pCurrLoanPerColl))
          .times(100)
          .toNumber()
        : null;

    const dropToLiqPct =
      pLiqLoanPerColl && pCurrLoanPerColl
        ? pLiqLoanPerColl.div(pCurrLoanPerColl).minus(1).times(100).toNumber()
        : null;

    const borrowShares: bigint = (pos as any).borrowShares ?? 0n;
    const supplyShares: bigint = (pos as any).supplyShares ?? 0n;
    const collateralRaw: bigint = (pos as any).collateral ?? 0n;

    // Calculate supply information (lending position)
    const supplyAssetsBase: bigint = (pos as any).supplyAssets ?? 0n;
    const suppliedTokens = fromBaseUnits(supplyAssetsBase, loanDecimals);
    const suppliedUsd =
      loanUsdPx != null ? suppliedTokens.times(loanUsdPx) : null;

    // For simplicity, assume withdrawable = supplied (in practice, market liquidity may limit this)
    const withdrawableTokens = suppliedTokens;

    // Calculate earned interest (simplified - would need historical data for accurate calculation)
    const hasSupplied = supplyShares > 0n || suppliedTokens.gt(0);
    const earnedInterest = hasSupplied
      ? suppliedTokens.times(0.001).toString(10)
      : null; // Rough estimate

    const hasAmounts =
      collateralTokens.gt(0) || loanTokens.gt(0) || suppliedTokens.gt(0);
    const hasRaw = borrowShares > 0n || supplyShares > 0n || collateralRaw > 0n;
    const hasPosition = hasRaw || hasAmounts;

    return {
      marketId,
      pairLabel: `${collMeta.symbol}/${loanMeta.symbol}`,
      symbols: { collateral: collMeta.symbol, loan: loanMeta.symbol },
      decimals: { collateral: collDecimals, loan: loanDecimals },
      amounts: {
        collateralTokens: collateralTokens.toString(10),
        loanTokens: loanTokens.toString(10),
        collateralUsd: collUsd ? collUsd.toString(10) : null,
        loanUsd: loanUsd ? loanUsd.toString(10) : null,
        // Supply (lending) amounts
        suppliedTokens: suppliedTokens.toString(10),
        suppliedUsd: suppliedUsd ? suppliedUsd.toString(10) : null,
        withdrawableTokens: withdrawableTokens.toString(10),
      },
      shares: {
        borrowShares: borrowShares.toString(),
        supplyShares: supplyShares.toString(),
      },
      prices: {
        collateralUsd: collUsdPx,
        loanUsd: loanUsdPx,
        liquidationLoanPerCollateral: pLiqLoanPerColl
          ? pLiqLoanPerColl.toString(10)
          : null,
        currentLoanPerCollateral: pCurrLoanPerColl
          ? pCurrLoanPerColl.toString(10)
          : null,
      },
      risk: {
        lltvPct: summary.lltvPct,
        ltvPct,
        dropToLiquidationPct: dropToLiqPct,
      },
      addresses: {
        collateral: collMeta.address as `0x${string}`,
        loan: loanMeta.address as `0x${string}`,
        user: address as `0x${string}`,
      },
      supply: {
        hasSupplied,
        earnedInterest,
        currentApy: hasSupplied ? summary.supplyRatePct : null,
      },
      hasPosition,
    };
  }

  private async readVaultMeta(vaultAddr: `0x${string}`): Promise<{
    asset: `0x${string}`;
    assetDecimals: number;
    shareDecimals: number;
  }> {
    const pc = this.ensurePublicClient();
    const [asset, shareDecimals] = await Promise.all([
      pc.readContract({
        address: vaultAddr,
        abi: ERC4626_ABI,
        functionName: "asset",
      }) as Promise<`0x${string}`>,
      pc.readContract({
        address: vaultAddr,
        abi: ERC4626_ABI,
        functionName: "decimals",
      }) as Promise<number>,
    ]);

    // Try to use your GraphQL decimals first (you often have them), otherwise read ERC20.decimals
    let assetDecimals: number;
    try {
      assetDecimals = Number(
        await pc.readContract({
          address: asset,
          abi: [
            {
              type: "function",
              name: "decimals",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "uint8" }],
            },
          ],
          functionName: "decimals",
        })
      );
    } catch {
      // Fallback to 18, but on Base USDC is 6 — best effort only
      assetDecimals = 18;
    }

    return { asset, assetDecimals, shareDecimals };
  }

  private chainObj() {
    if (this.network === "mainnet") return mainnet;
    return this.network === "base" ? base : baseSepolia;
  }
  private getChainId(): number {
    if (this.network === "mainnet") return 1;
    return this.network === "base" ? 8453 : 84532;
  }
  public getChainSlug(): "base" | "base-sepolia" | "mainnet" {
    return this.network;
  }
  private network: "base" | "base-sepolia" | "mainnet";

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.network =
      (runtime.getSetting("MORPHO_NETWORK") as "base" | "base-sepolia" | "mainnet") ||
      "mainnet";
  }

  public async depositToVault(
    params: {
      vault?: string;
      assets?: string | number | bigint;
      approveAmount?: "exact" | "max";
      receiver?: `0x${string}`;
    } = {}
  ): Promise<`0x${string}`[]> {
    console.log("--- MorphoService.depositToVault: start ---");
    try {
      const wallet = this.ensureWalletClient();
      const pc = this.ensurePublicClient();

      const cfg = {
        vault: params.vault ?? "",
        assets: params.assets ?? "1",
        approveAmount: params.approveAmount ?? ("max" as const),
        receiver: params.receiver,
      };

      console.log("Network:", this.getChainSlug());
      console.log("Account:", wallet.account?.address);
      console.log(
        "Input -> vault:",
        cfg.vault,
        "assets:",
        cfg.assets,
        "approveAmount:",
        cfg.approveAmount
      );

      const {
        requests,
        asset,
        vault,
        assetsBase,
        expectedShares,
        shareDecimals,
      } = await this.buildVaultDepositTx(cfg);

      console.log("Prepared", requests.length, "request(s).");
      console.log("Vault:", vault);
      console.log("Asset:", asset);
      console.log("Assets (base units):", assetsBase.toString());
      if (expectedShares !== undefined) {
        console.log(
          "Expected shares:",
          expectedShares.toString(),
          shareDecimals != null ? `(shareDecimals=${shareDecimals})` : ""
        );
      }

      const hashes: `0x${string}`[] = [];
      for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const label = `[${i + 1}/${requests.length}] ${String(req.functionName || "write")}`;
        console.log(`${label} -> sending...`);
        try {
          const hash = await wallet.writeContract({
            ...req,
            account: wallet.account,
          } as any);
          console.log(`${label} -> tx sent: ${hash}`);
          const receipt = await pc.waitForTransactionReceipt({
            hash,
            pollingInterval: 2_000,
            timeout: 120_000,
          });
          console.log(
            `${label} -> mined. blockNumber=${receipt.blockNumber} status=${receipt.status}`
          );
          hashes.push(hash);
        } catch (txErr: any) {
          console.error(`${label} -> FAILED`);
          console.error(
            "Message:",
            txErr?.shortMessage || txErr?.message || txErr
          );
          if (txErr?.data?.message)
            console.error("Revert reason:", txErr.data.message);
          if (txErr?.cause) console.error("Cause:", txErr.cause);
          throw txErr;
        }
      }

      console.log("All transactions confirmed. Hashes:", hashes);
      return hashes;
    } catch (err: any) {
      console.error(
        "depositToVault failed:",
        err?.shortMessage || err?.message || err
      );
      throw err;
    } finally {
      console.log("--- MorphoService.depositToVault: end ---");
    }
  }

  public async withdrawFromVault(
    params: {
      vault?: string;
      assets?: string | number | bigint;
      receiver?: `0x${string}`;
      owner?: `0x${string}`;
    } = {}
  ): Promise<`0x${string}`[]> {
    console.log("--- MorphoService.withdrawFromVault: start ---");
    try {
      const wallet = this.ensureWalletClient();
      const pc = this.ensurePublicClient();

      const cfg = {
        vault: params.vault ?? "",
        assets: params.assets ?? "1",
        receiver: params.receiver,
        owner: params.owner,
      };

      console.log("Network:", this.getChainSlug());
      console.log("Account:", wallet.account?.address);
      console.log("Input -> vault:", cfg.vault, "assets:", cfg.assets);

      const { requests, vault, assetsBase } = await this.buildVaultWithdrawTx({
        vault: cfg.vault,
        assets: cfg.assets,
        receiver: cfg.receiver,
        owner: cfg.owner,
      });

      console.log("Prepared", requests.length, "request(s) for withdraw.");
      console.log("Vault:", vault);
      console.log("Assets to withdraw (base units):", assetsBase.toString());

      const hashes: `0x${string}`[] = [];
      for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const label = `[${i + 1}/${requests.length}] ${String(req.functionName || "write")}`;
        console.log(`${label} -> sending...`);
        try {
          const hash = await wallet.writeContract({
            ...req,
            account: wallet.account,
          } as any);
          console.log(`${label} -> tx sent: ${hash}`);
          const receipt = await pc.waitForTransactionReceipt({
            hash,
            pollingInterval: 2_000,
            timeout: 120_000,
          });
          console.log(
            `${label} -> mined. blockNumber=${receipt.blockNumber} status=${receipt.status}`
          );
          hashes.push(hash);
        } catch (txErr: any) {
          console.error(`${label} -> FAILED`);
          console.error(
            "Message:",
            txErr?.shortMessage || txErr?.message || txErr
          );
          if (txErr?.data?.message)
            console.error("Revert reason:", txErr.data.message);
          if (txErr?.cause) console.error("Cause:", txErr.cause);
          throw txErr;
        }
      }

      console.log("All withdraw transactions confirmed. Hashes:", hashes);
      return hashes;
    } catch (err: any) {
      console.error(
        "withdrawFromVault failed:",
        err?.shortMessage || err?.message || err
      );
      throw err;
    } finally {
      console.log("--- MorphoService.withdrawFromVault: end ---");
    }
  }

  public async buildVaultDepositTx(params: {
    vault: string;
    assets: string | number | bigint;
    receiver?: `0x${string}`;
    approveAmount?: "exact" | "max";
  }): Promise<{
    requests: any[];
    asset: `0x${string}`;
    vault: `0x${string}`;
    assetsBase: bigint;
    expectedShares?: bigint;
    shareDecimals?: number;
  }> {
    const pc = this.ensurePublicClient();

    const receiver =
      params.receiver ??
      (this.runtime.getSetting("MORPHO_USER_ADDRESS") as `0x${string}`);
    if (!receiver)
      throw new Error("MORPHO_USER_ADDRESS (or receiver) is required");

    const vaultAddr = await this.resolveVaultAddress(params.vault);

    const { asset, assetDecimals, shareDecimals } =
      await this.readVaultMeta(vaultAddr);

    const assetsBase = parseUnits(String(params.assets), assetDecimals);

    const currentAllowance = (await pc.readContract({
      address: asset,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [receiver, vaultAddr],
    })) as bigint;

    const needsApproval = currentAllowance < assetsBase;
    const approveAmount =
      params.approveAmount === "max" ? 2n ** 256n - 1n : assetsBase;

    const requests: any[] = [];

    if (needsApproval) {
      const { request: approveReq } = await pc.simulateContract({
        address: asset,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddr, approveAmount],
        account: receiver,
      });
      requests.push(approveReq);

      let expectedShares: bigint | undefined = undefined;
      try {
        expectedShares = (await pc.readContract({
          address: vaultAddr,
          abi: ERC4626_ABI,
          functionName: "previewDeposit",
          args: [assetsBase],
        })) as bigint;
      } catch {
        /* some vaults may not implement preview */
      }

      requests.push({
        address: vaultAddr,
        abi: ERC4626_ABI,
        functionName: "deposit" as const,
        args: [assetsBase, receiver],
        account: receiver,
      });

      return {
        requests,
        asset,
        vault: vaultAddr,
        assetsBase,
        expectedShares,
        shareDecimals,
      };
    }

    let expectedShares: bigint | undefined = undefined;
    try {
      expectedShares = (await pc.readContract({
        address: vaultAddr,
        abi: ERC4626_ABI,
        functionName: "previewDeposit",
        args: [assetsBase],
      })) as bigint;
    } catch { }

    const { request: depositReq } = await pc.simulateContract({
      address: vaultAddr,
      abi: ERC4626_ABI,
      functionName: "deposit",
      args: [assetsBase, receiver],
      account: receiver,
    });
    requests.push(depositReq);

    return {
      requests,
      asset,
      vault: vaultAddr,
      assetsBase,
      expectedShares,
      shareDecimals,
    };
  }

  public async buildVaultWithdrawTx(params: {
    vault: string;
    assets: string | number | bigint;
    receiver?: `0x${string}`;
    owner?: `0x${string}`;
  }): Promise<{ requests: any[]; vault: `0x${string}`; assetsBase: bigint }> {
    const pc = this.ensurePublicClient();
    const chainId = this.getChainId();

    const fallback = this.runtime.getSetting(
      "MORPHO_USER_ADDRESS"
    ) as `0x${string}`;
    const receiver = params.receiver ?? fallback;
    const owner = params.owner ?? fallback;
    if (!receiver || !owner)
      throw new Error("MORPHO_USER_ADDRESS (or receiver/owner) is required");

    const vaultAddr = await this.resolveVaultAddress(params.vault);

    const data = await this.gql.query<{ vaultByAddress?: any }>(
      Q_VAULT_BY_ADDRESS,
      {
        address: vaultAddr,
        chainId,
      }
    );
    const v = data?.vaultByAddress;
    if (!v)
      throw new Error(`Vault ${params.vault} not found on chainId ${chainId}`);
    const decimals = Number(
      v.asset?.decimals ??
      (await pc.readContract({
        address: vaultAddr,
        abi: ERC4626_ABI,
        functionName: "decimals",
      }))
    );

    const assetsBase = parseUnits(String(params.assets), decimals);

    const { request } = await pc.simulateContract({
      address: vaultAddr,
      abi: ERC4626_ABI,
      functionName: "withdraw",
      args: [assetsBase, receiver, owner],
      account: owner,
    });

    return { requests: [request], vault: vaultAddr, assetsBase };
  }
}

const bn = (x: string | number | bigint) => new BigNumber(String(x));
const pow10 = (d: number) => new BigNumber(10).pow(d);
const fromBaseUnits = (x: string | number | bigint, decimals: number) =>
  bn(x).div(pow10(decimals));
const pct = (v: number) => v * 100;
const isAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim());
const isMarketId = (s: string) => /^0x[a-fA-F0-9]{64}$/.test(s.trim());

// ----------------------------
// GraphQL Client
// ----------------------------
class GqlClient {
  constructor(private url: string) { }
  async query<T>(query: string, variables: Record<string, any>): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GQL ${res.status} ${res.statusText}: ${txt}`);
    }
    const json = (await res.json()) as any;
    if (json?.errors?.length) {
      throw new Error(`GQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data as T;
  }
}

// --- Minimal ABIs ---
const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
];

const ERC4626_ABI = [
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "previewDeposit",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

// Morpho Blue ABI (minimal)
const MORPHO_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },

  {
    type: "function",
    name: "supplyCollateral",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },

  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },

  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },

  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },

  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },

  {
    type: "function",
    name: "expectedBorrowAssets",
    stateMutability: "view",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

