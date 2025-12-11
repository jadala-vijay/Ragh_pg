// payments.js
// ==============================
// PG Payments System - FINAL (with duplicate-month protection: BLOCK ANY second entry for same tenant/month/year)
// ==============================

const ddb = require("./db.js");
const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE || "PGPayments";
const TENANTS_TABLE = process.env.TENANTS_TABLE || "PGTenants";

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const monthIndex = (m) => MONTHS.indexOf(m);
const monthSeq = (m, y) => y * 12 + monthIndex(m);
const monthName = (idx) => MONTHS[(idx % 12 + 12) % 12];

/* ------------------------------------------------------
   FETCH TENANT
-------------------------------------------------------*/
async function getTenant(id) {
  if (!id) return null;

  const res = await ddb.send(
    new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenantId: id },
    })
  );

  return res.Item || null;
}

/* ------------------------------------------------------
   ADD PAYMENT (with duplicate month blocking)
   BLOCK RULE: if ANY payment exists for tenantId+month+year -> Reject (409)
-------------------------------------------------------*/
async function addPayment(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const tenantId = body.tenantId || body.tenantID;
    const month = body.month;
    const year = Number(body.year);

    if (!tenantId || !month || !year) {
      return response(400, { error: "tenantId, month and year are required" });
    }

    // Load tenant
    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return response(400, { error: "Tenant not found: " + tenantId });
    }

    // --- CHECK DUPLICATE: ANY record same tenantId + month + year
    // Use a Scan with FilterExpression that matches month & year & tenantId
    const dupCheck = await ddb.send(
      new ScanCommand({
        TableName: PAYMENTS_TABLE,
        FilterExpression: "tenantId = :t AND #m = :m AND #y = :y",
        ExpressionAttributeNames: { "#m": "month", "#y": "year" },
        ExpressionAttributeValues: { ":t": tenantId, ":m": month, ":y": year },
        Limit: 1,
      })
    );

    if (dupCheck.Items && dupCheck.Items.length > 0) {
      // Block because rule B: only one entry per tenant-month-year allowed (regardless of status)
      return response(409, { error: "Payment already exists for this tenant and month/year" });
    }

    // Fetch prior payments to see if this is the first payment ever
    const existing = await ddb.send(
      new ScanCommand({
        TableName: PAYMENTS_TABLE,
        FilterExpression: "tenantId = :t",
        ExpressionAttributeValues: { ":t": tenantId },
        Limit: 1,
      })
    );

    const isFirst = !(existing.Items && existing.Items.length > 0);

    // FORCE rent to use frontend input OR tenant.rent
    const rent = Number(body.rent ?? tenant.rent ?? 0);

    // Deposit / maintenance only for first payment
    const deposit = isFirst ? Number(body.deposit ?? 0) : 0;
    const maintenance = isFirst ? Number(body.maintenance ?? 0) : 0;

    const createdAt = new Date().toISOString();

    // Build item to store
    const item = {
      paymentId: Date.now().toString(),
      tenantId,
      tenantName: tenant.name,
      room: tenant.room,
      month,
      year,
      rent,
      deposit,
      maintenance,
      method: body.method || "Cash",
      status: body.status || "paid",
      date: body.date || createdAt.slice(0, 10),
      createdAt,
    };

    // Put payment
    await ddb.send(
      new PutCommand({
        TableName: PAYMENTS_TABLE,
        Item: item,
      })
    );

    // Update tenant.rent ONCE if first payment
    if (isFirst && Number(tenant.rent) !== rent) {
      await ddb.send(
        new UpdateCommand({
          TableName: TENANTS_TABLE,
          Key: { tenantId },
          UpdateExpression: "SET rent = :r",
          ExpressionAttributeValues: { ":r": rent },
        })
      );
    }

    // Auto-create dues (no overwrite) for months between joinDate and paid month
    const joinDate = tenant.joinDate;
    let startSeq = null;

    if (joinDate) {
      const jd = new Date(joinDate);
      if (!isNaN(jd)) startSeq = jd.getFullYear() * 12 + jd.getMonth();
    }

    const paidSeq = monthSeq(month, Number(year));
    if (startSeq === null) startSeq = paidSeq;

    const baseRent = rent;

    for (let s = startSeq; s < paidSeq; s++) {
      const m = monthName(s);
      const y = Math.floor(s / 12);

      const exists = await ddb.send(
        new ScanCommand({
          TableName: PAYMENTS_TABLE,
          FilterExpression: "tenantId = :t AND #m = :m AND #y = :y",
          ExpressionAttributeNames: { "#m": "month", "#y": "year" },
          ExpressionAttributeValues: { ":t": tenantId, ":m": m, ":y": y },
          Limit: 1,
        })
      );

      if (!exists.Items || exists.Items.length === 0) {
        await ddb.send(
          new PutCommand({
            TableName: PAYMENTS_TABLE,
            Item: {
              paymentId: `due-${tenantId}-${y}-${m}-${Date.now()}`,
              tenantId,
              tenantName: tenant.name,
              room: tenant.room,
              month: m,
              year: y,
              rent: baseRent,
              deposit: 0,
              maintenance: 0,
              method: "pending",
              status: "pending",
              date: null,
              createdAt: new Date().toISOString(),
            },
          })
        );
      }
    }

    return response(200, { message: "Payment saved", created: item });
  } catch (err) {
    console.error(err);
    return response(500, { error: err.toString() });
  }
}

/* ------------------------------------------------------
   GET ALL PAYMENTS
-------------------------------------------------------*/
async function getPayments() {
  try {
    const res = await ddb.send(new ScanCommand({ TableName: PAYMENTS_TABLE }));
    return response(200, res.Items || []);
  } catch (err) {
    return response(500, { error: err.toString() });
  }
}

/* ------------------------------------------------------
   Simple get / update / delete
-------------------------------------------------------*/
async function getPayment(event) {
  const id = event.pathParameters.paymentId;
  const res = await ddb.send(
    new GetCommand({
      TableName: PAYMENTS_TABLE,
      Key: { paymentId: id },
    })
  );
  return response(200, res.Item || {});
}

async function updatePayment(event) {
  const id = event.pathParameters.paymentId;
  const body = JSON.parse(event.body || "{}");

  const exp = [];
  const names = {};
  const values = {};

  for (const key of Object.keys(body)) {
    exp.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = body[key];
  }

  await ddb.send(
    new UpdateCommand({
      TableName: PAYMENTS_TABLE,
      Key: { paymentId: id },
      UpdateExpression: "SET " + exp.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return response(200, { message: "Updated" });
}

async function deletePayment(event) {
  const id = event.pathParameters.paymentId;

  await ddb.send(
    new DeleteCommand({
      TableName: PAYMENTS_TABLE,
      Key: { paymentId: id },
    })
  );

  return response(200, { message: "Deleted" });
}

module.exports = {
  addPayment,
  getPayments,
  getPayment,
  updatePayment,
  deletePayment,
};
