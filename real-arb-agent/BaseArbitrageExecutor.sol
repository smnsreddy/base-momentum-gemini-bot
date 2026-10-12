// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAavePool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

contract BaseArbitrageExecutor {
    address public immutable owner;
    address public constant AAVE_POOL = 0xA238Dd80C259B70e830e05187bC07238269C277E;

    struct ArbParams {
        address routerA;
        address routerB;
        address intermediateToken;
        bytes swapDataA;
        bytes swapDataB;
        uint256 minProfit;
    }

    event ArbitrageExecuted(address indexed asset, uint256 borrowed, uint256 profit);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function executeFlashArb(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external onlyOwner {
        IAavePool(AAVE_POOL).flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == AAVE_POOL, "Caller must be Aave Pool");
        require(initiator == address(this), "Initiator must be this contract");

        ArbParams memory p = abi.decode(params, (ArbParams));
        uint256 totalOwed = amount + premium;

        // 1. APPROVE ROUTER A TO SPEND FLASH LOAN ASSET (e.g. WETH)
        IERC20(asset).approve(p.routerA, amount);

        // 2. EXECUTE SWAP 1 ON DEX A
        (bool okA, ) = p.routerA.call(p.swapDataA);
        require(okA, "Swap A failed");

        // 3. APPROVE ROUTER B TO SPEND INTERMEDIATE TOKEN (e.g. BRETT / VIRTUAL)
        uint256 interBal = IERC20(p.intermediateToken).balanceOf(address(this));
        require(interBal > 0, "Zero intermediate received");
        IERC20(p.intermediateToken).approve(p.routerB, interBal);

        // 4. EXECUTE SWAP 2 ON DEX B
        (bool okB, ) = p.routerB.call(p.swapDataB);
        require(okB, "Swap B failed");

        // 5. INVARIANT CHECK: ENSURE FINAL ASSET BALANCE COVERS DEBT + PROFIT
        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        require(currentBalance >= totalOwed + p.minProfit, "Arbitrage not profitable: REVERT");

        // 6. APPROVE REPAYMENT TO AAVE
        IERC20(asset).approve(AAVE_POOL, totalOwed);

        // Retain net profit inside contract vault for 1-click owner withdrawal
        uint256 profit = currentBalance - totalOwed;
        emit ArbitrageExecuted(asset, amount, profit);
        return true;
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
