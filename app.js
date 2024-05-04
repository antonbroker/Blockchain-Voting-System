App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,
  adminAddress: null, 
  isInitialized: false,
  candidatePreferences: {}, 

  init: function() {
    if (App.isInitialized) return Promise.resolve();
    App.isInitialized = true;

    var storedPreferences = localStorage.getItem('candidatePreferences');
    if (storedPreferences) {
        App.candidatePreferences = JSON.parse(storedPreferences);
        console.log("Loaded candidate preferences from localStorage.");
    } else {
        console.log("No candidate preferences found in localStorage, initializing new object.");
        App.candidatePreferences = {};
    }

    return App.initWeb3()
        .then(App.initContract)
        .then(App.render)
        .then(App.setupEventListeners)
        .catch(function(error) {
            console.error("Error during app initialization:", error);
        });
  },

  encryptWithAES: function(text, passphrase) {
    return CryptoJS.AES.encrypt(text, passphrase).toString();
  },

  setupEventListeners: function() {
    var clearTableBtn = document.getElementById('clearTableBtn');
    if (clearTableBtn) {
        clearTableBtn.addEventListener('click', function() {
            localStorage.removeItem('votes');
            App.clearElectionBookTable();
        });
    }

    var clearPreferencesBtn = document.getElementById('clearPreferencesBtn');
    if (clearPreferencesBtn) {
        if (App.account && App.adminAddress && App.account.toLowerCase() === App.adminAddress.toLowerCase()) {
            clearPreferencesBtn.style.display = 'block';
            clearPreferencesBtn.addEventListener('click', function() {
                localStorage.removeItem('candidatePreferences');
                App.candidatePreferences = {};
                console.log('Candidate preferences cleared.');
                App.render();
            });
        } else {
            clearPreferencesBtn.style.display = 'none';
        }
    }

    var showPreferencesBtn = document.getElementById('showPreferencesBtn');
    if (showPreferencesBtn) {
        showPreferencesBtn.style.display = 'block';
        showPreferencesBtn.addEventListener('click', App.showFruitPreferences);
    }
  },

  

  initWeb3: function() {
    return new Promise(function(resolve, reject) {
      if (window.ethereum) {
        App.web3Provider = window.ethereum;
        try {
          window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(accounts) {
            web3 = new Web3(App.web3Provider);
            App.account = accounts[0].toLowerCase();
            App.listenForAccountChange();
            resolve();
          }).catch(reject);
        } catch (error) {
          reject(error);
        }
      } else if (window.web3) {
        App.web3Provider = window.web3.currentProvider;
        web3 = new Web3(App.web3Provider);
        resolve();
      } else {
        App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
        web3 = new Web3(App.web3Provider);
        resolve();
      }
    });
  },

  listenForAccountChange: function() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', function(accounts) {
        window.location.reload();
      });
    }
  },

  initContract: function() {
    return new Promise(function(resolve, reject) {
        $.getJSON("Election.json", function(election) {
            App.contracts.Election = TruffleContract(election);
            App.contracts.Election.setProvider(App.web3Provider);
        }).then(function() {
            App.contracts.Election.deployed().then(function(instance) {
                return instance.admin();
            }).then(function(adminAddress) {
                App.adminAddress = adminAddress;
                console.log("Admin address:", adminAddress);
                
                $.getJSON("Token.json", function(token) {
                    App.contracts.Token = TruffleContract(token);
                    App.contracts.Token.setProvider(App.web3Provider);
                    resolve();
                });
            }).catch(function(err) {
                console.error('Error while fetching admin address:', err);
                reject(err);
            });
        }).fail(reject);
    });
  },



  render: function() {
    var loader = $("#loader");
    var content = $("#content");
    var adminSection = $("#adminSection");

    loader.show();
    content.hide();
    web3.eth.getCoinbase((err, account) => {
        if (err === null) {
            App.account = account.toLowerCase();

            $("#accountAddress").html("Your Account: " + account.substr(0,20) +"...");
            App.contracts.Election.deployed().then(async function(instance) {
                var now = new Date().getTime() / 1000;
                const [startTime, endTime, candidatesCount] = await Promise.all([ 
                    instance.startTime(),
                    instance.endTime(),
                    instance.candidatesCount(),
                ]).then(results => results.map(result => result.toNumber()));

                var isAdmin = App.account === App.adminAddress.toLowerCase();
                var isElectionEnded = now > endTime;

                if (isAdmin) {
                    adminSection.show();
                    $('#voteButton').hide();
                    $('#adminMessage').show().text('Admin accounts cannot vote.');
                } else {
                    adminSection.hide();
                }

                App.updateVotingPeriodDisplay(instance);

                var candidatesResults = $("#candidatesResults");
                candidatesResults.empty();

                var candidatesSelect = $('#candidatesSelect');
                candidatesSelect.empty();

                var candidatesArray = [];
                for (let i = 1; i <= candidatesCount; i++) {
                    const candidate = await instance.candidates(i);
                    candidatesArray.push({
                        id: candidate[0].toNumber(),
                        name: candidate[1],
                        votes: candidate[2].toNumber()
                    });
                }

                if (isElectionEnded) {
                    candidatesArray.sort((a, b) => b.votes - a.votes);
                }

                candidatesArray.forEach(candidate => {
                  if(isAdmin){
                    var votesDisplay = candidate.votes
                  }
                  else{
                    var votesDisplay = isElectionEnded ? candidate.votes : "Hidden";
                }
                    var candidateOption = `<option value='${candidate.id}'>${candidate.name}</option>`;
                    var candidateTemplate = `<tr><th>${candidate.id}</th><td>${candidate.name}</td><td>${votesDisplay}</td></tr>`;

                    candidatesSelect.append(candidateOption);
                    candidatesResults.append(candidateTemplate);
                });

                if (await instance.voters(App.account)) {
                    $('form').hide();
                }
                loader.hide();
                content.show();
            }).catch((error) => {
                console.error("Error loading contract data:", error);
            });
        }
    });
  },

  updateVotingPeriodDisplay: function(instance) {
    let now = new Date().getTime();
    instance.startTime().then(function(startTime) {
        var start = new Date(startTime * 1000).toLocaleString();
        $('#votingStart').text(start);

        instance.endTime().then(function(endTime) {
            var end = new Date(endTime * 1000).toLocaleString();
            $('#votingEnd').text(end);

            if (now >= startTime * 1000 && now <= endTime * 1000) {
                App.startCountdown(endTime * 1000);
                $('#voteButton').prop('disabled', false).removeClass('btn-secondary').addClass('btn-primary');
            } else {
                if (now < startTime * 1000) {
                    $('#timer').html("Election has not started yet.");
                } else {
                    $('#timer').html("Election is closed.");
                }
                $('#voteButton').prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary');
            }
        }).catch(function(err) {
            console.error("Error fetching end time:", err);
        });
    }).catch(function(err) {
        console.error("Error fetching start time:", err);
    });
  },

  startCountdown: function(endTime) {
    var countdownFunction = function() {
        var now = new Date().getTime();
        var timeleft = endTime - now;
        var days = Math.floor(timeleft / (1000 * 60 * 60 * 24));
        var hours = Math.floor((timeleft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((timeleft % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((timeleft % (1000 * 60)) / 1000);
        $('#timer').html(days + "d " + hours + "h " + minutes + "m " + seconds + "s ");

        if (timeleft < 0) {
            clearInterval(x);
            $('#timer').html("Election has ended.");
            window.location.reload();
        }
    };
    var x = setInterval(countdownFunction, 1000);
    countdownFunction();
  },

  clearElectionBookTable: function() {
    localStorage.removeItem("votes");
    $("#electionBookTable").empty();
  },

  castVote: async function() {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.deployed().then(async function(instance) {
        const candidate = await instance.candidates(candidateId);
        const candidateName = candidate[1];
        instance.vote(candidateId, { from: App.account }).then(function(txReceipt) {
            web3.eth.getBlock(txReceipt.receipt.blockNumber, async function(error, block) {
                if (!error) {
                    const timestamp = new Date(block.timestamp * 1000).toLocaleString();
                    const voteInfo = {
                        candidateName: candidateName,
                        candidateId: candidateId,
                        account: App.encryptWithAES(App.account, "Sparta"),
                        timestamp: timestamp
                    };
                    let votes = JSON.parse(localStorage.getItem("votes")) || [];
                    votes.push(voteInfo);
                    localStorage.setItem("votes", JSON.stringify(votes));

                    alert("Vote successful! Token reward will be processed.");
                } else {
                    console.error("Error fetching block:", error);
                }
            });
            $("#content").hide();
            $("#loader").show();
            App.render();
        }).catch(function(err) {
            console.error("Error casting vote:", err);
        });
    });
  },


  addCandidate: function() {
    var candidateName = $('#candidateName').val().trim();
    if (!candidateName) {
        alert('Candidate name cannot be empty.');
        return;
    }

    if (App.candidatePreferences.hasOwnProperty(candidateName)) {
        alert('Candidate already exists. Please enter a different name.');
        return;
    }

    App.tempCandidateName = candidateName;

    $('#addCandidateButton').prop('disabled', true);

    $('#fruitPreferenceModal').modal('show');
    setTimeout(function() {
      App.contracts.Election.deployed().then(function(instance) {
          return instance.addCandidatePublic(candidateName, { from: App.account });
      }).then(function() {
          console.log("Candidate successfully added:", candidateName);
          window.location.reload();
      }).catch(function(err) {
          console.error('Error while adding candidate:', err);
          $('#addCandidateButton').prop('disabled', false);
      });
  }, 5000);
    
  },


  setVotingPeriod: function() {
    var startTimeInput = $('#startTime').val();
    var endTimeInput = $('#endTime').val();
    var startTime = new Date(startTimeInput).getTime() / 1000;
    var endTime = new Date(endTimeInput).getTime() / 1000;

    if (startTime >= endTime) {
        alert('Start time must be before end time.');
        return;
    }

    App.contracts.Election.deployed().then(function(instance) {
        return instance.setVotingPeriod(startTime, endTime, { from: App.account });
    }).then(function(result) {
        console.log('Voting period set successfully.');
        window.location.reload();
    }).catch(function(err) {
        console.error('Error setting voting period:', err);
    });
  },
  showFruitPreferences: function() {
    var tableBody = $("#preferencesTableBody");
    tableBody.empty();

    for (var candidateName in App.candidatePreferences) {
      var prefs = App.candidatePreferences[candidateName];
      var row = `<tr>
        <td>${candidateName}</td>
        <td>${prefs.apple ? 'Yes' : 'No'}</td> 
        <td>${prefs.banana ? 'Yes' : 'No'}</td>
        <td>${prefs.kiwi ? 'Yes' : 'No'}</td>
        <td>${prefs.strawberry ? 'Yes' : 'No'}</td>
        <td>${prefs.melon ? 'Yes' : 'No'}</td>
      </tr>`;
      tableBody.append(row);
    }

    $('#fruitPreferencesModal').modal('show');
  },
  handleFruitPreference: function() {
    var candidateName = App.tempCandidateName;
    
    if (!candidateName || App.candidatePreferences.hasOwnProperty(candidateName)) {
        console.error("Error: Candidate name is missing or already exists.");
        $('#fruitPreferenceModal').modal('hide');
        return;
    }
    

    var prefs = {
        apple: $('#appleCheck').is(':checked'),
        banana: $('#bananaCheck').is(':checked'),
        kiwi: $('#kiwiCheck').is(':checked'),
        strawberry: $('#strawberryCheck').is(':checked'),
        melon: $('#melonCheck').is(':checked')
    };

    App.candidatePreferences[candidateName] = prefs;
    localStorage.setItem('candidatePreferences', JSON.stringify(App.candidatePreferences));

    $('#fruitPreferenceModal').modal('hide'); 
    $('#addCandidateButton').prop('disabled', false);
    App.tempCandidateName = null;

    console.log("Preferences saved for candidate:", candidateName);
  
    
  },

};
