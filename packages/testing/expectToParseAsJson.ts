/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

// Declares this module as an 'external module' so augmentations can be added to global scope.
export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toParseAsEqualJson(json?: any): R;
    }
    interface Expect {
      toParseAsEqualJson(json?: any): any;
    }
  }
}

// Usage: This is a custom matcher for Jest, it extends the expect object with a new matcher.
// So you just need to import this file in your test file and it will be available, you don't need to import any symbols from it.
// i.e. import '@tech-matters/testing/expectToParseAsJson';
expect.extend({
  toParseAsEqualJson(received: string, expected?: any) {
    let parsedReceived: any;
    try {
      parsedReceived = JSON.parse(received);
    } catch (e) {
      return {
        pass: false,
        message: () =>
          `Expected received object '${received}' to be a parseable json. Error: ${e}`,
      };
    }
    if (expected) {
      let parsedExpected: any;
      try {
        parsedExpected = typeof expected === 'string' ? JSON.parse(expected) : expected;
      } catch (e) {
        return {
          pass: false,
          message: () =>
            `Expected comparison object '${expected}' to be a parseable json. Error: ${e}`,
        };
      }
      try {
        expect(parsedReceived).toStrictEqual(parsedExpected);
      } catch (e) {
        return {
          pass: false,
          message: () =>
            `Expected '${received}' to parse from json to object equal to '${expected}'. Error: ${e}`,
        };
      }
    }
    return {
      pass: true,
      message: () =>
        `Expected '${received}' to parse from json to object equal to ${expected}.`,
    };
  },
});
