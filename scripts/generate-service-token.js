"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const jwt = __importStar(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('Error: JWT_SECRET environment variable is required');
    process.exit(1);
}
const args = process.argv.slice(2);
const expiresInIndex = args.indexOf('--expires-in');
const expiresIn = expiresInIndex !== -1 ? args[expiresInIndex + 1] : '90d';
const payload = {
    sub: 'stats-worker',
    role: 'SERVICE',
    scope: ['stats:read', 'stats:write'],
};
const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    jwtid: crypto.randomUUID(),
});
console.log('');
console.log('=== Stats Service Token ===');
console.log('');
console.log(`Expires in: ${expiresIn}`);
console.log('');
console.log('Token:');
console.log(token);
console.log('');
console.log('Store this in AWS Secrets Manager as STATS_SERVICE_JWT');
console.log('');
//# sourceMappingURL=generate-service-token.js.map