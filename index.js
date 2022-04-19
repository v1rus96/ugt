/*global require, module*/
var ApiBuilder = require('claudia-api-builder'),
	AWS = require('aws-sdk'),
	api = new ApiBuilder(),
	dynamoDb = new AWS.DynamoDB.DocumentClient(),
    ShortUniqueId = require('short-unique-id');
const uid = new ShortUniqueId({ length: 5 });
uid.setDictionary('number');

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
api.post('/tournament', function (request) {
	'use strict';
	var params = {
		TableName: request.env.tableName,
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
		}
	};
	// return dynamo result directly
	return dynamoDb.put(params).promise();
}, { success: 201 }); // Return HTTP status 201 - Created when successful

//create new participant
api.post('/tournament/{id}/participant', async function (request) {
    'use strict';
    var params = {
        TableName: request.env.tableName,
        Key: {
            ugtid: request.pathParams.id
        },
        UpdateExpression: "set participants = list_append(participants, :p)",
        ExpressionAttributeValues: {
            ":p": [request.body.participant]
        },
        ReturnValues: "UPDATED_NEW"
    };
    let result = await dynamoDb.update(params).promise();
    return result;
});

api.get('/tournaments', async function (request) {
    'use strict';
    var params = {
        TableName: request.env.tableName,
    };
    let data = await dbRead(params);
    return data;
});

api.get('/tournament/{id}', function (request) {
    'use strict';
    var id, params;
	// Get the id from the pathParams
	id = String(request.pathParams.id);
    params = {
        TableName: request.env.tableName,
        Key: {
            ugtid: id
        }
    };
    return dbFind(params);
});

// get user for {id}
api.get('/tournament/{id}/{type}', function (request) {
	'use strict';
	var id, type, params;
	// Get the id from the pathParams
	id = String(request.pathParams.id);
    type = String(request.pathParams.type);
	params = {
		TableName: request.env.tableName,
		Key: {
			ugtid: id,
            status: type
		}
	};

	// post-process dynamo result before returning
	return dynamoDb.get(params).promise().then(function (response) {
		return response.Item;
	});
});

// delete user with {id}
api.delete('/tournament/{id}/{type}', function (request) {
	'use strict';
	var id, type, params;
	// Get the id from the pathParams
	id = String(request.pathParams.id);
	type = String(request.pathParams.type);
	params = {
		TableName: request.env.tableName,
		Key: {
			ugtid: id,
            status: type
		}
	};
	// return a completely different result when dynamo completes
	return dynamoDb.delete(params).promise()
		.then(function () {
			return 'Deleted user with id "' + id + '"';
		});
}, {success: { contentType: 'text/plain'}});

api.addPostDeployConfig('tableName', 'DynamoDB Table Name:', 'configure-db');