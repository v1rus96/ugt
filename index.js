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
      ":p": [request.body.participant],
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

api.addPostDeployConfig("tableName", "DynamoDB Table Name:", "configure-db");
