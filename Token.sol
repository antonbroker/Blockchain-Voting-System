pragma solidity 0.5.16;
contract Token {
    string public name = "VoteRewardToken";
    string public symbol = "VRT";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;




    constructor(uint256 _initialSupply) public {
        totalSupply = _initialSupply * (10 ** uint256(decimals));
        balanceOf[msg.sender] = totalSupply;
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        return true;
    }



}
