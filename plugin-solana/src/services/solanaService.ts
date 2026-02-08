import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { IAgentRuntime, Service, ServiceType, elizaLogger } from '@elizaos/core';
import { validateSolanaConfig, SolanaConfig } from '../environment';

/**
 * SolanaService
 * 
 * Handles Solana blockchain operations including SOL and SPL token transfers,
 * wallet management, and balance queries.
 */
export class SolanaService extends Service {
  static serviceType: ServiceType = 'solana_service';

  private connection: Connection | null = null;
  private wallet: Keypair | null = null;
  private config: SolanaConfig | null = null;

  // Common token addresses
  private readonly USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  private readonly USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

  async initialize(runtime: IAgentRuntime): Promise<void> {
    try {
      this.config = await validateSolanaConfig(runtime);
      
      this.connection = new Connection(
        this.config.SOLANA_RPC_URL,
        this.config.SOLANA_COMMITMENT
      );

      // Initialize wallet from private key
      const privateKeyBytes = this.parsePrivateKey(this.config.SOLANA_PRIVATE_KEY);
      this.wallet = Keypair.fromSecretKey(privateKeyBytes);

      elizaLogger.info('SolanaService initialized successfully');
      elizaLogger.info(`Wallet address: ${this.wallet.publicKey.toString()}`);
    } catch (error) {
      elizaLogger.error('Failed to initialize SolanaService:', error);
      throw error;
    }
  }

  /**
   * Get SOL balance for the wallet
   */
  async getSolBalance(address?: string): Promise<number> {
    if (!this.connection) {
      throw new Error('Solana service not initialized');
    }

    const publicKey = address ? new PublicKey(address) : this.wallet!.publicKey;
    const balance = await this.connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(tokenMint: string, address?: string): Promise<number> {
    if (!this.connection || !this.wallet) {
      throw new Error('Solana service not initialized');
    }

    try {
      const publicKey = address ? new PublicKey(address) : this.wallet.publicKey;
      const mintPublicKey = new PublicKey(tokenMint);

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mintPublicKey,
        publicKey
      );

      const accountInfo = await getAccount(this.connection, tokenAccount.address);
      return Number(accountInfo.amount) / Math.pow(10, 6); // Assuming 6 decimals for USDC/USDT
    } catch (error) {
      elizaLogger.error('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Send SOL to another address
   */
  async sendSol(toAddress: string, amount: number): Promise<string> {
    if (!this.connection || !this.wallet) {
      throw new Error('Solana service not initialized');
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet]
    );

    elizaLogger.info(`SOL transfer completed: ${signature}`);
    return signature;
  }

  /**
   * Send SPL tokens (like USDC) to another address
   */
  async sendToken(
    tokenMint: string,
    toAddress: string,
    amount: number
  ): Promise<string> {
    if (!this.connection || !this.wallet) {
      throw new Error('Solana service not initialized');
    }

    const mintPublicKey = new PublicKey(tokenMint);
    const toPublicKey = new PublicKey(toAddress);

    // Get or create associated token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      mintPublicKey,
      this.wallet.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      mintPublicKey,
      toPublicKey
    );

    // Convert amount to token units (assuming 6 decimals)
    const tokenAmount = amount * Math.pow(10, 6);

    const signature = await transfer(
      this.connection,
      this.wallet,
      fromTokenAccount.address,
      toTokenAccount.address,
      this.wallet,
      tokenAmount
    );

    elizaLogger.info(`Token transfer completed: ${signature}`);
    return signature;
  }

  /**
   * Get USDC balance specifically
   */
  async getUsdcBalance(address?: string): Promise<number> {
    return this.getTokenBalance(this.USDC_MINT.toString(), address);
  }

  /**
   * Send USDC specifically
   */
  async sendUsdc(toAddress: string, amount: number): Promise<string> {
    return this.sendToken(this.USDC_MINT.toString(), toAddress, amount);
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet.publicKey.toString();
  }

  /**
   * Parse private key from various formats
   */
  private parsePrivateKey(privateKey: string): Uint8Array {
    try {
      // Remove any whitespace
      privateKey = privateKey.trim();

      // If it's a JSON array string
      if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        const keyArray = JSON.parse(privateKey);
        return new Uint8Array(keyArray);
      }

      // If it's a base58 string
      if (privateKey.length === 88) {
        // Use a base58 decoder if available, or handle as needed
        throw new Error('Base58 private key format not yet supported');
      }

      // If it's a hex string
      if (privateKey.startsWith('0x')) {
        privateKey = privateKey.slice(2);
      }
      
      if (privateKey.length === 128) {
        const bytes = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
          bytes[i] = parseInt(privateKey.substr(i * 2, 2), 16);
        }
        return bytes;
      }

      throw new Error('Unsupported private key format');
    } catch (error) {
      elizaLogger.error('Error parsing private key:', error);
      throw new Error('Invalid private key format');
    }
  }
}

export const solanaService = new SolanaService();