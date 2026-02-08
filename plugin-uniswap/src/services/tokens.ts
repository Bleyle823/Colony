import { Token, ChainId } from '@uniswap/sdk-core';

// Define Chain ID (Ethereum Mainnet)
export const CHAIN_ID = ChainId.MAINNET;

export interface TokenConfig {
    [symbol: string]: Token;
}

// Common Tokens
export const ETH_TOKEN = new Token(
    CHAIN_ID,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Mainnet
    18,
    'WETH',
    'Wrapped Ether'
);

export const USDC_TOKEN = new Token(
    CHAIN_ID,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Mainnet
    6,
    'USDC',
    'USD Coin'
);

// RWA / xStocks Tokens
export const RWA_TOKENS: TokenConfig = {
    'MF-ONE': new Token(
        CHAIN_ID,
        '0x238a700eD6165261Cf8b2e544ba797BC11e466Ba',
        18,
        'mF-ONE',
        'mF-ONE Token'
    ),
    'AA_FalconXUSDC': new Token(
        CHAIN_ID,
        '0xC26A6Fa2C37b38E549a4a1807543801Db684f99C',
        18,
        'AA_FalconXUSDC',
        'AA_FalconXUSDC'
    ),
    'APPLON': new Token(
        CHAIN_ID,
        '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c',
        18,
        'APPLON',
        'Apple (Ondo Tokenized Stock)'
    ),
    'AAPLON': new Token(
        CHAIN_ID,
        '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c',
        18,
        'AAPLON',
        'Apple (Ondo Tokenized Stock)'
    ),
    'APPLE': new Token(
        CHAIN_ID,
        '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c',
        18,
        'APPLE',
        'Apple (Ondo Tokenized Stock)'
    ),
    'xAAPL': new Token(
        CHAIN_ID,
        '0x0000000000000000000000000000000000000002', // Placeholder
        18,
        'xAAPL',
        'Wrapped Apple'
    ),
    'xTSLA': new Token(
        CHAIN_ID,
        '0x0000000000000000000000000000000000000003', // Placeholder
        18,
        'xTSLA',
        'Wrapped Tesla'
    )
};    // Add more xStocks here


export const TOKENS: TokenConfig = {
    'ETH': ETH_TOKEN,
    'WETH': ETH_TOKEN,
    'USDC': USDC_TOKEN,
    ...RWA_TOKENS
};

export const getTokenBySymbol = (symbol: string): Token | undefined => {
    const normalizedSymbol = symbol.toUpperCase();
    return TOKENS[normalizedSymbol];
};
