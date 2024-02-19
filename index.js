const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { ethers } = require('ethers');

require('dotenv').config();

const ERC20_ABI = require('./abi/ERC20.json');
const ERC721_ABI = require('./abi/ERC721.json');
const ERC1155_ABI = require('./abi/ERC1155.json');

const SWAP_PAIR_ABI = require('./abi/SwapPair.json');
const SWAP_ROUTER_ABI = require('./abi/SwapRouter.json');

// Define contracts and ABI from imports

const ABI = {
    swapPair: SWAP_PAIR_ABI.abi,
    swapRouter: SWAP_ROUTER_ABI.abi,

    ERC20: ERC20_ABI.abi,
    ERC721: ERC721_ABI.abi,
    ERC1155: ERC1155_ABI.abi
}

const CONTRACTS = {
    swapRouter01: "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02",
    swapRouter02: "0x165C3410fC91EF562C50559f7d2289fEbed552d9"
}

const TOKENS = {
    DAI: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
    USDC: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
    USDT: "0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f",
    WBTC: "0xb17D901469B9208B17d916112988A3FeD19b5cA1",
    WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
    ISLAND: "0xDFB10795E6fE7D0Db68F9778Ba4C575a28E8Cd4c",
    ZKZX: "0x319e55Be473C77C35316651995C048a415219604",
    GOAT: "0xF5D0140B4d53c9476DC1488BC6d8597d7393f074",
    PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
    PRS: "0xb6B57227150a7097723e0C013752001AaD01248F",
    IMPLS: "0x5f63BC3d5bd234946f18d24e98C324f629D9d60e",
    USDL: "0x0dEEd1486bc52aA0d3E6f8849cEC5adD6598A162",
    LOAN: "0x9159f1D2a9f51998Fc9Ab03fbd8f265ab14A1b3B"
}

// Create express application instance
const app = express();

// Define a provider for the Ethereum network
const provider = new ethers.providers.JsonRpcProvider("https://rpc.pulsechain.com");

const swapRouter01 = new ethers.Contract(CONTRACTS.swapRouter01, ABI.swapRouter, provider);
const swapRouter02 = new ethers.Contract(CONTRACTS.swapRouter02, ABI.swapRouter, provider);

// Use Helmet to protect against well known vulnerabilities by setting appropriate HTTP headers
app.use(helmet());

// Enable CORS for all requests
app.use(cors());

// Enable parsing of json body in requests
app.use(express.json());

// Define a simple route for GET requests to the root URL
app.get('/', (req, res) => {
    res.json({
        message: "Pulsechain Price API - Active!"
    });
});

// Define a route to get the balance of a given Ethereum address
app.get('/balance/:address', async (req, res, next) => {
    try {

        const { address } = req.params;

        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }

        const balance = await provider.getBalance(address);

        // Convert the balance from wei to ether
        const balanceInEth = ethers.utils.formatEther(balance);

        res.json({ balance: balanceInEth });
    } catch (error) {
        next(error);
    }
});

// Define a route to get the name, symbol, decimals, total supply of a token
app.get('/token/:address', async (req, res, next) => {
    try {

        const { address } = req.params;

        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }

        const contract = new ethers.Contract(address, [
            'function name() view returns (string)',
            'function symbol() view returns (string)',
            'function decimals() view returns (uint8)',
            'function totalSupply() view returns (uint256)',
        ], provider);

        const [name, symbol, decimals, totalSupply] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
            contract.totalSupply(),
        ]);

        res.json({
            name,
            symbol,
            decimals,
            totalSupply: totalSupply.toString(),
        });
    } catch (error) {
        next(error);
    }
});

// Define a route to get a price of a token against another (using getAmountsOut)
app.get('/price/:tokenIn/:amountIn', async (req, res, next) => {
    try {

        const { tokenIn, amountIn } = req.params;

        // Validate PLS address
        if (!ethers.utils.isAddress(tokenIn)) {
            return res.status(400).json({ error: 'Invalid PLS address' });
        }

        const amountInWei = toWei(amountIn);

        const amounts = await swapRouter02.getAmountsOut(amountInWei, [tokenIn, TOKENS.WPLS]);
        const amountsUSD = await swapRouter02.getAmountsOut(amountInWei, [tokenIn, TOKENS.WPLS, TOKENS.DAI]);

        const amountOut = fromWei(amounts[1]);
        const amountOutUSD = fromWei(amountsUSD[2]);

        res.json({
            amountOut,
            amountOutUSD
        });
    } catch (error) {
        next(error);
    }
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

// Error handler
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message,
        },
    });
});

// Set the port for the application
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function fromWei(num) {
    return ethers.utils.formatEther(num);
}

function toWei(num) {
    return ethers.utils.parseEther(num);
}