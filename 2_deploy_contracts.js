var Election = artifacts.require("./Election.sol");
var Token = artifacts.require("./Token.sol");

module.exports = async function(deployer, network, accounts) {
  // Specify the address you want to use for deployment
  const deployAccount = '0x2BC17f7Dbad683Aab8aB1aF49206C5C3a267504d';

  await deployer.deploy(Token, "100", { from: deployAccount });
  const tokenInstance = await Token.deployed();

  await deployer.deploy(Election, Token.address, { from: deployAccount });
  const electionInstance = await Election.deployed();

  // Define the number of tokens to transfer - we need to account for decimal places
  const tokensToTransfer = web3.utils.toWei("100", "ether");  // 'ether' unit here means 10^18 of the smallest unit

  // Transfer 100 tokens from the deployer's account to the Election contract
  await tokenInstance.transfer(Election.address, tokensToTransfer, { from: deployAccount });
};
