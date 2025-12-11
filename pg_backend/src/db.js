// db.js — DynamoDB Client Configuration (COMMONJS)

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const ddb = DynamoDBDocumentClient.from(client);

module.exports = ddb;
