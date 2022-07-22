/**
 * TODO: Allow admin to run all APIs
 * ? what should it return for error?
 *  ? username and createdBy is not match
 *  ? tournament id not found
 */

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

// get id token from request and decode
const getUsername = async (request) => {
  const authorization = request.headers.Authorization;
  if (authorization) {
    const parts = authorization.split(" ");
    if (parts.length === 2) {
      const scheme = parts[0];
      const credentials = parts[1];
      if (/^Bearer$/i.test(scheme)) {
        const userInfo = JSON.parse(
          Buffer.from(credentials.split(".")[1], "base64")
        );
        const username = userInfo["cognito:username"];
        return username;
      }
    }
  }
  return null;
};

// User Authication
api.registerAuthorizer("MyCognitoAuth", {
  providerARNs: [
    //"arn:aws:cognito-idp:ap-southeast-1:464335834479:userpool/ap-southeast-1_FcsDMk53F",
    "arn:aws:cognito-idp:ap-southeast-1:464335834479:userpool/ap-southeast-1_DlgtMn9jV",
  ],
});

// Create new tournament
api.post("/tournament", async function (request) {
  "use strict";
  // get id token from request and decode
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
      managers: [],
    },
  };
  // return dynamo result directly
  let result = await dynamoDb.put(params).promise();
  return params.Item;
}); // Return HTTP status 201 - Created when successful

// add manager to tournament
// ? maximum number of managers?
api.post("/tournament/{id}/{type}/manager", async function (request) {
  ("use strict");
  var id, type, params, name;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  name = String(request.body.name);

  var params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }

  // get username from request
  var username = await getUsername(request);
  // if username is equal to createdBy, add manager
  // ? data structures for manager is ok?
  if (data.createdBy === username) {
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
      UpdateExpression: "set managers = list_append(managers, :m)",
      ExpressionAttributeValues: {
        ":m": [name],
      },
      ReturnValues: "UPDATED_NEW",
    };
    let result = await dynamoDb.update(params).promise();
    return result;
  } else {
    return {
      statusCode: 401,
      body: JSON.stringify({
        message: "You are not authorized to add manager to this tournament",
      }),
    };
  }
});

// create new participant and add to tournament
api.post("/tournament/{id}/{type}/participant", async function (request) {
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
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }

  // if username is equal to createdBy or, in manager list, add participant
  const username = await getUsername(request);
  if (data.createdBy === username || data.managers.includes(username)) {
    params = {
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
            name: String(request.body.name),
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
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to add participant to this tournament",
      }),
    };
  }
}); // Return HTTP status 201 - Created when successful

// get all tournaments from db
// ? should this be exposed to public?
api.get("/tournaments", async function (request) {
  "use strict";
  var params = {
    TableName: "ugt_test",
  };
  let data = await dbRead(params);
  return data;
});

// find tournament by id
// ? if tournament not found?
// ? should this be exposed to public?
api.get("/tournament/{id}/{type}", async function (request) {
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
// ? should this be exposed to public?
// ? what should it return if tournament not found?
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
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  return data.participants;
});

// get all managers of a tournament
// ? should this be exposed to public?
// ? what should it return if tournament not found?
api.get("/tournament/{id}/{type}/managers", async function (request) {
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
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  return data.managers;
});

// get all matches of a tournament
// ? shoule this be exposed to public?
// ? what should it return if tournament not found?
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
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  return data.matches;
});

// update status of a tournament
// ? what should it return if tournament not found?
api.put("/tournament/{id}/{type}", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  // get username from request
  const username = await getUsername(request);
  // get tournament from db
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
      UpdateExpression: "set status = :s",
      ExpressionAttributeValues: {
        ":s": request.body.status,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let result = await dynamoDb.update(params).promise();
    return result;
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to update status of this tournament",
      }),
    };
  }
});

// reset participant list of a tournament
api.put("/tournament/{id}/{type}/participants/reset", async function (request) {
  "use strict";
  var id, type, params;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);

  // get tournament from db
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  // get username from request
  const username = await getUsername(request);
  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
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
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message:
          "You are not authorized to reset participant list of this tournament",
      }),
    };
  }
});

// delete all tournament in the database
// TODO: add authorization so that only the ADMIN can delete it
// ! this will delete all tournaments in the database
// api.delete(
//   "/tournaments",
//   async function (request) {
//     "use strict";
//     var params = {
//       TableName: "ugt_test",
//     };
//     let data = await dbRead(params);
//     for (let i = 0; i < data.length; i++) {
//       let params = {
//         TableName: "ugt_test",
//         Key: {
//           ugtid: data[i].ugtid,
//           status: data[i].status,
//         },
//       };
//       await dynamoDb.delete(params).promise();
//     }
//     return "deleted";
//   },
//
// );

// delete tournament with id
// ? what should it return if tournament not found?
api.delete("/tournament/{id}/{type}", async function (request) {
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

  // find participant from list
  let data = dbFind(params); // ? await dbFind(params) doesnt work
  // ? if I not use await, this will not be checked before cheking username
  // if tournament not found
  // if (!data) {
  //   return {
  //     statusCode: 404,
  //     body: JSON.stringify({
  //       message: "Tournament not found",
  //     }),
  //   };
  // }

  // get username from request
  const username = getUsername(request);
  // if username is equal to createdBy , delete tournament
  if (data.createdBy === username) {
    // return a completely different result when dynamo completes
    return dynamoDb
      .delete(params)
      .promise()
      .then(function () {
        return 'Deleted tournament with ugtid "' + id + '"';
      });
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to delete this tournament",
      }),
    };
  }
});

// delete a manager from a tournament by manager id
// ? what should it return if tournament not found?
api.delete(
  "/tournament/{id}/{type}/manager/{manager_name}",
  async function (request) {
    "use strict";
    var id, type, params, manager_name;
    // Get the id from the pathParams
    id = String(request.pathParams.id);
    type = String(request.pathParams.type);
    manager_name = String(request.pathParams.manager_name);
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
    };

    // get tournament from db by ugtid
    let data = await dbFind(params);
    // if tournament not found
    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Tournament not found",
        }),
      };
    }

    // get username from request
    const username = await getUsername(request);
    // if username is equal to createdBy or in manager list, update status
    if (data.createdBy === username || data.managers.includes(username)) {
      // find participant from list
      var managers = data.managers;
      const index = managers.findIndex((m) => m === manager_name);
      // if participant not found
      if (index === -1)
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: "Participant not found",
          }),
        };
      // update participant
      params = {
        TableName: "ugt_test",
        Key: {
          ugtid: id,
          status: type,
        },
        UpdateExpression: "remove managers[" + index + "]",
        ReturnValues: "UPDATED_NEW",
      };
      let result = await dynamoDb.update(params).promise();
      return result;
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message:
            "You are not authorized to delete manager from this tournament",
        }),
      };
    }
  }
);
// delete participant from tournament by participant id (update participant list)
// ? what should it return if tournament not found?
// ? what should it return if participant not found?
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

  // get tournament from db by ugtid
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }

  // get username from request
  const username = await getUsername(request);
  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
    // find participant from list
    var participants = data.participants;
    const index = participants.findIndex((p) => p.id === pid);
    // if participant not found
    if (index === -1)
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Participant not found",
        }),
      };
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
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to delete participant",
      }),
    };
  }
});
/*################################################
                BRACKET APIs
##############################################*/

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

let initialize_bracket = (matches, participants) => {
  let numOfMatches = matches.length;
  let numOfRoundOne = 2 ** (Math.log2(numOfMatches + 1) - 1);
  let firstMatches = matches.slice(numOfRoundOne - 1, numOfMatches);
  let numOfParticipants = participants.length;

  // reset all matches
  for (m of matches) {
    m.participants = [];
  }

  // decide where to assign participants
  for (i = 0; i < numOfParticipants; i++) {
    if (i % 2 == 0) {
      firstMatches[i / 2].participants.push(true);
    } else {
      firstMatches[
        firstMatches.length - 1 - Math.floor(i / 2)
      ].participants.push(true);
    }
  }

  // assign participants
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

      // set match state to "WALK_OVER"
      firstMatches[i].state = "WALK_OVER";
      // change walk over participant's status
      let wo = JSON.parse(JSON.stringify(participants[j]));
      wo.status = null;

      matches[firstMatches[i].nextMatchId - 1].participants.push(wo);
      j = j + 1;
    }
  }
  return matches;
};

// shuffle array
let shuffle = (array) => {
  for (let i = array.length - 1; i >= 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// create brackets
// ? what should it return if tournamnet is not found
api.post("/tournament/{id}/{type}/matches", async function (request) {
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
  // post-process dynamo result before returning
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  // get username from request
  const username = await getUsername(request);
  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
    params = {
      TableName: "ugt_test",
      Key: {
        ugtid: id,
        status: type,
      },
      UpdateExpression: "set matches = :p",
      ExpressionAttributeValues: {
        ":p": generateBracket(data.participants.length),
      },
      ReturnValues: "UPDATED_NEW",
    };

    let result = await dynamoDb.update(params).promise();
    return result;
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message:
          "You are not authorized to create brackets for this tournament",
      }),
    };
  }
});

// initalize the tournament
// ? what should it return if tournamnet is not found
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
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  // get username from request
  const username = await getUsername(request);

  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
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
    return result;
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to initialize this tournament",
      }),
    };
  }
});

// update the matches in the tournament to given array of matches
// ? what should it return if tournamnet is not found
api.put("/tournament/{id}/{type}/matches", async function (request) {
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
  // post-process dynamo result before returning
  let data = await dbFind(params);
  // if tournament not found
  if (!data) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }
  // get username from request
  const username = await getUsername(request);
  // if username is equal to createdBy or in manager list, update status
  if (data.createdBy === username || data.managers.includes(username)) {
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
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "You are not authorized to update this tournament",
      }),
    };
  }
});

// shuffle participants in the tournament
// ? what should it return if tournamnet is not found
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
    let data = await dbFind(params);
    // if tournament not found
    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Tournament not found",
        }),
      };
    }

    // get username from request
    const username = await getUsername(request);
    // if username is equal to createdBy or in manager list, update status
    if (data.createdBy === username || data.managers.includes(username)) {
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
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "You are not authorized to shuffle this tournament",
        }),
      };
    }
  }
);

// update participants in the tournament by given array of pariticpants
// ? what should it return if tournamnet is not found
api.put(
  "/tournament/{id}/{type}/update_participants",
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
    let data = await dbFind(params);
    // if tournament not found
    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Tournament not found",
        }),
      };
    }

    // get username from request
    const username = await getUsername(request);
    // if username is equal to createdBy or in manager list, update status
    if (data.createdBy === username || data.managers.includes(username)) {
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
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message:
            "You are not authorized to update participants of this tournament",
        }),
      };
    }
  }
);

// set next match
// ? what should it return if tournamnet is not found
api.put("/tournament/{id}/{type}/set_next_match", async function (request) {
  "use strict";
  var id, type, params, match;
  // Get the id from the pathParams
  id = String(request.pathParams.id);
  type = String(request.pathParams.type);
  match = request.body;
  // find the tournament
  params = {
    TableName: "ugt_test",
    Key: {
      ugtid: id,
      status: type,
    },
  };
  let tournament = await dbFind(params);
  // if tournament not found
  if (!tournament) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Tournament not found",
      }),
    };
  }

  // traverse matchs and if match is the same as the given match,set  the next match
  for (let i = 0; i < tournament.matches.length; i++) {
    if (tournament.matches[i].id === match.id) {
      // if after next match is not DONE and not WALK_OVER, edit match
      // Math.floor((i + 1) / 2) <= 1 ... matchId1,2,3 are always editable because there is no next-next match.
      if (
        Math.floor((i + 1) / 2) <= 1 ||
        tournament.matches[Math.floor(i / 4) - 1].state == "SCHEDULED" // ? == or ===
      ) {
        // set match state to DONE
        match.state = "DONE";
        // set participant status to PLAYED
        let p1 = match.participants[0];
        let p2 = match.participants[1];
        // set participant status to PLAYED
        p1.status = "PLAYED";
        p2.status = "PLAYED";

        // set winenr
        // if both score is not same, set the winner, else set status to PLAYED and others don't change
        if (Number(p1.resultText) > Number(p2.resultText)) {
          p1.isWinner = true;
          p2.isWinner = false;
        } else {
          p1.isWinner = false;
          p2.isWinner = true;
        }
        // if nextMatchId is not null, set participant to next match
        // if next match already set one of the participant from the match, delete it and change to the correct winner
        if (match.nextMatchId != null) {
          // if p1 or p2 is in the participant of next match, delete it
          // otherwise, if you call this api alot, number of participant in nextMatch can be more than two
          tournament.matches[Number(match.nextMatchId) - 1].participants =
            tournament.matches[
              Number(match.nextMatchId) - 1
            ].participants.filter((participant) => {
              return participant.id != p1.id && participant.id != p2.id;
            });

          // if both score is not same, push winner to next match
          if (Number(p1.resultText) != Number(p2.resultText)) {
            let winner = p1.isWinner ? p1 : p2;
            tournament.matches[Number(match.nextMatchId) - 1].participants.push(
              {
                id: winner.id,
                name: winner.name,
                status: null,
                resultText: null,
                isWinner: false,
              }
            );
          }
        }
        // set upadated to tounrmanet
        tournament.matches[i] = match;
        // update tournament
        let result = await updateTournament(tournament);
        return tournament.matches;
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: "This match is not allowed to edit",
          }),
        };
      }
    }
  }
});

const updateTournament = async (tournament) => {
  const result = await dynamoDb
    .update({
      TableName: "ugt_test",
      Key: {
        ugtid: tournament.ugtid,
        status: tournament.status,
      },
      UpdateExpression:
        "set title = :title, game = :game, startDate = :startDate, endDate = :endDate, registrationDate = :registrationDate, imgUrl = :imgUrl, createdBy = :createdBy, device = :device, country = :country, playtype = :playtype, participants = :participants, matches = :matches, managers = :managers",
      ExpressionAttributeValues: {
        ":title": tournament.title,
        ":game": tournament.game,
        ":startDate": tournament.startDate,
        ":endDate": tournament.endDate,
        ":registrationDate": tournament.registrationDate,
        ":imgUrl": tournament.imgUrl,
        ":createdBy": tournament.createdBy,
        ":device": tournament.device,
        ":country": tournament.country,
        ":playtype": tournament.playtype,
        ":participants": tournament.participants,
        ":matches": tournament.matches,
        ":managers": tournament.managers,
      },
    })
    .promise();
  return result;
};

api.addPostDeployConfig("tableName", "DynamoDB Table Name:", "configure-db");
