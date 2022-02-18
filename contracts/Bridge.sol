pragma solidity ^0.8.10;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./ERC20.sol";

contract Bridge is AccessControl {
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant VALIDATOR = keccak256("VALIDATOR");

    address public addressOfToken;
    uint256 public chainId;
    mapping(bytes32 => Status) public swaps;
    mapping(uint256 => bool) public chainList;

    constructor(address _addressOfToken, uint256 _chainId) {
        addressOfToken = _addressOfToken;
        chainId = _chainId;
        _setupRole(ADMIN, msg.sender);
        _setRoleAdmin(VALIDATOR, ADMIN);
    }

    enum Status { EMPTY, SWAP, REDEEM }

    event InitSwap(uint256 chainFrom, uint256 chainTo, address sender, address recipient, uint256 amount, uint256 nonce);
    event Redeem(uint256 chainFrom, uint256 chainTo, address sender, address recipient, uint256 amount, uint256 nonce);

    function updateTokenAddress(address _addressOfToken) public onlyRole(ADMIN) {
        addressOfToken = _addressOfToken;
    }

    function updateChainId(uint256 _chainId) public onlyRole(ADMIN) {
        chainId = _chainId;
    }

    function setChainId(uint _chainId, bool _boolean) onlyRole(ADMIN) public {
        chainList[_chainId] = _boolean;
    }

    function initSwap(uint256 _chainFrom, uint256 _chainTo, address _recipient, uint256 _amount, uint256 _nonce, bytes memory _signature) external onlyChainId(_chainFrom) onlyAllowedChainId(_chainTo) {
        bytes32 hash = keccak256(abi.encode(_chainFrom, _chainTo, msg.sender, _recipient, _amount, _nonce));

        require(swaps[hash] == Status.EMPTY, "swap status must be EMPTY");
        swaps[hash] = Status.SWAP;
        Token(addressOfToken).burn(msg.sender, _amount);

        emit InitSwap(_chainFrom,  _chainTo, msg.sender, _recipient, _amount, _nonce);
    }

    function redeem(uint256 _chainFrom, uint256 _chainTo, address _sender, address _recipient, uint256 _amount, uint256 _nonce, bytes memory _signature) external onlyChainId(_chainTo) onlyAllowedChainId(_chainFrom) {
        bytes32 hash = keccak256(abi.encode(_chainFrom, _chainTo, _sender, _recipient, _amount, _nonce));

        require(swaps[hash] == Status.EMPTY, "swap status must be EMPTY");
        bytes32 _hashToEth = ECDSA.toEthSignedMessageHash(hash);
        address validator = ECDSA.recover(_hashToEth, _signature);

        require(hasRole(VALIDATOR, validator), "wrong validator");
        Token(addressOfToken).mint(_recipient, _amount);
        swaps[hash] = Status.REDEEM;
        
        emit Redeem(_chainFrom, _chainTo, _sender, _recipient, _amount, _nonce);
    }

    modifier onlyChainId(uint256 _chainId) {
        require(chainId == _chainId, "wrong chainId");
        _;
    }

    modifier onlyAllowedChainId(uint256 _chainId) {
        require(chainList[_chainId] == true, "_chainTo is not allowed");
        _;
    }
}
