/*global require, module*/
var ApiBuilder = require("claudia-api-builder"),
  AWS = require("aws-sdk"),
  api = new ApiBuilder(),
  dynamoDb = new AWS.DynamoDB.DocumentClient(),
  ShortUniqueId = require("short-unique-id");
const uid = new ShortUniqueId({ length: 5 });
uid.setDictionary("number");

module.exports = api;

async function dbRead(params) {
  let promise = dynamoDb.scan(params).promise();
  let result = await promise;
  let data = result.Items;
  if (result.LastEvaluatedKey) {
    params.ExclusiveStartKey = result.LastEvaluatedKey;
    data = data.concat(await dbRead(params));
  }
  return data;
}

async function dbFind(params) {
  let promise = dynamoDb.get(params).promise();
  let result = await promise;
  return result.Item;
}

// Create new tournament
api.post(
  "/tournament",
  function (request) {
    "use strict";
    var params = {
      TableName: "ugt_test",
      Item: {
        ugtid: uid(),
        title: request.body.title,
        status: request.body.status,
        game: request.body.game,
        startDate: request.body.startDate,
        endDate: request.body.endDate,
        registrationDate: request.body.registrationDate,
        imgUrl: request.body.imgUrl,
        createdBy: request.body.createdBy,
        device: request.body.device,
        country: request.body.country,
        playtype: request.body.playtype,
        participants: [],
        matches: [],
      },
    };
    // return dynamo result directly
    return dynamoDb.put(params).promise();
  },
  { success: 201 }
); // Return HTTP status 201 - Created when successful

//create new participant and add to tournament
api.post("/tournament/{id}/{type}/participant", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  var params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "set participants = list_append(participants, :p)",
    ExpressionAttributeValues: {
      ":p": [
        {
          id: uid(),
          name: request.body.name,
        },
      ],
    },
    ReturnValues: "UPDATED_NEW",
  };
  let result = await dynamoDb.update(params).promise();
  return result;
});

// get all tournaments
api.get("/tournaments", async function (request) {
  "use strict";
  var params = {
    TableName: "ugt_test",
  };
  let data = await dbRead(params);
  return data;
});

// find tournament by id
api.get("/tournament/{id}/{type}", function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  // post-process dynamo result before returning
  return dynamoDb
    .get(params)
    .promise()
    .then(function (response) {
      return response.Item;
    });
});

// get all participants of a tournament
api.get("/tournament/{id}/{type}/participants", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let data = await dbFind(params);
  return data.participants;
});

// get all matches of a tournament
api.get("/tournament/{id}/{type}/matches", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let data = await dbFind(params);
  return data.matches;
});

// reset participant list of a tournament
api.put("/tournament/{id}/{type}/participants/reset", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "set participants = :p",
    ExpressionAttributeValues: {
      ":p": [],
    },
    ReturnValues: "UPDATED_NEW",
  };
  let result = await dynamoDb.update(params).promise();
  return result;
});

// delete tournament with id
api.delete(
  "/tournament/{id}/{type}",
  function (request) {
    "use strict";
    var id, type, params;
    // Get the id from the pathParams
    id = String(request.pathParams.id);
    type = String(request.pathParams.type);
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
    };
    // return a completely different result when dynamo completes
    return dynamoDb
      .delete(params)
      .promise()
      .then(function () {
        return 'Deleted tournament with ugtid "' + id + '"';
      });
  },
  { success: { contentType: "text/plain" } }
);

////////////////////////////////////////////////////////////////
// brakets
// The number of match = num of participants -1
// The number of rounds Math.ceil(Math.log2(num of participants))
////////////////////////////////////////////////////////////////

// create brackets
api.post("/tournament/{id}/{type}/matches", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "set matches = :p",
    ExpressionAttributeValues: {
      ":p": generateBracket(request.body.size),
    },
    ReturnValues: "UPDATED_NEW",
  };

  let result = await dynamoDb.update(params).promise();
});

function generateBracket(number) {
  let numOfParticipants = number;
  let numOfMatches = numOfParticipants - 1;
  let numOfRounds = Math.ceil(Math.log2(numOfParticipants));
  let matchId = 0;
  let placed = 0; // to check how many participants placed to the match
  let bracket = [];
  let match;

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
  let roundParticipants = numRoundMatches * 2;

  let next = numRoundMatches + 1; // next match ( numRoundMatches is the number of matches in the round)

  if (numOfParticipants % 2 == 0) {
    for (i = 0; i < roundParticipants; i++) {
      if (i % 2 == 0) {
        ++matchId;
        placed += 2; // two persons are placed

        if (matchId % 2 == 1 && matchId != 1) {
          ++next;

          match = {
            id: matchId,
            nextMatchId: next,
            participants: [],
            startTime: "2021-05-30",
            state: "SCHEDULED",
            tournamentRoundText: "1",
          };
          bracket.push(match);
        } else {
          match = {
            id: matchId,
            nextMatchId: next,
            participants: [],
            startTime: "2021-05-30",
            state: "SCHEDULED",
            tournamentRoundText: "1",
          };
          bracket.push(match);
        }
      }
    }
  } else {
    for (i = 0; i < roundParticipants; i++) {
      if (i % 2 == 0) {
        ++matchId;
        placed += 2;

        if (matchId % 2 == 0) {
          ++next;

          match = {
            id: matchId,
            nextMatchId: next,
            participants: [],
            startTime: "2021-05-30",
            state: "SCHEDULED",
            tournamentRoundText: "1",
          };
          bracket.push(match);
        } else {
          match = {
            id: matchId,
            nextMatchId: next,
            participants: [],
            startTime: "2021-05-30",
            state: "SCHEDULED",
            tournamentRoundText: "1",
          };
          bracket.push(match);
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
          match = {
            id: matchId,
            nextMatchId: next,
            participants: [],
            startTime: "2021-05-30",
            state: "SCHEDULED",
            tournamentRoundText: round.toString(),
          };
          bracket.push(match);

          if (next <= numOfMatches) {
            match = {
              id: matchId,
              nextMatchId: next,
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          } else {
            match = {
              id: matchId,
              nextMatchId: null,
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          }

          placed += 1;
          flag = false;
          continue;
        }

        // if there are other participants remained
        if (placed < numOfParticipants) {
          // check if it is final or not
          if (next <= numOfMatches) {
            match = {
              id: matchId,
              nextMatchId: next,
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          } else {
            match = {
              id: matchId,
              nextMatchId: null,
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          }

          placed += 2;
        } else {
          if (next <= numOfMatches) {
            match = {
              id: matchId,
              nextMatchId: next,
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          } else {
            match = {
              id: matchId,
              nextMatchId: "null",
              participants: [],
              startTime: "2021-05-30",
              state: "SCHEDULED",
              tournamentRoundText: round.toString(),
            };
            bracket.push(match);
          }
        }
      }
    }
    ++round;
    roundParticipants = roundParticipants - numRoundMatches;
  }

  return bracket;
}

api.addPostDeployConfig("tableName", "DynamoDB Table Name:", "configure-db");
