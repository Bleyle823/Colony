
const query = `
query {
  markets(first: 20, where: { chainId_in: [1] }) {
    items {
      uniqueKey
      collateralAsset {
        symbol
        address
      }
      loanAsset {
        symbol
        address
      }
      lltv
    }
  }
}
`;

async function main() {
  try {
    const response = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();
    if (json.errors) {
      console.error("Errors:", json.errors);
      return;
    }

    const markets = json.data?.markets?.items;
    if (markets && markets.length > 0) {
      console.log(markets[0].uniqueKey);
    } else {
      console.error("No markets found");
    }
  } catch (err) {
    console.error("Error fetching markets:", err);
  }
}

main();
