"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateElasticsearchQuery = exports.generateESQuery = exports.MATCH_ALL_CLAUSE = exports.FILTER_ALL_CLAUSE = void 0;
const hrmIndexDocumentMappings_1 = require("./hrmIndexDocumentMappings");
const types_1 = require("@tech-matters/types");
const BOOST_FACTORS = {
    id: 10,
    transcript: 1,
    number: 2,
    contact: 2,
    case: 3,
};
const MIN_SCORE = 0.1;
exports.FILTER_ALL_CLAUSE = [
    [
        {
            bool: {
                must_not: { match_all: {} },
            },
        },
    ],
];
exports.MATCH_ALL_CLAUSE = [
    {
        match_all: {},
    },
];
const getFieldName = (p) => {
    const prefix = p.parentPath ? `${p.parentPath}.` : '';
    return `${prefix}${String(p.field)}`;
};
const getSimpleQueryStringFields = (p) => {
    const prefix = p.parentPath ? `${p.parentPath}.` : '';
    return p.fields.map(f => `${prefix}${String(f.field)}${f.boost ? `^${f.boost}` : ''}`);
};
/** Utility function that creates a filter based on a more human-readable representation */
const generateESQuery = (p) => {
    switch (p.type) {
        case 'term': {
            return {
                term: {
                    [getFieldName(p)]: { value: p.term, boost: p.boost },
                },
            };
        }
        case 'range': {
            return {
                range: {
                    [getFieldName(p)]: p.ranges,
                },
            };
        }
        case 'queryString': {
            return {
                query_string: {
                    default_field: getFieldName(p),
                    query: p.query,
                    ...(p.boost && { boost: p.boost }),
                },
            };
        }
        case 'simpleQueryString': {
            return {
                simple_query_string: {
                    fields: getSimpleQueryStringFields(p), // typecast to conform TS, only valid parameters should be accept
                    query: p.query,
                    flags: 'FUZZY|NEAR|PHRASE|WHITESPACE',
                },
            };
        }
        case 'mustNot': {
            return {
                bool: {
                    must_not: (0, exports.generateESQuery)(p.innerQuery),
                },
            };
        }
        case 'nested': {
            return {
                nested: {
                    path: String(p.path),
                    query: {
                        bool: {
                            must: [(0, exports.generateESQuery)(p.innerQuery)],
                        },
                    },
                },
            };
        }
        default: {
            return (0, types_1.assertExhaustive)(p);
        }
    }
};
exports.generateESQuery = generateESQuery;
const generateQueryFromSearchTerms = ({ searchTerm, documentType, fields, parentPath, queryWrapper = p => p, }) => {
    const query = (0, exports.generateESQuery)(queryWrapper({
        documentType,
        type: 'simpleQueryString',
        query: searchTerm,
        fields: fields, // typecast to conform TS, only valid parameters should be accept
        parentPath,
    }));
    return query;
};
const generateTranscriptQueriesFromFilters = ({ transcriptFilters, searchParameters, buildParams = { parentPath: '' }, queryWrapper = p => p, }) => {
    const query = generateQueryFromSearchTerms({
        documentType: hrmIndexDocumentMappings_1.DocumentType.Contact,
        fields: [{ field: 'transcript', boost: BOOST_FACTORS.transcript }],
        searchTerm: searchParameters.searchTerm,
        parentPath: buildParams.parentPath,
        queryWrapper,
    });
    return transcriptFilters.map(filter => ({
        bool: {
            filter: filter,
            should: {
                bool: { must: [query] },
            },
        },
    }));
};
const generateContactNumberQueries = ({ searchParameters, buildParams = { parentPath: '' }, queryWrapper = p => p, }) => {
    const terms = searchParameters.searchTerm.split(' ');
    const numericTerms = (searchParameters.searchTerm.match(/[\d\s\-]{8,}/g) || []) // find sequences of 8 consecutive numbers, maybe separed by spaces or dashes
        .map(t => t && t.trim());
    // filter duplicates
    const numberTerms = Array.from(new Set([
        ...terms,
        ...numericTerms.flatMap(t => {
            const sanitized = t.replaceAll(/[\s\-]/g, ''); // remove spaces or dashes if any
            return [t, `+${t}`, sanitized, `+${sanitized}`]; // use original format and sanitized
        }),
    ]));
    return [
        generateQueryFromSearchTerms({
            documentType: hrmIndexDocumentMappings_1.DocumentType.Contact,
            fields: [
                {
                    field: 'number',
                    boost: BOOST_FACTORS.number * BOOST_FACTORS.contact,
                },
            ],
            searchTerm: numberTerms.join(' OR '),
            parentPath: buildParams.parentPath,
            queryWrapper,
        }),
    ];
};
const generateContactsQueriesFromFilters = ({ searchParameters, buildParams = { parentPath: '' }, queryWrapper = p => p, }) => {
    const { searchFilters, permissionFilters } = searchParameters;
    if (searchParameters.searchTerm.length === 0) {
        return permissionFilters.contactFilters.map(contactFilter => ({
            bool: {
                filter: [...contactFilter, ...searchFilters],
                should: exports.MATCH_ALL_CLAUSE,
            },
        }));
    }
    const transcriptQueries = generateTranscriptQueriesFromFilters({
        transcriptFilters: permissionFilters.transcriptFilters,
        searchParameters,
        buildParams,
        queryWrapper,
    });
    const numberQueries = generateContactNumberQueries({
        searchParameters,
        buildParams,
        queryWrapper,
    });
    const queries = [
        generateQueryFromSearchTerms({
            documentType: hrmIndexDocumentMappings_1.DocumentType.Contact,
            fields: [
                {
                    field: 'content',
                    boost: BOOST_FACTORS.contact,
                },
                {
                    field: 'id',
                    boost: BOOST_FACTORS.id * BOOST_FACTORS.contact,
                },
            ],
            searchTerm: searchParameters.searchTerm,
            parentPath: buildParams.parentPath,
            queryWrapper,
        }),
        ...numberQueries,
    ];
    const contactQueries = permissionFilters.contactFilters.map(contactFilter => ({
        bool: {
            filter: [...contactFilter, ...searchFilters],
            should: [
                ...queries.map(q => ({
                    bool: { must: [q] },
                })),
                ...transcriptQueries,
            ],
        },
    }));
    return contactQueries;
};
const generateContactsQuery = ({ index, searchParameters, }) => {
    const { pagination } = searchParameters;
    return {
        index,
        highlight: {
            fields: { '*': {} },
        },
        sort: searchParameters.searchTerm.length === 0
            ? [{ timeOfContact: 'desc' }]
            : ['_score', { timeOfContact: 'desc' }],
        min_score: MIN_SCORE,
        from: pagination.start,
        size: pagination.limit,
        query: {
            bool: {
                should: generateContactsQueriesFromFilters({
                    searchParameters,
                }),
            },
        },
    };
};
const generateCasesQueriesFromFilters = ({ searchParameters, }) => {
    const { searchFilters, permissionFilters } = searchParameters;
    if (searchParameters.searchTerm.length === 0) {
        return permissionFilters.caseFilters.map(caseFilter => ({
            bool: {
                filter: [...caseFilter, ...searchFilters],
                should: exports.MATCH_ALL_CLAUSE,
            },
        }));
    }
    const contactsQueries = generateContactsQueriesFromFilters({
        searchParameters: { ...searchParameters, type: hrmIndexDocumentMappings_1.DocumentType.Contact },
        queryWrapper: p => ({
            documentType: hrmIndexDocumentMappings_1.DocumentType.Case,
            type: 'nested',
            path: hrmIndexDocumentMappings_1.casePathToContacts,
            innerQuery: p, // typecast to conform TS, only valid parameters should be accept
        }),
        buildParams: { parentPath: hrmIndexDocumentMappings_1.casePathToContacts },
    });
    const queries = [
        generateQueryFromSearchTerms({
            documentType: hrmIndexDocumentMappings_1.DocumentType.Case,
            fields: [
                {
                    field: 'content',
                    boost: BOOST_FACTORS.case,
                },
                {
                    field: 'id',
                    boost: BOOST_FACTORS.id * BOOST_FACTORS.case,
                },
            ],
            searchTerm: searchParameters.searchTerm,
        }),
    ];
    const sectionsQuery = generateQueryFromSearchTerms({
        documentType: hrmIndexDocumentMappings_1.DocumentType.CaseSection,
        fields: [
            {
                field: 'content',
                boost: BOOST_FACTORS.case,
            },
        ],
        searchTerm: searchParameters.searchTerm,
        queryWrapper: p => ({
            documentType: hrmIndexDocumentMappings_1.DocumentType.Case,
            type: 'nested',
            path: hrmIndexDocumentMappings_1.casePathToSections,
            innerQuery: p, // typecast to conform TS, only valid parameters should be accept
        }),
        parentPath: hrmIndexDocumentMappings_1.casePathToSections,
    });
    const caseQueries = permissionFilters.caseFilters.map(caseFilter => ({
        bool: {
            filter: [...caseFilter, ...searchFilters],
            should: [
                ...queries.map(q => ({
                    bool: { must: [q] },
                })),
                {
                    bool: { must: [sectionsQuery] },
                },
                ...contactsQueries,
            ],
        },
    }));
    return caseQueries;
};
const generateCasesQuery = ({ index, searchParameters, }) => {
    const { pagination } = searchParameters;
    return {
        index,
        highlight: {
            fields: { '*': {} },
        },
        sort: searchParameters.searchTerm.length === 0
            ? [{ createdAt: 'desc' }]
            : ['_score', { createdAt: 'desc' }],
        min_score: MIN_SCORE,
        from: pagination.start,
        size: pagination.limit,
        query: {
            bool: {
                should: generateCasesQueriesFromFilters({ searchParameters }),
            },
        },
    };
};
const isValidSearchParams = (p, type) => typeof p === 'object' && p && p.type === type;
const isSearchParametersContacts = (p) => isValidSearchParams(p, hrmIndexDocumentMappings_1.DocumentType.Contact);
const isSearchParametersCases = (p) => isValidSearchParams(p, hrmIndexDocumentMappings_1.DocumentType.Case);
const generateElasticsearchQuery = (p) => {
    const { index, searchParameters } = p;
    const sanitizedTerm = searchParameters.searchTerm.trim();
    const sanitized = { ...searchParameters, searchTerm: sanitizedTerm };
    if ((0, hrmIndexDocumentMappings_1.isHrmContactsIndex)(index) && isSearchParametersContacts(sanitized)) {
        return generateContactsQuery({ index, searchParameters: sanitized });
    }
    if ((0, hrmIndexDocumentMappings_1.isHrmCasesIndex)(index) && isSearchParametersCases(sanitized)) {
        return generateCasesQuery({ index, searchParameters: sanitized });
    }
    throw new Error(`generateElasticsearchQuery not implemented for index ${p.index} - searchParameters type ${p.searchParameters.type} `);
};
exports.generateElasticsearchQuery = generateElasticsearchQuery;
