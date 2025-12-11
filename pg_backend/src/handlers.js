// handlers.js
// Central export hub for all Lambda functions

// ===== TENANTS =====
import {
  addTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant
} from "./tenants.js";

// ===== PAYMENTS =====
import {
  addPayment,
  getPayments,
  getTenantPayments,
  updatePayment,
  deletePayment
} from "./payments.js";

// ===== AUTH (LOGIN / REGISTER OWNER) =====
import {
  registerOwner,
  loginOwner
} from "./auth.js";

/*
  IMPORTANT:
  Serverless Framework loads each function from the file
  where the handler is defined.

  Example YAML:
    registerOwner:
      handler: src/auth.registerOwner

  So this handlers.js file simply RE-EXPORTS the functions
  for optional use but is NOT needed as a handler path.

  KEEP THIS FILE CLEAN AND SIMPLE.
*/

// Export ALL handlers for optional direct imports
export {
  // Tenants
  addTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant,

  // Payments
  addPayment,
  getPayments,
  getTenantPayments,
  updatePayment,
  deletePayment,

  // Authentication
  registerOwner,
  loginOwner
};
