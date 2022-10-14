"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.loadSsmCache = exports.loadPaginated = exports.addToCache = exports.ssmCache = void 0;
var aws_sdk_1 = require("aws-sdk");
// This is based around the pattern found in https://github.com/ryands17/lambda-ssm-cache
// This allows endpoint override for localstack I haven't found a better way to do this globally yet
var ssmConfig = process.env.SSM_ENDPOINT ? { endpoint: process.env.SSM_ENDPOINT } : {};
var ssm = new aws_sdk_1.SSM(ssmConfig);
exports.ssmCache = { values: {} };
var addToCache = function (regex, _a) {
    var _b = _a.Name, Name = _b === void 0 ? null : _b, _c = _a.Value, Value = _c === void 0 ? null : _c;
    if (!Name)
        return;
    if (regex && !regex.test(Name))
        return;
    exports.ssmCache.values[Name] = Value;
};
exports.addToCache = addToCache;
var hasCacheExpired = function () { return !!(exports.ssmCache.expiryDate && new Date() > exports.ssmCache.expiryDate); };
var isConfigNotEmpty = function () { return !!Object.keys(exports.ssmCache.values).length; };
var loadPaginated = function (_a) {
    var path = _a.path, regex = _a.regex, nextToken = _a.nextToken;
    return __awaiter(void 0, void 0, void 0, function () {
        var resp;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, ssm
                        .getParametersByPath({
                        MaxResults: 10,
                        Path: path,
                        Recursive: true,
                        WithDecryption: true,
                        NextToken: nextToken
                    })
                        .promise()];
                case 1:
                    resp = _c.sent();
                    (_b = resp.Parameters) === null || _b === void 0 ? void 0 : _b.forEach(function (p) { return (0, exports.addToCache)(regex, p); });
                    if (!resp.NextToken) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, exports.loadPaginated)({
                            path: path,
                            regex: regex,
                            nextToken: resp.NextToken
                        })];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
};
exports.loadPaginated = loadPaginated;
var loadSsmCache = function (_a) {
    var _b = _a.expiryTime, cacheDuration = _b === void 0 ? 3600000 : _b, configs = _a.configs;
    return __awaiter(void 0, void 0, void 0, function () {
        var promises;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!exports.ssmCache.expiryDate) {
                        exports.ssmCache.expiryDate = new Date(Date.now() + cacheDuration);
                    }
                    if (isConfigNotEmpty() && !hasCacheExpired())
                        return [2 /*return*/];
                    promises = configs.map(function (config) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, (0, exports.loadPaginated)(config)];
                    }); }); });
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
};
exports.loadSsmCache = loadSsmCache;
