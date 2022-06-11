let numOfParticipants = 6;
let numOfMatches = numOfParticipants - 1;
let numOfRounds = Math.ceil(Math.log2(numOfParticipants));
let matchId = 0;
let placed = 0; // to check how many participants placed to the match

console.log("==================================");
console.log("num of match: " + numOfMatches);
console.log("num of rounds: " + numOfRounds);
console.log("==================================");

// claculate the number of matches in the round
// set number of participants in the round as parameter
let calcMatches = (numOfParticipants) => {
  let numRoundMatches = Math.log2(numOfParticipants);
  if (!Number.isInteger(numRoundMatches)) {
    numRoundMatches = numOfParticipants - 2 ** Math.floor(numRoundMatches);
  } else {
    numRoundMatches = 2 ** (numRoundMatches - 1);
  }

  return numRoundMatches;
};

let numRoundMatches = calcMatches(numOfParticipants);
console.log("Round1: " + numRoundMatches + "matches");
let roundParticipants = numRoundMatches * 2;

let next = numRoundMatches + 1; // next match ( numRoundMatches is the number of matches in the round)

if (numOfParticipants % 2 == 0) {
  for (i = 0; i < roundParticipants; i++) {
    if (i % 2 == 0) {
      ++matchId;
      placed += 2; // two persons are placed
      console.log("matchId: " + matchId);
      console.log(i + "vs" + (i + 1));

      if (matchId % 2 == 1 && matchId != 1) {
        ++next;
        console.log("next: " + next);
      } else {
        console.log("next: " + next);
      }
    }
  }
} else {
  for (i = 0; i < roundParticipants; i++) {
    if (i % 2 == 0) {
      ++matchId;
      placed += 2;
      console.log("matchId: " + matchId);
      console.log(i + "vs" + (i + 1));

      if (matchId % 2 == 0) {
        ++next;
        console.log("next: " + next);
      } else {
        console.log("next: " + next);
      }
    }
  }
}

let round = 2;
roundParticipants = numOfParticipants - numRoundMatches;
let flag = numOfParticipants % 2 == 1 ? true : false;

// 2nd round to final round
while (round <= numOfRounds) {
  numRoundMatches = calcMatches(roundParticipants);
  console.log("\nRound" + round + ": " + numRoundMatches + "matches");

  for (let i = 0; i < roundParticipants; i++) {
    if (i % 2 === 0) {
      ++matchId;

      if (matchId % 2 == 1 && numOfParticipants % 2 == 0) {
        ++next;
      } else if (matchId % 2 == 0 && numOfParticipants % 2 == 1) {
        ++next;
      }

      // if the number of participants are odd, add bracket for one
      if (flag) {
        console.log("matchId: " + matchId);
        console.log(placed + " vs " + "tbd");

        if (next < numOfMatches) {
          console.log("next: " + next);
        } else {
          console.log("next: " + "null");
        }

        placed += 1;
        flag = false;
        continue;
      }

      // if there are other participants remained
      if (placed < numOfParticipants) {
        console.log("matchId: " + matchId);
        console.log(placed + " vs " + (placed + 1));

        // check if it is final or not
        if (next < numOfMatches) {
          console.log("next: " + next);
        } else {
          console.log("next: " + "null");
        }

        placed += 2;
      } else {
        console.log("matchId: " + matchId);
        console.log("tbd" + " vs " + "tbd");

        if (next < numOfMatches) {
          console.log("next: " + next);
        } else {
          console.log("next: " + "null");
        }
      }
    }
  }
  ++round;
  roundParticipants = roundParticipants - numRoundMatches;
}
