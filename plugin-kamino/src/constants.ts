export const RWA_TOKENS: Record<string, string> = {
    "TSLAX": "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    "CRCLX": "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1",
    "GOOGLX": "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    "GLDX": "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
    "AMZNX": "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
    "NVDAX": "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    "METAX": "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
    "AAPLX": "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"
};

export function getTokenMint(symbol: string): string | undefined {
    return RWA_TOKENS[symbol.toUpperCase()];
}
