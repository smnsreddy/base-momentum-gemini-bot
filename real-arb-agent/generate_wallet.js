/**
 * One-Click Dedicated Burner Wallet Generator for Base Mainnet
 * Run: node generate_wallet.js
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const wallet = ethers.Wallet.createRandom();

console.log('\n=============================================================');
console.log('       NEW DEDICATED BASE MAINNET BURNER WALLET GENERATED     ');
console.log('=============================================================');
console.log('Public Deposit Address (Send your Base ETH here):');
console.log(`>>> ${wallet.address} <<<`);
console.log('-------------------------------------------------------------');
console.log('Private Key (Auto-saved directly to your local .env file):');
console.log(`>>> ${wallet.privateKey} <<<`);
console.log('-------------------------------------------------------------');
console.log('Recovery Phrase (Keep safe as backup):');
console.log(`>>> ${wallet.mnemonic.phrase} <<<`);
console.log('=============================================================\n');

// Automatically update .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    content = content.replace(/WALLET_PRIVATE_KEY=.*/g, `WALLET_PRIVATE_KEY=${wallet.privateKey}`);
    content = content.replace(/ENABLE_LIVE_EXECUTION=.*/g, `ENABLE_LIVE_EXECUTION=true`);
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('[SUCCESS] .env file automatically updated with your new wallet key and live execution enabled!');
} else {
    console.log('[NOTICE] .env file not found, please create one.');
}

console.log('\nNEXT STEPS:');
console.log('1. Open your Coinbase App or Coinbase Wallet.');
console.log('2. Send your ₹1,400 worth of ETH to the Deposit Address above.');
console.log('   *** CRITICAL: Select "BASE" network (not Ethereum mainnet) for cheap ₹0.30 gas fees! ***');
console.log('3. Once sent, tell me "done" and I will check the on-chain balance and deploy the contract!\n');
