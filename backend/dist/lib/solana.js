"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROGRAM_ID = exports.connection = void 0;
exports.getAuthorityKeypair = getAuthorityKeypair;
require("dotenv/config");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const network = process.env.SOLANA_NETWORK ?? 'devnet';
exports.connection = new web3_js_1.Connection(`https://api.${network}.solana.com`, 'confirmed');
exports.PROGRAM_ID = new web3_js_1.PublicKey(process.env.PROGRAM_ID ?? '3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9');
let _keypair = null;
function getAuthorityKeypair() {
    if (_keypair)
        return _keypair;
    const b58Key = process.env.SOLANA_PRIVATE_KEY;
    if (!b58Key)
        throw new Error('SOLANA_PRIVATE_KEY not set in environment');
    _keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(b58Key));
    return _keypair;
}
//# sourceMappingURL=solana.js.map