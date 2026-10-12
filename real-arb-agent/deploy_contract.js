/**
 * Direct Deployment Script for BaseArbitrageExecutor on Base Mainnet
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function main() {
    console.log('\n======================================================');
    console.log('    BASE MAINNET ARBITRAGE EXECUTOR DEPLOYMENT       ');
    console.log('======================================================\n');

    let privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error('❌ Error: WALLET_PRIVATE_KEY not set.');
        process.exit(1);
    }
    if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
    }

    const rpcUrl = process.env.BASE_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Deployer Address: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet Balance:   ${ethers.formatEther(balance)} ETH on Base`);

    if (balance === 0n) {
        console.error('❌ Error: Zero balance on Base.');
        process.exit(1);
    }

    const source = fs.readFileSync(path.join(__dirname, 'BaseArbitrageExecutor.sol'), 'utf8');
    const input = {
        language: 'Solidity',
        sources: { 'BaseArbitrageExecutor.sol': { content: source } },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
        }
    };

    console.log('Compiling BaseArbitrageExecutor.sol...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contractData = output.contracts['BaseArbitrageExecutor.sol']['BaseArbitrageExecutor'];
    const bytecode = contractData.evm.bytecode.object;
    const abi = contractData.abi;

    console.log('Deploying contract to Base Mainnet...');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployTx = await factory.deploy();
    console.log(`Transaction hash: ${deployTx.deploymentTransaction().hash}`);
    console.log('Waiting for block confirmation on Base...');

    await deployTx.waitForDeployment();
    const contractAddress = await deployTx.getAddress();

    console.log('\n======================================================');
    console.log('🎉 CONTRACT DEPLOYED TO BASE MAINNET SUCCESSFULLY!');
    console.log(`Address: ${contractAddress}`);
    console.log('======================================================\n');

    // Save contract address to .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('ARBITRAGE_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(/ARBITRAGE_CONTRACT_ADDRESS=.*/g, `ARBITRAGE_CONTRACT_ADDRESS=${contractAddress}`);
    } else {
        envContent += `\nARBITRAGE_CONTRACT_ADDRESS=${contractAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    // Save ABI for server.js
    fs.writeFileSync(path.join(__dirname, 'contract_abi.json'), JSON.stringify(abi, null, 2));
    console.log('Updated .env and saved contract_abi.json');
}

main().catch(err => {
    console.error('Deployment error:', err);
    process.exit(1);
});
