# Elastic DevTools Recipes

A collection of useful maintenance queries that you can run against an ElasticCloud deployment using the 'Dev Tools' console provided in the Elastic Cloud console

Any of these that end up being used regularly should be wrapped in our own tooling for less friction - we shouldn't be using any of these recipes in any of our standard workflows long term.

## Delete all documents from the resources index

```
POST /${lower-case-account-sid}-resources/_delete_by_query
{
  "query": {
    "match_all": {}
  }
}
```