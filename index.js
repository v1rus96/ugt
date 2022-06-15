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
// generate brackets
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
  return result;
});

let generateBracket = (number) => {
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
  let build_tree = (height, first, stop) => {
    // base case
    if (height == stop) {
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
    if (stop != 0 && height === 2) {
      leaf_queue.push(root);
    }
    root.left = build_tree(height - 1, (first = first * 2), stop);
    root.right = build_tree(height - 1, (first = first + 1), stop);
    return root;
  };

  let numOfParticipants = number;
  let numOfRounds = Math.ceil(Math.log2(numOfParticipants));
  let bracket = [];
  let leaf_queue = [];

  // number of node need to be added to the tree
  let remain =
    numOfParticipants - 2 ** Math.floor(Math.log2(numOfParticipants));
  let remain_queue = [];

  if (remain === 0) {
    root = build_tree(numOfRounds, 1, 0);
  } else {
    root = build_tree(numOfRounds, 1, 1);

    for (i = 0; i < remain; i++) {
      if (i % 2 == 0) {
        let data = {
          id: null,
          nextMatchId: leaf_queue[i / 2].getData().id,
          participants: [],
          startTime: "2021-05-30",
          state: "SCHEDULED",
          tournamentRoundText: 1,
        };

        let node = new Node(data);
        if (leaf_queue[i / 2].left == null) {
          leaf_queue[i / 2].left = node;
        } else {
          leaf_queue[i / 2].right = node;
        }

        remain_queue.push(node);
      } else {
        let data = {
          id: null,
          nextMatchId:
            leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].getData().id,
          participants: [],
          startTime: "2021-05-30",
          state: "SCHEDULED",
          tournamentRoundText: 1,
        };

        let node = new Node(data);
        if (
          leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].left == null
        ) {
          leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].left = new Node(
            data
          );
        } else {
          leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].right =
            new Node(data);
        }

        remain_queue.push(node);
      }
    }

    // sort remain_queue by nextMatchId
    console.log(remain);
    remain_queue = remain_queue.sort((a, b) => {
      return a.getData().next < b.getData().next ? -1 : 1;
    });

    // set id to each reamined node
    for (i = 0; i < remain_queue.length; i++) {
      remain_queue[i].getData().id = bracket.length + 1;
      bracket.push(remain_queue[i].getData());
    }
  }

  // sort bracket by id descending
  bracket = bracket.sort((a, b) => {
    return a.id < b.id ? 1 : -1;
  });

  return bracket;
};

// // get brackets
// api.get("/tournament/{id}/{type}/initialize_matches", async function (request) {
//   "use strict";
//   var id, type, params;
//   // Get the id from the pathParams
//   id = String(request.pathParams.id);
//   type = String(request.pathParams.type);
//   params = {
//     TableName: "ugt_test",
//     Key: {
//       ugtid: id,
//       status: type,
//     },
//   };
//   let tournament = await dynamoDb.get(params).promise();
//   // update the matches
//   params = {
//     TableName: "ugt_test",
//     Key: {
//       ugtid: id,
//       status: type,
//     },
//     UpdateExpression: "set matches = :p",
//     ExpressionAttributeValues: {
//       ":p": initialize_participants(
//         tournament.Item.participants,
//         tournament.Item.matches
//       ),
//     },
//     ReturnValues: "UPDATED_NEW",
//   };
//   let result = await dynamoDb.update(params).promise();
//   return result;
// });

// let initialize_participants = (participants, matches) => {
//   let new_matches = [];
//   for (i = 0; i < participants.length; i++) {
//     let data = {
//       id: participants[i].id,
//       name: participants[i].name,
//       score: 0,
//       rank: null,
//     };
//     new_matches[i].participants.push(data);
//   }
//   return new_matches;
// };

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
