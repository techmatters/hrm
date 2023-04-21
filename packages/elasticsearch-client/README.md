# Elasticsearch Client

This package provides a client for the Elasticsearch REST API and abstracts away configuration for specific index types so that it is reusable between different services and jobs.

## Configuration

There is currently only one index/user combonation, but there will be more in the fututre. The configuration is stored in the `config` directory and is loaded by the `getIndexConfig()` function in `src/get-config.js`.

There are currently 3 types of configuration for any given index/user combination:

create-index: This is the configuration for creating the index. It is used by the `create-index` wrapper.

index-document: This is the configuration for indexing documents. It is used by the `index-document` wrapper.

search: This is the configuration for searching the index. It is used by the `search` wrapper.

This list will probably grow in size and functionality as we add more index/user combinations.

## Base Client

The base ES client can be used directly via the `getClient()` function in `src/client.js`. This is useful for when you need to do something that is not covered by the wrappers.

It can be configured via a JSON encoded ENV variable called `ES_CLIENT_CONFIG`, an `config` argument can be passed in, or it will look up a JSON encoded ssm parameter in the format `/${process.env.NODE_ENV}/${indexType}/${process.env.AWS_REGION}/elasticsearch_config`. The format of these configs can be found in the [elasticsearch client documentation](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html).

## Function Wrappers

There are function wrappers for common operations that use the configuration system above to allow us to reuse the same code for different index/user combinations across various services and jobs.

The wrappers are:

create-index: This is a wrapper for the `createIndex()` function in `src/create-index.js`. It takes an index type and user and returns a function that takes an index name and returns a promise that resolves when the index is created.
delete-index: This is a wrapper for the `deleteIndex()` function in `src/delete-index.js`. It takes an index type and user and returns a function that takes an index name and returns a promise that resolves when the index is deleted.
index-document: This is a wrapper for the `indexDocument()` function in `src/index-document.js`. It takes an index type and user and returns a function that takes an index name, document id, and document body and returns a promise that resolves when the document is indexed.
refresh-index: This is a wrapper for the `refreshIndex()` function in `src/refresh-index.js`. It takes an index type and user and returns a function that takes an index name and returns a promise that resolves when the index is refreshed.
search: This is a wrapper for the `search()` function in `src/search.js`. It takes an index type and user and returns a function that takes an index name, search body, and optional search options and returns a promise that resolves with the search results.
