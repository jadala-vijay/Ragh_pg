// src/tenants.js — Tenants API (CRUD) — COMMONJS

const ddb = require("./db.js");
const {
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const TABLE = process.env.TENANTS_TABLE || "PGTenants";

// ---------- CORS RESPONSE ----------
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

// ADD TENANT
async function addTenant(event) {
  try {
    const body = JSON.parse(event.body);

    const item = {
      tenantId: Date.now().toString(),
      name: body.name,
      phone: body.phone,
      room: body.room,
      bed: body.bed,
      rent: body.rent,
      joinDate: body.joinDate,
      aadhaarFront: body.aadhaarFront || "",
      aadhaarBack: body.aadhaarBack || "",
      profile: body.profile || "",
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    return response(200, { message: "Tenant added", data: item });

  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

// GET ALL TENANTS
async function getTenants() {
  try {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE }));
    return response(200, res.Items || []);
  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

// GET SINGLE TENANT
async function getTenant(event) {
  try {
    const id = event.pathParameters.tenantId;

    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { tenantId: id },
      })
    );

    return response(200, res.Item || {});
  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

// UPDATE TENANT
async function updateTenant(event) {
  try {
    const id = event.pathParameters.tenantId;
    const body = JSON.parse(event.body);

    const updateExp = [];
    const values = {};

    Object.keys(body).forEach((key) => {
      updateExp.push(`${key} = :${key}`);
      values[`:${key}`] = body[key];
    });

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { tenantId: id },
        UpdateExpression: `SET ${updateExp.join(", ")}`,
        ExpressionAttributeValues: values,
      })
    );

    return response(200, { message: "Updated successfully" });

  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

// DELETE TENANT
async function deleteTenant(event) {
  try {
    const id = event.pathParameters.tenantId;

    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { tenantId: id } }));

    return response(200, { message: "Deleted successfully" });

  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

module.exports = {
  addTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant
};
