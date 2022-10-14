"use strict";
exports.__esModule = true;
exports.getClient = exports.getMockClient = void 0;
var twilio_1 = require("twilio");
var client;
// TODO: improve this dirty hack that I used to test localstack where twilio doesn't work.
// (rbd - 08/10/22)
var getMockClient = function () {
    return {
        chat: {
            v2: {
                services: function () { return ({
                    channels: {
                        get: function () { return ({
                            messages: {
                                list: function () { return [
                                    {
                                        sid: 1,
                                        dateCreated: 'blah',
                                        from: 'person1',
                                        body: 'hi',
                                        index: 0,
                                        type: 'message',
                                        media: 'blah'
                                    },
                                    {
                                        sid: 2,
                                        dateCreated: 'blah',
                                        from: 'person2',
                                        body: 'hi',
                                        index: 1,
                                        type: 'message',
                                        media: 'blah'
                                    },
                                ]; }
                            }
                        }); }
                    }
                }); }
            }
        }
    };
};
exports.getMockClient = getMockClient;
var getClientOrMock = function (_a) {
    var accountSid = _a.accountSid, authToken = _a.authToken;
    /**
     * Discussion:
     * I'd appreciate any suggestions on how to improve this pattern. The root problem is that
     * we want to be able to run local e2e mocks of the Twilio client but we don't have very
     * great control of the code running inside of the lambda from our test runner. (rbd - 10/10/2020)
     */
    if (authToken === 'mockAuthToken') {
        return (0, exports.getMockClient)();
    }
    return new twilio_1.Twilio(accountSid, authToken);
};
var getClient = function (_a) {
    var accountSid = _a.accountSid, authToken = _a.authToken;
    if (!client) {
        client = getClientOrMock({ accountSid: accountSid, authToken: authToken });
    }
    return client;
};
exports.getClient = getClient;
