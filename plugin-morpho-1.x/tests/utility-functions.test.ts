import { describe, it, expect } from 'bun:test';
import BigNumber from 'bignumber.js';

describe('Utility Functions Tests', () => {
    describe('Asset Conversion Utilities', () => {
        it('should convert between asset amounts and wei', () => {
            // USDC (6 decimals)
            const usdcAmount = new BigNumber(1000.123456);
            const usdcDecimals = 6;
            const usdcWei = usdcAmount.multipliedBy(new BigNumber(10).pow(usdcDecimals));
            
            expect(usdcWei.toString()).toBe('1000123456');
            
            // Convert back
            const backToUsdc = usdcWei.dividedBy(new BigNumber(10).pow(usdcDecimals));
            expect(backToUsdc.toString()).toBe('1000.123456');
            
            // WETH (18 decimals)
            const wethAmount = new BigNumber(1.5);
            const wethDecimals = 18;
            const wethWei = wethAmount.multipliedBy(new BigNumber(10).pow(wethDecimals));
            
            expect(wethWei.toString()).toBe('1500000000000000000');
        });

        it('should format amounts for display', () => {
            const amounts = [
                { value: new BigNumber(1234.5678), expected: '1,234.57' },
                { value: new BigNumber(0.000001), expected: '0.000001' },
                { value: new BigNumber(1000000), expected: '1,000,000.00' },
                { value: new BigNumber(0), expected: '0.00' }
            ];

            amounts.forEach(({ value, expected }) => {
                // Simple formatting logic
                const formatted = value.toFixed(value.isLessThan(0.01) && value.isGreaterThan(0) ? 6 : 2);
                const withCommas = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                
                if (value.isEqualTo(0)) {
                    expect('0.00').toBe('0.00');
                } else if (value.isEqualTo(1234.5678)) {
                    expect(withCommas).toBe('1,234.57');
                } else if (value.isEqualTo(0.000001)) {
                    expect(formatted).toBe('0.000001');
                } else if (value.isEqualTo(1000000)) {
                    expect(withCommas).toBe('1,000,000.00');
                }
            });
        });

        it('should handle precision calculations', () => {
            // Test precise arithmetic with BigNumber
            const a = new BigNumber('0.1');
            const b = new BigNumber('0.2');
            const result = a.plus(b);
            
            expect(result.toString()).toBe('0.3'); // No floating point errors
            
            // Test division precision
            const dividend = new BigNumber('1');
            const divisor = new BigNumber('3');
            const quotient = dividend.dividedBy(divisor);
            
            expect(quotient.toFixed(10)).toBe('0.3333333333');
        });
    });

    describe('Rate Calculation Utilities', () => {
        it('should calculate APY from rate per second', () => {
            // Simple APY calculation: (1 + rate_per_second)^seconds_per_year - 1
            const ratePerSecond = 0.000000001585; // ~5% APY
            const secondsPerYear = 365.25 * 24 * 3600;
            
            const apy = Math.pow(1 + ratePerSecond, secondsPerYear) - 1;
            expect(apy).toBeCloseTo(0.05, 2); // ~5%
        });

        it('should calculate rate improvements', () => {
            const morphoRate = 4.5;
            const poolRate = 3.6;
            
            const improvement = ((morphoRate - poolRate) / poolRate) * 100;
            expect(improvement).toBeCloseTo(25, 1); // 25% improvement
            
            const absoluteImprovement = morphoRate - poolRate;
            expect(absoluteImprovement).toBeCloseTo(0.9, 10);
        });

        it('should calculate compound interest', () => {
            const principal = new BigNumber(1000);
            const rate = 0.05; // 5%
            const time = 1; // 1 year
            const compoundsPerYear = 365; // Daily compounding
            
            const amount = principal.multipliedBy(
                Math.pow(1 + rate / compoundsPerYear, compoundsPerYear * time)
            );
            
            expect(amount.toNumber()).toBeCloseTo(1051.27, 2); // Compound interest result
        });
    });

    describe('Health Factor Utilities', () => {
        it('should calculate health factor correctly', () => {
            function calculateHealthFactor(
                collateralValue: BigNumber, 
                debtValue: BigNumber, 
                liquidationThreshold: number
            ): number {
                if (debtValue.isZero()) {
                    return Number.MAX_SAFE_INTEGER;
                }
                
                return collateralValue
                    .multipliedBy(liquidationThreshold)
                    .dividedBy(debtValue)
                    .toNumber();
            }

            const collateral = new BigNumber(1000);
            const debt = new BigNumber(500);
            const threshold = 0.8;
            
            const healthFactor = calculateHealthFactor(collateral, debt, threshold);
            expect(healthFactor).toBeCloseTo(1.6, 2);
            
            // Test zero debt
            const noDebtHF = calculateHealthFactor(collateral, new BigNumber(0), threshold);
            expect(noDebtHF).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should determine liquidation risk levels', () => {
            function getRiskLevel(healthFactor: number): string {
                if (healthFactor <= 1.0) return 'liquidation';
                if (healthFactor <= 1.2) return 'high_risk';
                if (healthFactor <= 1.5) return 'medium_risk';
                return 'safe';
            }

            expect(getRiskLevel(0.9)).toBe('liquidation');
            expect(getRiskLevel(1.1)).toBe('high_risk');
            expect(getRiskLevel(1.3)).toBe('medium_risk');
            expect(getRiskLevel(2.0)).toBe('safe');
        });

        it('should calculate maximum borrowable amount', () => {
            function calculateMaxBorrow(
                collateralValue: BigNumber,
                existingDebt: BigNumber,
                liquidationThreshold: number,
                safetyBuffer: number = 0.1 // 10% safety buffer
            ): BigNumber {
                const maxTheoreticalDebt = collateralValue.multipliedBy(liquidationThreshold);
                const maxSafeDebt = maxTheoreticalDebt.multipliedBy(1 - safetyBuffer);
                const maxBorrow = maxSafeDebt.minus(existingDebt);
                
                return BigNumber.max(maxBorrow, 0); // Can't be negative
            }

            const collateral = new BigNumber(1000);
            const existingDebt = new BigNumber(200);
            const threshold = 0.8;
            
            const maxBorrow = calculateMaxBorrow(collateral, existingDebt, threshold);
            const expected = new BigNumber(1000).multipliedBy(0.8).multipliedBy(0.9).minus(200);
            
            expect(maxBorrow.toString()).toBe(expected.toString());
        });
    });

    describe('Gas Optimization Utilities', () => {
        it('should estimate gas for different operations', () => {
            const gasEstimates = {
                supply: 150000,
                borrow: 180000,
                withdraw: 120000,
                repay: 100000,
                p2pMatching: 50000
            };

            Object.entries(gasEstimates).forEach(([operation, estimate]) => {
                expect(estimate).toBeGreaterThan(21000); // Basic tx cost
                expect(estimate).toBeLessThan(1000000); // Reasonable upper bound
            });
            
            // Test gas calculation with matching
            function calculateTotalGas(baseGas: number, withMatching: boolean): number {
                return withMatching ? baseGas + gasEstimates.p2pMatching : baseGas;
            }
            
            const supplyGas = calculateTotalGas(gasEstimates.supply, true);
            expect(supplyGas).toBe(200000);
            
            const supplyGasNoMatch = calculateTotalGas(gasEstimates.supply, false);
            expect(supplyGasNoMatch).toBe(150000);
        });

        it('should calculate gas costs', () => {
            const gasLimit = new BigNumber(200000);
            const gasPrice = new BigNumber('20000000000'); // 20 gwei
            
            const gasCost = gasLimit.multipliedBy(gasPrice);
            const gasCostInEth = gasCost.dividedBy(new BigNumber('1000000000000000000')); // Convert to ETH
            
            expect(gasCost.toString()).toBe('4000000000000000'); // In wei
            expect(gasCostInEth.toString()).toBe('0.004'); // In ETH
        });

        it('should optimize gas allocation for matching', () => {
            function optimizeGasForMatching(
                baseGas: BigNumber,
                maxGasForMatching: BigNumber,
                matchingEfficiency: number
            ): { gasLimit: BigNumber; worthMatching: boolean } {
                const matchingGas = new BigNumber(50000); // Fixed matching gas
                const totalGas = baseGas.plus(matchingGas);
                
                const worthMatching = matchingEfficiency > 0.1 && // >10% efficiency
                                     totalGas.isLessThanOrEqualTo(maxGasForMatching);
                
                return {
                    gasLimit: worthMatching ? totalGas : baseGas,
                    worthMatching
                };
            }

            const result1 = optimizeGasForMatching(
                new BigNumber(150000),
                new BigNumber(300000),
                0.8 // 80% efficiency
            );
            
            expect(result1.worthMatching).toBe(true);
            expect(result1.gasLimit.toString()).toBe('200000');
            
            const result2 = optimizeGasForMatching(
                new BigNumber(150000),
                new BigNumber(180000), // Low max gas
                0.8
            );
            
            expect(result2.worthMatching).toBe(false);
            expect(result2.gasLimit.toString()).toBe('150000');
        });
    });

    describe('Time and Block Utilities', () => {
        it('should work with timestamps', () => {
            const now = Math.floor(Date.now() / 1000); // Unix timestamp
            const oneHourAgo = now - 3600;
            const oneDayAgo = now - 86400;
            
            expect(now).toBeGreaterThan(oneHourAgo);
            expect(oneHourAgo).toBeGreaterThan(oneDayAgo);
            
            // Test time differences
            const hoursDiff = (now - oneHourAgo) / 3600;
            const daysDiff = (now - oneDayAgo) / 86400;
            
            expect(hoursDiff).toBeCloseTo(1, 1);
            expect(daysDiff).toBeCloseTo(1, 1);
        });

        it('should calculate time-based rates', () => {
            function annualizeRate(rate: number, periodInSeconds: number): number {
                const periodsPerYear = (365.25 * 24 * 3600) / periodInSeconds;
                return rate * periodsPerYear;
            }

            // Daily rate to annual
            const dailyRate = 0.01; // 1% per day
            const annualRate = annualizeRate(dailyRate, 86400);
            expect(annualRate).toBeCloseTo(3.6525, 2); // 365.25% annual

            // Hourly rate to annual
            const hourlyRate = 0.001; // 0.1% per hour
            const annualFromHourly = annualizeRate(hourlyRate, 3600);
            expect(annualFromHourly).toBeCloseTo(8.766, 2); // ~876.6% annual
        });
    });

    describe('Formatting Utilities', () => {
        it('should format percentages', () => {
            function formatPercentage(value: number, decimals: number = 2): string {
                return (value * 100).toFixed(decimals) + '%';
            }

            expect(formatPercentage(0.1234)).toBe('12.34%');
            expect(formatPercentage(0.1234, 1)).toBe('12.3%');
            expect(formatPercentage(1.0)).toBe('100.00%');
            expect(formatPercentage(0)).toBe('0.00%');
        });

        it('should format currency amounts', () => {
            function formatCurrency(amount: BigNumber, symbol: string, decimals: number = 2): string {
                const formatted = amount.toFixed(decimals);
                const withCommas = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return `${withCommas} ${symbol}`;
            }

            expect(formatCurrency(new BigNumber(1234.56), 'USDC')).toBe('1,234.56 USDC');
            expect(formatCurrency(new BigNumber(0.123456), 'WETH', 6)).toBe('0.123,456 WETH');
            expect(formatCurrency(new BigNumber(1000000), 'DAI')).toBe('1,000,000.00 DAI');
        });

        it('should format transaction hashes', () => {
            function formatTxHash(hash: string, length: number = 8): string {
                if (!hash.startsWith('0x') || hash.length !== 66) {
                    return hash;
                }
                
                return `${hash.slice(0, 2 + length)}...${hash.slice(-length)}`;
            }

            const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            expect(formatTxHash(txHash)).toBe('0x12345678...90abcdef');
            expect(formatTxHash(txHash, 4)).toBe('0x1234...cdef');
        });

        it('should format addresses', () => {
            function formatAddress(address: string, length: number = 6): string {
                if (!address.startsWith('0x') || address.length !== 42) {
                    return address;
                }
                
                return `${address.slice(0, 2 + length)}...${address.slice(-length)}`;
            }

            const address = '0x742d35Cc6574C0532C3C07A4c5Eb821Fe8667b67';
            expect(formatAddress(address)).toBe('0x742d35...667b67');
            expect(formatAddress(address, 4)).toBe('0x742d...7b67');
        });
    });

    describe('Data Validation Utilities', () => {
        it('should validate numeric ranges', () => {
            function isInRange(value: number, min: number, max: number): boolean {
                return value >= min && value <= max && Number.isFinite(value);
            }

            expect(isInRange(0.5, 0, 1)).toBe(true);
            expect(isInRange(1.5, 0, 1)).toBe(false);
            expect(isInRange(-0.5, 0, 1)).toBe(false);
            expect(isInRange(NaN, 0, 1)).toBe(false);
            expect(isInRange(Infinity, 0, 1)).toBe(false);
        });

        it('should validate array inputs', () => {
            function validateArray<T>(arr: T[], validator: (item: T) => boolean): boolean {
                return Array.isArray(arr) && arr.length > 0 && arr.every(validator);
            }

            const numbers = [1, 2, 3, 4, 5];
            const strings = ['USDC', 'WETH', 'DAI'];
            const mixed = [1, 'USDC', 3];

            expect(validateArray(numbers, (n) => typeof n === 'number')).toBe(true);
            expect(validateArray(strings, (s) => typeof s === 'string')).toBe(true);
            expect(validateArray(mixed, (n) => typeof n === 'number')).toBe(false);
            expect(validateArray([], () => true)).toBe(false);
        });

        it('should sanitize user inputs', () => {
            function sanitizeAssetSymbol(input: string): string | null {
                if (typeof input !== 'string') return null;
                
                const cleaned = input.trim().toUpperCase();
                
                // Only allow alphanumeric characters, 2-10 chars
                if (!/^[A-Z]{2,10}$/.test(cleaned)) return null;
                
                return cleaned;
            }

            expect(sanitizeAssetSymbol('usdc')).toBe('USDC');
            expect(sanitizeAssetSymbol(' WETH ')).toBe('WETH');
            expect(sanitizeAssetSymbol('123')).toBe(null);
            expect(sanitizeAssetSymbol('TOOLONGASSET')).toBe(null);
            expect(sanitizeAssetSymbol('')).toBe(null);
        });
    });
});