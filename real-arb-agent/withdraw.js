/**
 * Instant One-Click Profit & Capital Withdrawal Script
 * Sweeps all profits from your BaseArbitrageExecutor contract directly to your MetaMask wallet!
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('\n=============================================================');
    console.log('       BASE ARBITRAGE EXECUTOR PROFIT WITHDRAWAL TOOL       ');
    console.log('=============================================================\n');

    const privateKey = process.env.WALLET_PRIVATE_KEY;
    const rpcUrl = process.env.BASE_RPC_URL;
    const contractAddress = process.env.ARBITRAGE_CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
        console.error('❌ Error: Missing WALLET_PRIVATE_KEY or ARBITRAGE_CONTRACT_ADDRESS in .env');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey, provider);

    console.log(`Your MetaMask Wallet:     ${wallet.address}`);
    console.log(`Arbitrage Contract:       ${contractAddress}`);

    const walletBal = await provider.getBalance(wallet.address);
    const contractBal = await provider.getBalance(contractAddress);

    console.log(`Current MetaMask Balance: ${ethers.formatEther(walletBal)} ETH`);
    console.log(`Contract Locked Balance:  ${ethers.formatEther(contractBal)} ETH\n`);

    if (contractBal === 0n) {
        console.log('ℹ️ Notice: Contract ETH balance is currently 0 ETH. Profits generated are either transferred directly to your wallet upon trade completion or waiting in token balances.');
    } else {
        console.log('⚡ Withdrawing contract ETH balance to your MetaMask wallet...');
        const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contract_abi.json'), 'utf8'));
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        const tx = await contract.withdrawETH();
        console.log(`Withdrawal transaction broadcasted: ${tx.hash}`);
        await tx.wait();
        console.log('🎉 WITHDRAWAL COMPLETE! Funds deposited into your MetaMask wallet.');
    }

    // Check token balances (WETH, USDC)
    const erc20Abi = [
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
    ];

    const tokens = [
        { name: 'WETH', address: '0x4200000000000000000000000000000000000006' },
        { name: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }
    ];

    for (const t of tokens) {
        try {
            const tokenContract = new ethers.Contract(t.address, erc20Abi, provider);
            const bal = await tokenContract.balanceOf(contractAddress);
            if (bal > 0n) {
                const dec = await tokenContract.decimals();
                const formatted = ethers.formatUnits(bal, dec);
                console.log(`💎 Found ${formatted} ${t.name} in contract. Sweeping to wallet...`);
                const arbContract = new ethers.Contract(contractAddress, JSON.parse(fs.readFileSync(path.join(__dirname, 'contract_abi.json'), 'utf8')), wallet);
                const sweepTx = await arbContract.withdrawToken(t.address);
                await sweepTx.wait();
                console.log(`✓ Swept ${formatted} ${t.name} directly to your MetaMask!`);
            }
        } catch (e) {}
    }

    console.log('\n=============================================================\n');
}

main().catch(err => {
    console.error('Withdrawal error:', err);
    process.exit(1);
});
