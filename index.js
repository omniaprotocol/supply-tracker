
const NodeCache = require('node-cache');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const LISTEN_PORT = parseInt(process.env.PORT);

const app = express();
const port = LISTEN_PORT;

let BURNED_TOKENS = 0; 

// BSCSCAN API Key (ENV)
const apiKey = process.env.ETHSCAN_API_KEY;
const bscApiKey = process.env.BSCSCAN_API_KEY;

// Contract address of CGPT token (ENV)
const erc20ContractAddress = process.env.ERC20_CONTRACT_ADDRESS;
const bep20ContractAddress = process.env.BEP20_CONTRACT_ADDRESS;

let TOKEN_PRICE = null;

// Maximum Supply of CGPT token (ENV)
const MaxSupply = Math.floor(process.env.OMNIA_MAX_SUPPLY);

const cache = new NodeCache({ stdTTL: 600 }); // Set the cache expiration time to 600 seconds (10 minutes)


const dailyCache = new NodeCache({ stdTTL: 86400 }); // Set the cache expiration time to 24h


function setCache(key, value) {
  // First set short term cache
  cache.set(key,value);
  // Also save in daily cache - helps with miss events in short term cache 
  dailyCache.set(key,value);
}

function getCache(key) {
  return cache.get(key);
}

function getCacheSafe(key) {
    // First try fetching short term cache
    let value = cache.get(key);
    if (value) {
      return value;
    } else {
      // If short term cache didn't work, return daily cache entry
      return dailyCache.get(key); 
    }
}


// List of ERC20 contract addresses with additional information
const contractAddresses = [
  {
    address: '0xe8B9988Bede0AA3e9b8659fB5D1b5474195A0c33',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Seed Round (ref: tokenomics)', 
  },
  {
    address: '0x193364EC780eFD52D89D202Fcecd3Dd2D347925e',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'VCs & Partners Rounds, pool 1/2 (ref: tokenomics)', 
  },
  {
    address: '0x2234a8b8801a455F5E3fC53B597062bB9b1E9d15',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'VCs & Partners Rounds, pool 2/2 (ref: tokenomics)', 
  },
  {
    address: '0xdCfd1F3Aeea3369bC55B8a3beEE94d9FD5D96Ed2',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Strategic Round, pool 1/4 (ref: tokenomics)', 
  },
  {
    address: '0x59779C59F473cF53fcE9ef60439f9Bf83E4A3b26',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'KOLs Round, pool 1/2 (ref: tokenomics)', 
  },
  {
    address: '0x56198d1E12daa65487127f73B14bcF640AD8C2E2',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Advisory, pool 1/5 (ref: tokenomics)', 
  },
  {
    address: '0x2411B49688f7EC4B113D2A072164e3690006eA4c',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Advisory, pool 2/5 (ref: tokenomics)', 
  },
  {
    address: '0x561CCAF59F6394c49F716F7B4de72eACD35E19E4',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Liquidity (ref: tokenomics)', 
  },
  {
    address: '0xB9D83FF4A8862757901aFbf140f1396De2FEC6F7',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Nodes & Ecosystem, pool 1/3 (ref: tokenomics)', 
  },
  {
    address: '0xDC2CF2699EDCd160aC5C28f3ae33D98F691E6D66',
    chain: 'ETH',
    type: 'ETH Staking Pool',
    wallet: 'Nodes & Ecosystem, pool 2/3 (ref: tokenomics)', 
  },
  {
    address: '0x91CAe16F8920fE3f853572e3704f3B83ab5805EB',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Team (ref: tokenomics)', 
  },
  {
    address: '0x494f30609B6FAF6fE1fA7b295657683A463eD3D8',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Marketing (ref: tokenomics)', 
  },
  {
    address: '0xd2C473A5E1Affba9B2c9b8C187A86958022A29A0',
    chain: 'ETH',
    type: 'TeamFinance Vesting',
    wallet: 'Treasury (ref: tokenomics)', 
  },
  {
    address: '0x763A0CA93AF05adE98A52dc1E5B936b89bF8b89a',
    chain: 'ETH',
    type: 'Chainport Vault',
    wallet: 'Locked ERC20 (available in BSC chain, see BSC locks below)', 
  },
];

const bep20Addresses =[
  {
    address: '0xB53cc8303943582949b9a23f0556b0f0C41Fec98',
    chain: 'BSC',
    type: 'Burned',
    wallet: 'Sent by holders to token address by mistake', 
  },
  {
    address: '0x4125a8062556f140c103eb22408a1fd666a5d851',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'KOLs Round, pool 2/2 (ref: tokenomics)', 
  },
  {
    address: '0x259252D6097515c07ce24945b3a57EF2c643cDa3',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Public Round (ref: tokenomics)', 
  },
  {
    address: '0x715B4377E699F22Fb099725c2b0dE597F70e5d88',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Strategic Round, pool 2/4 (ref: tokenomics)', 
  },
  {
    address: '0x811eF9B8f9971B735d4E9BDF854617C1a5020aa1',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Strategic Round, pool 3/4 (ref: tokenomics)', 
  },
  {
    address: '0x207ffD36aAd7fdC5fdc0EF8a3eEd8B7477e7Ce48',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Advisory, pool 3/5 (ref: tokenomics)', 
  },
  {
    address: '0x5FaD56E8441cF6bBFDaf1d7e6A3150D953edfb6e',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Advisory, pool 4/5 (ref: tokenomics)', 
  },
  {
    address: '0x0E6CE8F326AD72d253C2f7FF7faaD4c8b42b7966',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Advisory, pool 5/5 (ref: tokenomics)', 
  },

  {
    address: '0xf07dD7a17C1394028347E69eBd5e501e691601F4',
    chain: 'BSC',
    type: 'ChainGPT Pad Vesting',
    wallet: 'Strategic Round pool 4/4 (ref: tokenomics)',
  },
  {
    address: '0x11e570bc0a080805DA4d2Da5bdf925ac3aFfAB64',
    chain: 'BSC',
    type: 'Node staking',
    wallet: 'Nodes & Ecosystem, pool 3/3 (ref: tokenomics)', 
  },
  {
    address: '0x30178EeFC8Ab2e5673D809296BC5181b33E6b33C',
    chain: 'BSC',
    type: 'Claim Portal',
    wallet: 'Locked supply until claimed'
  },

  
];




async function getTableRows(addressArray) {
  const balances = [];
  for (const { address, chain, type, wallet, name } of addressArray) {
    // 350ms delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 350));
    const apiDomain =  (chain === 'ETH') ?  'api.etherscan.com' : 'api.bscscan.com';
    const url = `https://${apiDomain}/api?module=account&action=tokenbalance&contractaddress=${erc20ContractAddress}&address=${address}&tag=latest&apikey=${apiKey}`;
    const bscScanUrl = `https://${apiDomain}/api?module=account&action=tokenbalance&contractaddress=${bep20ContractAddress}&address=${address}&tag=latest&apikey=${bscApiKey}`;
    const queryUrl = (chain === 'ETH') ?  url : bscScanUrl;
    const response = await axios.get(queryUrl);
    const balance = parseInt(response.data.result);
    balances.push({ address, balance, chain, type, wallet, name });
    }

  balances.sort((a, b) => b.balance - a.balance); // Sort balances in descending order

  let tableRows = '';
  for (const { address, balance, chain, type, wallet } of balances) {
      const apiDomain =  (chain === 'ETH') ?  'etherscan.io' : 'bscscan.com';
      const contractAddr = (chain === 'ETH') ? erc20ContractAddress : bep20ContractAddress;
      const scanLink = `https://${apiDomain}/token/${contractAddr}?a=${address}`;
 
      tableRows += `<tr>
      <td><a href="${scanLink}" target="_blank">${address}</a></td>
        <td>${Math.floor(balance / 10 ** 18).toLocaleString()}</td>
        <td>${chain}</td>
        <td>${type}</td>
        <td>${wallet}</td>
      </tr>`;
  }


  return { tableRows, balances };
}


async function getTokenPrice() {
   const cachedTokenPrice = getCache('tokenPrice');
   if (cachedTokenPrice !== undefined) {
    return cachedTokenPrice;
   }

   try {
     const cmcApiKey = process.env.COINMARKETCAP_API_KEY;
     if (!cmcApiKey) {
       throw new Error('CoinMarketCap API key is not set in environment variables');
     }

     const response = await axios.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest', {
       params: {
         id: 15810, // OMNIA CMC UCID
         convert: 'USD'
       },
       headers: {
         'X-CMC_PRO_API_KEY': cmcApiKey,
         'Accept': 'application/json'
       }
     });
     const tokenData = response?.data?.data['15810']
     if (!tokenData) {
       throw new Error('Token data not found in CoinMarketCap response');
     }

     const tokenPrice = parseFloat(tokenData.quote.USD.price).toFixed(2);
     setCache('tokenPrice', tokenPrice); 
     return tokenPrice;
   } catch (error) {
     console.error('Error fetching token price:', error.message);
     // If we were not able to fetch price try from daily cache or throw
     const cachedPrice = getCacheSafe('tokenPrice');
     if (cachedPrice) {
       return cachedPrice;
     } else {
       throw error;
     }
   }
}



async function getTotalSupply() {

  const cachedTotalSupply = getCache('totalSupply');
  if (cachedTotalSupply !== undefined) {
    return cachedTotalSupply;
  }

  try {
    const result = await getTokenSupply('ETH').catch(error => {
      console.error('Error fetching ETH token supply:', error);
      throw error;
    });
    if (result === null) {
      throw new Error('Failed to fetch ETH token supply');
    }
    
    setCache('totalSupply', result); // Cache the total supply

    return result;

  } catch (error) {
    console.error('Error fetching total supply:', error);
    // try using long term cache
    const cachedTotalSupply = getCacheSafe('totalSupply');
    if (cachedTotalSupply) {
      return cachedTotalSupply;
    } else {
      // rethrow in case no cached value was set
      throw error;
    }
    
  }
}

async function getTokenSupply(chain) {
  const domainApi = chain === 'ETH' ? 'api.etherscan.com' : 'api.bscscan.com';
  const tokenAddress = chain === 'ETH' ? erc20ContractAddress : bep20ContractAddress;
  const apiKeyToUse = chain === 'ETH' ? apiKey : bscApiKey;
  const url = `https://${domainApi}/api?module=stats&action=tokensupply&contractaddress=${tokenAddress}&apikey=${apiKeyToUse}`;
  const response = await axios.get(url);
  return response.data.result;
}



// This is the home-page URL that will show a detailed list of the excluded addresses from the supply and all the data such as total supply, burnt supply, circulating supply, etc.
app.get('/', async (req, res) => {
  const cachedBalances = getCache('balances');
  if (cachedBalances !== undefined) {
    res.send(cachedBalances);
    return;
  }



  try {

    const {tableRows, balances: erc20Balances } = await getTableRows(contractAddresses);

    const {tableRows: bep20TableRows, balances: bep20Balances } = await getTableRows(bep20Addresses);
    
    // Compute total burned tokens
    const totalBurnedErc20 = erc20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurnedBep20 = bep20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurned = totalBurnedErc20 + totalBurnedBep20;

    // Update BURNED_TOKENS constant
    const BURNED_TOKENS = totalBurned;

    let totalCirculating = 0;

    const totalSupplyEndpointResult = await getTotalSupply();
   
    let totalBalance = erc20Balances.reduce((sum, { balance }) => sum + balance, 0);
    totalBalance = Math.floor(totalBalance / 10 ** 18);

    const totalSupply = MaxSupply - totalBurned;
    const circulatingERC20 = MaxSupply - totalBalance - totalBurnedErc20;
    const totalErc20Supply = circulatingERC20 + totalBalance + totalBurnedErc20;
    totalCirculating += circulatingERC20;

    let totalBep20Supply = await getTokenSupply('BSC');
    totalBep20Supply = Math.floor(parseInt(totalBep20Supply)  / 10 ** 18);
  
    const totalBep20Locked = bep20Balances.reduce((sum, { balance }) => sum + Math.floor(balance / 10 ** 18), 0) - totalBurnedBep20;
    const totalBep20Circulating = totalBep20Supply - totalBep20Locked - totalBurnedBep20;;

    totalCirculating += totalBep20Circulating;

    TOKEN_PRICE = await getTokenPrice();

    const htmlResponse = ` <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
  
    h1 {
      color: #333;
      font-size: 32px;
      margin-bottom: 20px;
      text-align: center;
    }
  
    p {
      color: #666;
      font-size: 16px;
      margin-bottom: 10px;
    }
  
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      background-color: #fff;
    }
  
    th,
    td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
  
    th {
      background-color: #f9f9f9;
      font-weight: bold;
      font-size: 16px;
    }
  
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
  
    a {
      color: #337ab7;
      text-decoration: underline;
    }
  
    a:hover {
      color: #23527c;
    }
  
    .title-row {
      background-color: #333;
      color: black;
      font-weight: bold;
      font-size: 18px;
    }
  
    .total-supply-row {
      background-color: #f9f9f9;
    }
  
    .empty-row {
      background-color: transparent;
    }
  
    /* Responsive Styles */
    @media screen and (max-width: 600px) {
      h1 {
        font-size: 24px;
      }
  
      p {
        font-size: 14px;
      }
  
      th,
      td {
        padding: 8px;
      }
    }
  </style>

   <h1>$OMNIA Circulating Supply Tracker</h1>
  
  <div style="display: flex; justify-content: center; align-items: center; text-align: center;">
    <div style="margin-right: 20px;">
      <p>Max Supply: ${MaxSupply.toLocaleString()}</p>
      <p>Burned $OMNIA: ${totalBurned.toLocaleString()}</p>
      <p>Total supply: ${totalSupply.toLocaleString()}</p>
      <p>Live Circulating Supply of $OMNIA: ${totalCirculating.toLocaleString()} </p>
    </div>
    <div style="width: 100px;"></div> <!-- Empty column for spacing -->
    <div style="margin-left: 20px;">
      <p>Market Cap: ${Math.floor(totalCirculating * TOKEN_PRICE).toLocaleString()} USD</p>
      <p>Current Price: ${TOKEN_PRICE} USD</p>
      <p>FDV: ${(MaxSupply * TOKEN_PRICE).toLocaleString()} USD</p>
      <p>Circulating supply ratio: ${((totalCirculating / MaxSupply) * 100).toFixed(2)}%</p>
    </div>
  </div>
  </div>
  
  <br><br>

  <table>
    <tr class="caption-row">
      <th colspan="5" style="font-weight: bold; text-align: center; padding: 10px; background-color: #f0f0f0;">Native ERC20 Tokens</th>
    </tr>
    <tr class="title-row">
      <th>Contract Address</th>
      <th>Balance (OMNIA)</th>
      <th>Chain</th>
      <th>Type</th>
      <th>Name</th>
    </tr>
    ${tableRows}
    <tr class="empty-row">
      <td colspan="5"></td>
    </tr>

    
    <tr class="total-supply-row">
      <td>Total ERC20 supply</td>
      <td>${totalErc20Supply.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr class="total-supply-row">
      <td>Total ERC20 locked supply</td>
      <td>${totalBalance.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr class="total-supply-row">
      <td>Total ERC20 circulating supply</td>
      <td>${circulatingERC20.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>

  </table>

  <hr style="border: 2px solid #333; margin: 20px 0;">

   <table>
    <tr class="caption-row">
      <th colspan="5" style="font-weight: bold; text-align: center; padding: 10px; background-color: #f0f0f0;">Bridged BEP20 on BSC via Chainport</th>
    </tr>
    <tr class="title-row">
      <th>Contract Address</th>
      <th>Balance (OMNIA)</th>
      <th>Chain</th>
      <th>Type</th>
      <th>Name</th>
    </tr>
    ${bep20TableRows}
    <tr class="empty-row">
      <td colspan="5"></td>
    </tr>
     <tr class="total-supply-row">
      <td>Total BEP20 supply</td>
      <td>${totalBep20Supply.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr class="total-supply-row">
      <td>Total BEP20 locked supply</td>
      <td>${totalBep20Locked.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
     <tr class="total-supply-row">
      <td>Total burned BEP20 supply</td>
      <td>${totalBurnedBep20.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr class="total-supply-row">
      <td>Total BEP20 circulating supply</td>
      <td>${totalBep20Circulating.toLocaleString()}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </table>

    `;

    setCache('balances', htmlResponse); // Cache the response

    res.send(htmlResponse);
  } catch (error) {
    console.error('Could not fetch fresh supply dashboard data. Error: ',error.message);
    // try using safe cache
    const safeCachedBalances = getCacheSafe('balances');
    if (safeCachedBalances) {
      res.send(safeCachedBalances);
    } else {
      res.status(500).send('Error fetching data. Try again later.')
    }
  }
});



// This is an API endpoint that will show only the number of the circulating supply (normally used for CMC supply tracking)
app.get('/supply', async (req, res) => {
  const cachedSupply = getCache('supply');
  if (cachedSupply !== undefined) {
    res.send(cachedSupply);
    return;
  }

  try {
          const {tableRows, balances: erc20Balances } = await getTableRows(contractAddresses);

          const {tableRows: bep20TableRows, balances: bep20Balances } = await getTableRows(bep20Addresses);
          
          // Compute total burned tokens
          const totalBurnedErc20 = erc20Balances.reduce((sum, { balance, type }) => {
            return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
          }, 0);

          const totalBurnedBep20 = bep20Balances.reduce((sum, { balance, type }) => {
            return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
          }, 0);

          const totalBurned = totalBurnedErc20 + totalBurnedBep20;

          let totalCirculating = 0;
          const MAX_SUPPLY = await getTotalSupply();
        
          let totalBalance = erc20Balances.reduce((sum, { balance }) => sum + balance, 0);
          totalBalance = Math.floor(totalBalance / 10 ** 18);

          const totalSupply = MAX_SUPPLY - totalBurned;
          const circulatingERC20 = MaxSupply - totalBalance - totalBurnedErc20;
          totalCirculating += circulatingERC20;

          let totalBep20Supply = await getTokenSupply('BSC');
          totalBep20Supply = Math.floor(parseInt(totalBep20Supply)  / 10 ** 18);
        
          const totalBep20Locked = bep20Balances.reduce((sum, { balance }) => sum + Math.floor(balance / 10 ** 18), 0) - totalBurnedBep20;
          const totalBep20Circulating = totalBep20Supply - totalBep20Locked - totalBurnedBep20;;

          totalCirculating += totalBep20Circulating;
          const htmlResponse = `${totalCirculating}`;

    setCache('supply', htmlResponse); // Cache the supply response

    res.send(htmlResponse);
  } catch (error) {
    console.error('Got error when computing circ supply. Error: ',error.message);
    // Try fetching from safe cache
    const circSupplyResponse = getCacheSafe('supply');
    if (circSupplyResponse) {
      res.send(circSupplyResponse);
    } else {
      res.status(500).send('Error fetching data');
    }
    
  }
});


// This API endpoint will show the total supply
app.get('/totalsupply', async (req, res) => {
  const cachedSupply = getCache('newtotal');
  if (cachedSupply !== undefined) {
    res.send(cachedSupply);
    return;
  }

  try {
     
    const {tableRows, balances: erc20Balances } = await getTableRows(contractAddresses);

    const {tableRows: bep20TableRows, balances: bep20Balances } = await getTableRows(bep20Addresses);
    
    // Compute total burned tokens
    const totalBurnedErc20 = erc20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurnedBep20 = bep20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurned = totalBurnedErc20 + totalBurnedBep20;
    const MAX_SUPPLY = await getTotalSupply();
    let newTotalS = Math.floor(MAX_SUPPLY / 10 ** 18) - totalBurned;
    const htmlResponse = `${newTotalS}`;

    setCache('newtotal', htmlResponse); // Cache the newtotal response

    res.send(htmlResponse);
  } catch (error) {
    console.error('Got error when computing total supply. Error: ',error.message);
    // try using safe cache
    const totalSupplyResponse = getCacheSafe('newtotal');
    if (totalSupplyResponse) {
      res.send(totalSupplyResponse);
    } else {
      res.status(500).send('Error fetching data');
    }
    
  }
});



// This API endpoint will show the total tokens burnt
app.get('/burn', async (req, res) => {
  const cachedSupply = getCache('burn');
  if (cachedSupply !== undefined) {
    res.send(cachedSupply);
    return;
  }

  try {
    const {tableRows, balances: erc20Balances } = await getTableRows(contractAddresses);
    const {tableRows: bep20TableRows, balances: bep20Balances } = await getTableRows(bep20Addresses);
    
    // Compute total burned tokens
    const totalBurnedErc20 = erc20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurnedBep20 = bep20Balances.reduce((sum, { balance, type }) => {
      return type === "Burned" ? sum + Math.floor(balance / 10 ** 18) : sum;
    }, 0);

    const totalBurned = totalBurnedErc20 + totalBurnedBep20;
    const htmlResponse = `${totalBurned}`;

    setCache('burn', htmlResponse); // Cache the burn response
    res.send(htmlResponse);
  } catch (error) {
    console.error('Got error when computing burn suplpy. Error: ', error.message);
    // try from safe cache
    const cachedBurnSupplyHTML = getCacheSafe('burn');
    if (cachedBurnSupplyHTML) {
      res.send(cachedBurnSupplyHTML);
    }  else {
      res.status(500).send('Error fetching data');
    }
    
  }
});

// This API endpoint will show the total tokens burnt
app.get('/maxsupply', async (req, res) => {
  const cachedSupply = getCache('maxsupply');
  if (cachedSupply !== undefined) {
    res.send(cachedSupply);
    return;
  }

  try {
    const MAX_SUPPLY = await getTotalSupply();
    const htmlResponse = `${Math.floor(MAX_SUPPLY / 10 ** 18)}`;

    setCache('maxsupply', htmlResponse); // Cache the burn response

    res.send(htmlResponse);
  } catch (error) {
    console.error('Got error when computing max supply. Error: ',error.message);
    // try the safe cache
    const maxSupplyCached = getCacheSafe('maxsupply');
    if (maxSupplyCached) {
      res.send(maxSupplyCached);
    } else {
      res.status(500).send('Error fetching data');
    }
    
  }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
