const { expect } = require("chai");
const Web3 = require('web3');
const { keccak256, toUtf8Bytes } = require("ethers/lib/utils");

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let bridge1, bridge2, token1, token2, sender, recipient, validator;

const chainFrom = 4;
const chainTo = 97;

let nonce, amount, message, signature;



describe('Contract: Bridge', () => {
	
	beforeEach(async () => {
		[validator, sender, recipient] = await ethers.getSigners();
		let Token = await ethers.getContractFactory('Token');
		token1 = await Token.deploy('My Token0', 'MTKN0');
		token2 = await Token.deploy('My Token1', 'MTKN1');

		let Bridge = await ethers.getContractFactory('Bridge');
		bridge1 = await Bridge.deploy(token1.address, chainFrom);
		bridge2 = await Bridge.deploy(token2.address, chainTo);

		await bridge1.setChainId(chainTo, true);
		await bridge2.setChainId(chainFrom, true);

		const minter = keccak256(toUtf8Bytes("MINTER"))
		const burner = keccak256(toUtf8Bytes("BURNER"))
		let validator_role = keccak256(toUtf8Bytes("VALIDATOR"))

		await token1.grantRole(minter, bridge1.address)
		await token1.grantRole(minter, validator.address)
		await token1.grantRole(burner, bridge1.address)
		await token2.grantRole(minter, bridge2.address)
		await token2.grantRole(burner, bridge2.address)

		await bridge1.grantRole(validator_role, validator.address)
		await bridge2.grantRole(validator_role, validator.address)

		nonce = 1;
		amount = 1000000;
		await token1.mint(sender.address, 10000000000);
		message = keccak256(ethers.utils.defaultAbiCoder.encode(
		['uint256','uint256','address','address','uint256','uint256'],
		[chainFrom, chainTo, sender.address,recipient.address, amount, nonce]))			
		signature = await web3.eth.sign(validator.address, message);
	});

	describe('Test swap', () => {

		it('Should create swap', async () => {				
			await expect(bridge1.connect(sender).initSwap(chainFrom, chainTo, recipient.address, amount, nonce, signature))
				.to.emit(bridge1, 'InitSwap').withArgs(chainFrom, chainTo, sender.address, recipient.address, amount, nonce, signature);
			
			const swap = await bridge1.swaps(message);
			expect(swap).to.equal(1);
		});
	
		it('Should revert if the swap is not empty', async() => {		
			await bridge1.connect(sender).initSwap(chainFrom,  chainTo, recipient.address, amount, nonce, signature);

			await expect( bridge1.connect(sender).initSwap(chainFrom, chainTo, recipient.address, amount, nonce, signature)).to.be.revertedWith('swap status must be EMPTY');		
		});

		it('Should revert if chain ID is wrong', async() => {
			await expect(bridge1.initSwap(0, chainTo, recipient.address, amount, nonce, signature)).to.be.revertedWith('wrong chainId');
		})

		it('Should revert if chain ID is not allowed', async() => {
			await expect(bridge1.initSwap(chainFrom, 0, recipient.address, amount, nonce, signature)).to.be
				.revertedWith('_chainTo is not allowed');
		})

	})

	describe('Test redeem', () => {

		it('Should create swap with REDEEM status and emit event', async () => {		
			await expect(bridge2.connect(recipient).redeem(chainFrom, chainTo, sender.address, recipient.address, amount, nonce, signature))
				.to.emit(bridge2, 'Redeem').withArgs(chainFrom, chainTo, sender.address, recipient.address, amount, nonce);
			
			const swap = await bridge2.swaps(message);
			expect(swap).to.equal(2);
		 })

		it('Should revert if the swap is not empty', async () => {
			await bridge2.connect(recipient).redeem(chainFrom, chainTo, sender.address, recipient.address, amount, nonce, signature);

			await expect(bridge2.connect(recipient).redeem(chainFrom, chainTo, sender.address, recipient.address, amount, nonce, signature))
				.to.be.revertedWith('swap status must be EMPTY');			
		})

		it('Should revert if validator is wrong', async () => {
			message = keccak256(ethers.utils.defaultAbiCoder.encode(
				['uint256','uint256','address','address','uint256','uint256'],
				[chainFrom, chainTo, sender.address,recipient.address, amount, nonce]))
			const signature = await web3.eth.sign(recipient.address, message);			
			
			await expect(bridge2.connect(recipient).redeem(chainFrom, chainTo, sender.address, recipient.address, amount, nonce, signature))
				.to.be.revertedWith('wrong validator');			
		})

		it('Should revert if chain ID is wrong', async() => {
			await expect(bridge2.connect(recipient).redeem(chainFrom, 0, sender.address, recipient.address, amount, nonce, signature))
				.to.be.revertedWith('wrong chainId');
		})

		it('Should revert if chain ID is not allowed', async() => {
			await expect(bridge2.connect(recipient).redeem(0, chainTo, sender.address, recipient.address, amount, nonce, signature))
				.to.be.revertedWith('_chainTo is not allowed');
		})

	})

	describe('Other methods', () => {

		it('Should update token address', async() => {
			await bridge1.updateTokenAddress(token2.address);
			expect(await bridge1.addressOfToken()).to.equal(token2.address);
		})

		it('Should not update token address if caller is not admin', async() => {
			await expect(bridge1.connect(sender).updateTokenAddress(token2.address))
				.to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42');
		})

		it('Should update chain ID', async() => {
			await bridge1.updateChainId(100);
			expect(await bridge1.chainId()).to.equal(100);
		})

		it('Should not update chain ID if caller is not admin', async() => {
			await expect(bridge1.connect(sender).updateChainId(100))
				.to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42');
		})

		it('Should allows or denies connection to another chain IDs', async() => {
			await bridge1.setChainId(100, true);
			expect(await bridge1.chainList(100)).to.equal(true);

			await bridge1.setChainId(100, false);
			expect(await bridge1.chainList(100)).to.equal(false);
		})

		it('Should not allows or denies connection to another chain IDs if caller is not admin', async() => {
			await expect(bridge1.connect(sender).setChainId(100, true))
				.to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42');
		})
	})
})