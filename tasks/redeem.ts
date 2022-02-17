import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-web3";

const BRIDGE_ADDRESS = "0xECd56cf36125EB0A26e17735AEfC1Cf8711f38d5";

const chainIds = {
    kovan: 42,
    bsc_testnet: 97
};

task("redeem", "redeem tokens")
    .addParam("chainfrom", "Chain name from tokens transfer")
    .addParam("chainto", "Chain name to tokens transfer")
    .addParam("sender", "Address sender")
    .addParam("recipient", "Address recipient")
    .addParam("amount", "Amount of tokens to transfer")
    .addParam("nonce", "Transaction identifier")
    .addParam("signature", "Signature of validator")
    .setAction(async ({ chainfrom, chainto, sender, recipient, amount, nonce, signature }, { ethers }) => {

      const bridge = BRIDGE_ADDRESS ;
      const contract = await ethers.getContractAt("Bridge", bridge);

      await contract.redeem(chainIds[chainfrom], chainIds[chainto], sender, recipient, amount, nonce, signature);
    }
  );

module.exports = {};