"use strict";
exports.__esModule = true;
exports.handler = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
var helloWorld_1 = require("./helloWorld");
var handler = function () {
    (0, helloWorld_1.helloWorld)();
};
exports.handler = handler;
