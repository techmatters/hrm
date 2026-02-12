"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const categories_1 = require("../../contact/categories");
describe('test retrieveCategories', () => {
    test('undefined/null categories', async () => {
        expect((0, categories_1.retrieveCategories)(undefined)).toStrictEqual({});
        expect((0, categories_1.retrieveCategories)(null)).toStrictEqual({});
    });
    test('should return 1 category', async () => {
        const categories = {
            category1: { something1: false, another1: true },
            category2: { something2: false, another2: false },
            category3: { something3: false, another3: false },
            category4: { something4: false, another4: false },
            category5: { something5: false, another5: false },
            category6: { something6: false, another6: false },
        };
        const result = (0, categories_1.retrieveCategories)(categories);
        expect(Object.keys(result)).toHaveLength(1);
        expect(result.category1).toHaveLength(1);
        expect(result.category1[0]).toBe('another1');
    });
    test('should return 2 categories', async () => {
        const categories = {
            category1: { something1: false, another1: true },
            category2: { something2: false, another2: false },
            category3: { something3: false, another3: false },
            category4: { something4: true, another4: false },
            category5: { something5: false, another5: false },
            category6: { something6: false, another6: false },
        };
        const result = (0, categories_1.retrieveCategories)(categories);
        expect(Object.keys(result)).toHaveLength(2);
        expect(result.category1).toHaveLength(1);
        expect(result.category1[0]).toBe('another1');
        expect(result.category4).toHaveLength(1);
        expect(result.category4[0]).toBe('something4');
    });
    test('should return 2 categories, 3 subs', async () => {
        const categories = {
            category1: { something1: false, another1: true },
            category2: { something2: false, another2: false },
            category3: { something3: false, another3: false },
            category4: { something4: true, another4: true },
            category5: { something5: false, another5: false },
            category6: { something6: false, another6: false },
        };
        const result = (0, categories_1.retrieveCategories)(categories);
        expect(Object.keys(result)).toHaveLength(2);
        expect(result.category1).toHaveLength(1);
        expect(result.category1[0]).toBe('another1');
        expect(result.category4).toHaveLength(2);
        expect(result.category4[0]).toBe('something4');
        expect(result.category4[1]).toBe('another4');
    });
    test('should return 3 categories', async () => {
        const categories = {
            category1: { something1: false, another1: true },
            category2: { something2: false, another2: false },
            category3: { something3: false, another3: false },
            category4: { something4: true, another4: false },
            category5: { something5: false, another5: false },
            category6: { something6: true, another6: false },
        };
        const result = (0, categories_1.retrieveCategories)(categories);
        expect(Object.keys(result)).toHaveLength(3);
        expect(result.category1).toHaveLength(1);
        expect(result.category1[0]).toBe('another1');
        expect(result.category4).toHaveLength(1);
        expect(result.category4[0]).toBe('something4');
        expect(result.category6).toHaveLength(1);
        expect(result.category6[0]).toBe('something6');
    });
});
