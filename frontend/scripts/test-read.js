import { Client } from '../src/client/src/client.js';

const client = new Client({
  contractId: "CDCUX2DZJYL34HQQ73T4FUA6K6OQ64JF4GONGFZB2YUABHSCIXMGMGTA",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

async function main() {
  try {
    console.log("Fetching target amount...");
    const tx = await client.get_target();
    
    // Let's inspect the tx object properties
    console.log("tx keys:", Object.keys(tx));
    console.log("tx constructor:", tx.constructor.name);
    
    // Try simulating it
    const sim = await tx.simulate();
    console.log("sim:", sim);
    
    // Check where the result is
    if (tx.result !== undefined) console.log("tx.result:", tx.result);
    
  } catch (err) {
    console.error("Error reading contract:", err);
  }
}

main();
