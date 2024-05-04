pragma solidity 0.5.16;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract Election {
    address public constant admin = address(0x2BC17f7Dbad683Aab8aB1aF49206C5C3a267504d); //your admin address here, the value is for example
    IERC20 public tokenContract;
    
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    mapping(address => bool) public voters;
    mapping(uint => Candidate) public candidates;
    uint public candidatesCount;

    uint public startTime;
    uint public endTime;

    event votedEvent(uint indexed _candidateId);

    constructor(address _tokenContractAddress) public {
        tokenContract = IERC20(_tokenContractAddress);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "This function is restricted to the contract's admin");
        _;
    }

    modifier isVotingOpen() {
        require(now >= startTime && now <= endTime, "Voting is not open.");
        _;
    }

    function addCandidate(string memory _name) private onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
    }

    function addCandidatePublic(string memory _name) public onlyAdmin {
        addCandidate(_name);
    }

    function setVotingPeriod(uint _startTime, uint _endTime) public onlyAdmin {
        require(_endTime > _startTime, "End time must be after start time.");
        startTime = _startTime;
        endTime = _endTime;
    }

    function vote(uint _candidateId) public isVotingOpen {
        require(!voters[msg.sender], "You have already voted.");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Not a valid candidate.");
        voters[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        
        require(tokenContract.transfer(msg.sender, 1 * (10 ** uint256(tokenContract.decimals()))), "Token transfer failed.");

        emit votedEvent(_candidateId);
    }
}
