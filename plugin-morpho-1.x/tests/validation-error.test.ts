import { describe, it, expect } from 'bun:test';
import BigNumber from 'bignumber.js';

describe('Validation and Error Handling Tests', () => {
    describe('Input Validation', () => {
        it('should validate asset symbols', () => {
            const validAssets = ['USDC', 'WETH', 'DAI', 'USDT'];
            const invalidAssets = ['', null, undefined, 'TOOLONGASSETNAME', '123', 'usdc', 'A'];

            validAssets.forEach(asset => {
                expect(typeof asset).toBe('string');
                expect(asset.length).toBeGreaterThan(0);
                expect(asset).toMatch(/^[A-Z]{2,10}$/);
            });

            invalidAssets.forEach(asset => {
                if (typeof asset === 'string') {
                    const isValid = asset.length > 0 && /^[A-Z]{2,10}$/.test(asset);
                    expect(isValid).toBe(false);
                } else {
                    expect(asset).toBeNil();
                }
            });
        });

        it('should validate Ethereum addresses', () => {
            const validAddresses = [
                '0x742d35Cc6574C0532C3C07A4c5Eb821Fe8667b67',
                '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                '0x4200000000000000000000000000000000000006'
            ];

            const invalidAddresses = [
                '742d35Cc6574C0532C3C07A4c5Eb821Fe8667b67', // Missing 0x
                '0x742d35Cc6574C0532C3C07A4c5Eb821Fe8667b6', // Too short
                '0x742d35Cc6574C0532C3C07A4c5Eb821Fe8667b677', // Too long
                '0xGGGd35Cc6574C0532C3C07A4c5Eb821Fe8667b67', // Invalid characters
                '', // Empty
                null, // Null
                undefined // Undefined
            ];

            validAddresses.forEach(address => {
                expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            });

            invalidAddresses.forEach(address => {
                if (typeof address === 'string') {
                    const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
                    expect(isValid).toBe(false);
                } else {
                    expect(address).toBeNil();
                }
            });
        });

        it('should validate market IDs', () => {
            const validMarketIds = [
                '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc',
                '0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad'
            ];

            const invalidMarketIds = [
                'b323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc', // Missing 0x
                '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86c', // Too short
                '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86ccc', // Too long
                '0xG323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc', // Invalid character
                ''
            ];

            validMarketIds.forEach(marketId => {
                expect(marketId).toMatch(/^0x[a-fA-F0-9]{64}$/);
            });

            invalidMarketIds.forEach(marketId => {
                if (typeof marketId === 'string') {
                    const isValid = /^0x[a-fA-F0-9]{64}$/.test(marketId);
                    expect(isValid).toBe(false);
                } else {
                    expect(marketId).toBeNil();
                }
            });
        });

        it('should validate transaction hashes', () => {
            const validTxHashes = [
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            ];

            const invalidTxHashes = [
                '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Missing 0x
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // Too short
                '0xG234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' // Invalid character
            ];

            validTxHashes.forEach(hash => {
                expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
            });

            invalidTxHashes.forEach(hash => {
                const isValid = /^0x[a-fA-F0-9]{64}$/.test(hash);
                expect(isValid).toBe(false);
            });
        });
    });

    describe('Amount Validation', () => {
        it('should validate positive BigNumber amounts', () => {
            const validAmounts = [
                new BigNumber(1),
                new BigNumber(100.5),
                new BigNumber('1000000000000000000'), // 1e18
                new BigNumber('0.000001')
            ];

            validAmounts.forEach(amount => {
                expect(amount).toBeInstanceOf(BigNumber);
                expect(amount.isPositive()).toBe(true);
                expect(amount.isFinite()).toBe(true);
                expect(amount.isNaN()).toBe(false);
            });
        });

        it('should reject invalid amounts', () => {
            const invalidAmounts = [
                new BigNumber(-1),
                new BigNumber(NaN),
                new BigNumber(Infinity)
            ];

            invalidAmounts.forEach(amount => {
                expect(amount).toBeInstanceOf(BigNumber);
                const isValid = amount.isPositive() && amount.isFinite() && !amount.isNaN();
                expect(isValid).toBe(false);
            });
        });

        it('should validate amount precision for different assets', () => {
            // USDC has 6 decimals
            const usdcAmount = new BigNumber('1000.123456');
            expect(usdcAmount.decimalPlaces()).toBeLessThanOrEqual(6);

            // WETH has 18 decimals  
            const wethAmount = new BigNumber('1.123456789012345678');
            expect(wethAmount.decimalPlaces()).toBeLessThanOrEqual(18);

            // Check decimal precision limits
            const overPreciseUsdc = new BigNumber('1000.1234567'); // 7 decimals for USDC
            expect(overPreciseUsdc.decimalPlaces()).toBeGreaterThan(6);
        });

        it('should validate amount ranges', () => {
            const tooSmallAmount = new BigNumber('0.000000001'); // Less than 1 wei
            const reasonableAmount = new BigNumber('100');
            const veryLargeAmount = new BigNumber('999999999999999999999999999999');

            expect(tooSmallAmount.isPositive()).toBe(true);
            expect(reasonableAmount.isPositive()).toBe(true);
            expect(veryLargeAmount.isPositive()).toBe(true);

            // Check if amounts are within reasonable bounds
            expect(reasonableAmount.isLessThan('1e30')).toBe(true);
            expect(veryLargeAmount.isLessThan('1e30')).toBe(true);
        });
    });

    describe('Gas Parameter Validation', () => {
        it('should validate gas limits', () => {
            const validGasLimits = [
                new BigNumber(21000), // Minimum for ETH transfer
                new BigNumber(100000),
                new BigNumber(500000),
                new BigNumber(1000000)
            ];

            const invalidGasLimits = [
                new BigNumber(0),
                new BigNumber(-1000),
                new BigNumber(30000000), // Too high
                new BigNumber(NaN)
            ];

            validGasLimits.forEach(gasLimit => {
                expect(gasLimit.isPositive()).toBe(true);
                expect(gasLimit.isGreaterThanOrEqualTo(21000)).toBe(true);
                expect(gasLimit.isLessThan(15000000)).toBe(true); // Block gas limit
            });

            invalidGasLimits.forEach(gasLimit => {
                if (!gasLimit.isNaN()) {
                    const isValid = gasLimit.isPositive() && 
                                   gasLimit.isGreaterThanOrEqualTo(21000) && 
                                   gasLimit.isLessThan(15000000);
                    expect(isValid).toBe(false);
                } else {
                    expect(gasLimit.isNaN()).toBe(true);
                }
            });
        });

        it('should validate gas prices', () => {
            const validGasPrices = [
                new BigNumber('1000000000'), // 1 gwei
                new BigNumber('20000000000'), // 20 gwei
                new BigNumber('100000000000') // 100 gwei
            ];

            const invalidGasPrices = [
                new BigNumber(0),
                new BigNumber(-1),
                new BigNumber('1000000000000000') // Extremely high
            ];

            validGasPrices.forEach(gasPrice => {
                expect(gasPrice.isGreaterThan(0)).toBe(true);
                expect(gasPrice.isLessThan('500000000000')).toBe(true); // 500 gwei max
            });

            invalidGasPrices.forEach(gasPrice => {
                // Use proper validation: must be > 0 and < 500 gwei
                const isValid = gasPrice.isGreaterThan(0) && gasPrice.isLessThan('500000000000');
                expect(isValid).toBe(false);
            });
        });
    });

    describe('Ratio and Percentage Validation', () => {
        it('should validate matching efficiency ratios', () => {
            const validRatios = [0, 0.25, 0.5, 0.7, 0.85, 1.0];
            const invalidRatios = [-0.1, 1.1, NaN, Infinity, -Infinity];

            validRatios.forEach(ratio => {
                expect(ratio).toBeGreaterThanOrEqual(0);
                expect(ratio).toBeLessThanOrEqual(1);
                expect(Number.isFinite(ratio)).toBe(true);
            });

            invalidRatios.forEach(ratio => {
                const isValid = ratio >= 0 && ratio <= 1 && Number.isFinite(ratio);
                expect(isValid).toBe(false);
            });
        });

        it('should validate APY percentages', () => {
            const validAPYs = [0, 0.5, 2.5, 5.0, 15.0, 25.0];
            const invalidAPYs = [-1, 100, 500, NaN, Infinity];

            validAPYs.forEach(apy => {
                expect(apy).toBeGreaterThanOrEqual(0);
                expect(apy).toBeLessThan(50); // Reasonable upper bound
                expect(Number.isFinite(apy)).toBe(true);
            });

            invalidAPYs.forEach(apy => {
                const isValid = apy >= 0 && apy < 50 && Number.isFinite(apy);
                expect(isValid).toBe(false);
            });
        });

        it('should validate utilization rates', () => {
            const validUtilizations = [0, 0.1, 0.5, 0.8, 0.95, 1.0];
            const invalidUtilizations = [-0.1, 1.1, 2.0, NaN, Infinity];

            validUtilizations.forEach(util => {
                expect(util).toBeGreaterThanOrEqual(0);
                expect(util).toBeLessThanOrEqual(1);
            });

            invalidUtilizations.forEach(util => {
                const isValid = util >= 0 && util <= 1 && Number.isFinite(util);
                expect(isValid).toBe(false);
            });
        });
    });

    describe('Health Factor Validation', () => {
        it('should classify health factor levels correctly', () => {
            const healthyFactors = [2.0, 1.8, 1.5, 1.21];
            const riskyFactors = [1.1, 1.05, 1.01];
            const unhealthyFactors = [0.99, 0.8, 0.5, 0];

            healthyFactors.forEach(hf => {
                expect(hf).toBeGreaterThan(1.2);
                expect(isHealthy(hf)).toBe(true);
            });

            riskyFactors.forEach(hf => {
                expect(hf).toBeGreaterThan(1.0);
                expect(hf).toBeLessThanOrEqual(1.2);
                expect(isRisky(hf)).toBe(true);
            });

            unhealthyFactors.forEach(hf => {
                expect(hf).toBeLessThanOrEqual(1.0);
                expect(isUnhealthy(hf)).toBe(true);
            });
        });

        function isHealthy(hf: number): boolean {
            return hf > 1.2;
        }

        function isRisky(hf: number): boolean {
            return hf > 1.0 && hf <= 1.2;
        }

        function isUnhealthy(hf: number): boolean {
            return hf <= 1.0;
        }

        it('should handle infinite health factor for zero debt', () => {
            const collateral = new BigNumber(1000);
            const debt = new BigNumber(0);

            const healthFactor = debt.gt(0) ? collateral.div(debt) : new BigNumber(Infinity);
            expect(healthFactor.isFinite()).toBe(false);
            expect(healthFactor.toNumber()).toBe(Infinity);
        });
    });

    describe('Error Code Validation', () => {
        it('should validate standard error codes', () => {
            const standardErrors = [
                'INSUFFICIENT_COLLATERAL',
                'MATCHING_FAILED', 
                'NETWORK_ERROR',
                'INVALID_PARAMETERS',
                'TRANSACTION_FAILED',
                'INSUFFICIENT_LIQUIDITY',
                'HEALTH_FACTOR_TOO_LOW'
            ];

            standardErrors.forEach(errorCode => {
                expect(typeof errorCode).toBe('string');
                expect(errorCode).toMatch(/^[A-Z_]+$/);
                expect(errorCode.length).toBeGreaterThan(0);
            });
        });

        it('should validate error message structure', () => {
            const errorMessages = [
                {
                    code: 'INSUFFICIENT_COLLATERAL',
                    message: 'Not enough collateral to perform this operation',
                    suggestion: 'Add more collateral or reduce the transaction amount',
                    severity: 'error'
                },
                {
                    code: 'MATCHING_FAILED',
                    message: 'P2P matching could not be completed',
                    suggestion: 'Increase gas allocation or try a different amount',
                    severity: 'warning'
                }
            ];

            errorMessages.forEach(error => {
                expect(error).toHaveProperty('code');
                expect(error).toHaveProperty('message');
                expect(error).toHaveProperty('suggestion');
                expect(error).toHaveProperty('severity');
                
                expect(typeof error.code).toBe('string');
                expect(typeof error.message).toBe('string');
                expect(typeof error.suggestion).toBe('string');
                expect(['error', 'warning', 'info']).toContain(error.severity);
                
                expect(error.code.length).toBeGreaterThan(0);
                expect(error.message.length).toBeGreaterThan(0);
                expect(error.suggestion.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Configuration Validation', () => {
        it('should validate network configurations', () => {
            const validNetworks = ['base', 'base-sepolia'];
            const invalidNetworks = ['ethereum', 'polygon', '', null, undefined];

            validNetworks.forEach(network => {
                expect(typeof network).toBe('string');
                expect(['base', 'base-sepolia']).toContain(network);
            });

            invalidNetworks.forEach(network => {
                if (typeof network === 'string') {
                    expect(['base', 'base-sepolia']).not.toContain(network);
                } else {
                    expect(network).toBeNil();
                }
            });
        });

        it('should validate RPC URL formats', () => {
            const validUrls = [
                'https://mainnet.base.org',
                'https://sepolia.base.org', 
                'http://localhost:8545',
                'wss://base-mainnet.g.alchemy.com/v2/api-key'
            ];

            const invalidUrls = [
                'mainnet.base.org', // Missing protocol
                'ftp://base.org', // Wrong protocol
                '', // Empty
                'https://', // Incomplete
                null,
                undefined
            ];

            validUrls.forEach(url => {
                expect(url).toMatch(/^(https?|wss?):\/\/.+/);
            });

            invalidUrls.forEach(url => {
                if (typeof url === 'string') {
                    const isValid = /^(https?|wss?):\/\/.+/.test(url);
                    expect(isValid).toBe(false);
                } else {
                    expect(url).toBeNil();
                }
            });
        });

        it('should validate private key formats', () => {
            const validKeys = [
                '0x' + 'a'.repeat(64),
                '0x' + '1234567890abcdef'.repeat(4),
                '0x' + '0'.repeat(64) // Test key
            ];

            const invalidKeys = [
                'a'.repeat(64), // Missing 0x
                '0x' + 'g'.repeat(64), // Invalid character
                '0x' + 'a'.repeat(63), // Too short
                '0x' + 'a'.repeat(65), // Too long
                '',
                null,
                undefined
            ];

            validKeys.forEach(key => {
                expect(key).toMatch(/^0x[a-fA-F0-9]{64}$/);
            });

            invalidKeys.forEach(key => {
                if (typeof key === 'string') {
                    const isValid = /^0x[a-fA-F0-9]{64}$/.test(key);
                    expect(isValid).toBe(false);
                } else {
                    expect(key).toBeNil();
                }
            });
        });
    });
});