// src/auth.js (COMMONJS VERSION)

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

// DynamoDB Table
const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLE = process.env.PG_OWNER_TABLE || "PGOwner";

const JWT_SECRET = process.env.JWT_SECRET || "change_me_to_secure_value";
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const TOKEN_EXP = process.env.JWT_EXP || "7d";

const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDoc = DynamoDBDocumentClient.from(ddbClient);

/* ---------- CORS RESPONSE ---------- */
function lambdaResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

/* ---------- Register Owner ---------- */
async function registerOwner(event) {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const name = (body.name || "").trim();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";

    if (!name || !email || !password) {
      return lambdaResponse(400, { error: "name, email and password are required." });
    }

    // Check if owner exists
    const getCmd = new GetCommand({
      TableName: TABLE,
      Key: { ownerId: email }
    });

    const existing = await ddbDoc.send(getCmd);

    if (existing?.Item) {
      return lambdaResponse(409, { error: "Owner with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = new Date().toISOString();

    const putCmd = new PutCommand({
      TableName: TABLE,
      Item: {
        ownerId: email,
        name,
        email,
        passwordHash: hashed,
        createdAt
      },
      ConditionExpression: "attribute_not_exists(ownerId)"
    });

    await ddbDoc.send(putCmd);

    const token = jwt.sign({ ownerId: email, name, email }, JWT_SECRET, {
      expiresIn: TOKEN_EXP
    });

    return lambdaResponse(201, {
      message: "Owner registered",
      owner: { ownerId: email, name, email },
      token
    });

  } catch (err) {
    console.error("registerOwner error:", err);
    return lambdaResponse(500, { error: "Internal server error" });
  }
}

/* ---------- Login Owner ---------- */
async function loginOwner(event) {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";

    if (!email || !password) {
      return lambdaResponse(400, { error: "email and password are required." });
    }

    const getCmd = new GetCommand({
      TableName: TABLE,
      Key: { ownerId: email }
    });

    const res = await ddbDoc.send(getCmd);

    if (!res?.Item) {
      return lambdaResponse(401, { error: "Invalid credentials" });
    }

    const owner = res.Item;

    const ok = await bcrypt.compare(password, owner.passwordHash || "");
    if (!ok) {
      return lambdaResponse(401, { error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { ownerId: owner.ownerId, name: owner.name, email: owner.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXP }
    );

    return lambdaResponse(200, {
      message: "Login successful",
      owner: {
        ownerId: owner.ownerId,
        name: owner.name,
        email: owner.email
      },
      token
    });

  } catch (err) {
    console.error("loginOwner error:", err);
    return lambdaResponse(500, { error: "Internal server error" });
  }
}

/* ---------- JWT Verify (Helper) ---------- */
function verifyTokenFromEvent(event) {
  try {
    const authHeader =
      event?.headers?.authorization ||
      event?.headers?.Authorization ||
      "";

    if (!authHeader)
      return { ok: false, error: "Missing Authorization header" };

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer")
      return { ok: false, error: "Invalid Authorization header" };

    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);

    return { ok: true, payload };

  } catch (err) {
    return { ok: false, error: "Invalid token" };
  }
}

module.exports = {
  registerOwner,
  loginOwner,
  verifyTokenFromEvent
};
