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
          status: null,
          resultText: null,
          isWinner: false,
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

// delete participant from tournament by participant id (update participant list)
api.delete("/tournament/{id}/{type}/{pid}", async function (request) {
  "use strict";
  var id, type, params, pid;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  pid = String(request.pathParams.pid);
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };

  // find participant from list
  let data = await dbFind(params);
  var participants = data.participants;
  const index = participants.findIndex((p) => p.id === pid);
  if (index === -1) return 0; // if participant not found, return 0

  // update participant
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "remove participants[" + index + "]",
    ReturnValues: "UPDATED_NEW",
  };
  let result = await dynamoDb.update(params).promise();
  return result;
});

////////////////////////////////////////////////////////////////
// generate brackets
////////////////////////////////////////////////////////////////

// create brackets
api.post("/tournament/{id}/{type}/matches", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  // find the tournament
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
  let data = await dbFind(params);

  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "set matches = :p",
    ExpressionAttributeValues: {
      ":p": generateBracket_test(data.participants.length),
    },
    ReturnValues: "UPDATED_NEW",
  };

  let result = await dynamoDb.update(params).promise();
  return result;
});

let generateBracket_test = (number) => {
  class Node {
    constructor(data) {
      this.left = null;
      this.right = null;
      this.data = data;
    }

    getData() {
      return this.data;
    }

    setData(data) {
      this.data = data;
    }
  }

  // build perfect tree
  let build_tree = (height, first) => {
    // base case
    if (height == 0) {
      return null;
    }

    // root node doesn't has next match
    let next = Math.floor(first / 2);
    if (next == 0) {
      next = null;
    }

    data = {
      id: first,
      nextMatchId: next,
      participants: [],
      startTime: "2021-05-30",
      state: "SCHEDULED",
      tournamentRoundText: height,
    };

    let root = new Node(data);
    bracket.push(data);

    root.left = build_tree(height - 1, (first = first * 2));
    root.right = build_tree(height - 1, (first = first + 1));
    return root;
  };

  let numOfParticipants = number;
  let numOfRounds = Math.ceil(Math.log2(numOfParticipants));
  let bracket = [];
  root = build_tree(numOfRounds, 1, 0);

  // sort bracket by id descending
  bracket = bracket.sort((a, b) => {
    return a.id > b.id ? 1 : -1;
  });

  return bracket;
};

// initalize the tournament
api.put("/tournament/{id}/{type}/init", async function (request) {
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
  let data = await dbFind(params);

  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
    UpdateExpression: "set matches = :p",
    ExpressionAttributeValues: {
      ":p": initialize_bracket(data.matches, data.participants),
    },
    ReturnValues: "UPDATED_NEW",
  };
  let result = await dynamoDb.update(params).promise();
  return initialize_bracket(data.matches, data.participants);
});

let initialize_bracket = (matches, participants) => {
  let numOfMatches = matches.length;
  let numOfRoundOne = 2 ** (Math.log2(numOfMatches + 1) - 1);
  let firstMatches = matches.slice(numOfRoundOne - 1, numOfMatches);
  let numOfParticipants = participants.length;

  // reset all matches
  for (m of matches) {
    m.participants = [];
  }

  // set participants
  for (i = 0; i < numOfParticipants; i++) {
    if (i % 2 == 0) {
      firstMatches[i / 2].participants.push(true);
    } else {
      firstMatches[
        firstMatches.length - 1 - Math.floor(i / 2)
      ].participants.push(true);
    }
  }

  for (i = 0, j = 0; i < firstMatches.length; i++) {
    if (firstMatches[i].participants.length == 2) {
      firstMatches[i].participants = [];
      firstMatches[i].participants.push(participants[j]);
      firstMatches[i].participants.push(participants[j + 1]);
      j = j + 2;
    } else if (firstMatches[i].participants.length == 1) {
      firstMatches[i].participants = [];
      participants[j].status = "WALK_OVER";
      firstMatches[i].participants.push(participants[j]);

      // change walk over participant's status
      let wo = JSON.parse(JSON.stringify(participants[j]));
      wo.status = null;

      matches[firstMatches[i].nextMatchId - 1].participants.push(wo);
      j = j + 1;
    }
  }
  return matches;
};

// update the matches in the tournament
api.put("/tournament/{id}/{type}/matches", async function (request) {
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
      ":p": request.body,
    },
    ReturnValues: "UPDATED_NEW",
  };
  let result = await dynamoDb.update(params).promise();
  return result;
});

// shuffle participants in the tournament
api.put(
  "/tournament/{id}/{type}/shuffle_participants",
  async function (request) {
    "use strict";
    var id, type, params;
    // Get the id from the pathParams
    id = String(request.pathParams.id);
    type = String(request.pathParams.type);
    // find the tournament
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
    };
    let tournament = await dynamoDb.get(params).promise();

    // shuffle the participants
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
      UpdateExpression: "set participants = :p",
      ExpressionAttributeValues: {
        ":p": shuffle(tournament.Item.participants),
      },
      ReturnValues: "UPDATED_NEW",
    };
    let result = await dynamoDb.update(params).promise();
    return result;
  }
);

let shuffle = (array) => {
  for (let i = array.length - 1; i >= 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// update participants in the tournament by given array of pariticpants
api.put(
  "/tournament/{id}/{type}/update_participants",
  async function (request) {
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
        ":p": request.body,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let result = await dynamoDb.update(params).promise();
    return result;
  }
);

api.addPostDeployConfig("tableName", "DynamoDB Table Name:", "configure-db");
