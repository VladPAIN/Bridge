require("dotenv").config();

async function deployBridge() {
  const Bridge = await hre.ethers.getContractFactory("Bridge");
  const token = '0x2e3A98c7844413a95996A34e40a0F319e68c1d45';
  const chainId = 42;


  const bridge = await Bridge.deploy(token, chainId);
  console.log("Bridge address: ", bridge.address);
  await bridge.deployed();

  await new Promise((resolve) => setTimeout(resolve, 60000));

  try {
    await hre.run("verify:verify", {
      address: bridge.address,
      contract: "contracts/Bridge.sol:Bridge",
      constructorArguments: [token, chainId],
    });
    console.log("verify success");
  } catch (e) {
    console.log(e);
  }
}

deployBridge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });