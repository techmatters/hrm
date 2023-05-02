#!/usr/bin/env bash

eventRuleNamePrefix=$1
ecsTaskDefinition=$2

ruleNames=$(aws events list-rules --name-prefix "${eventRuleNamePrefix}" | jq -r '.Rules[] | .Name')
for ruleName in $ruleNames; do
    aws events list-targets-by-rule --rule "$ruleName" > /tmp/event-bridge-targets.json
    targets=$(jq '.Targets' /tmp/event-bridge-targets.json)
    for target in $(echo "${targets}" | jq -c '.[]'); do
        targetId=$(echo "${target}" | jq -r '.Id')
        targetArn=$(echo "${target}" | jq -r '.Arn')
        targetRoleArn=$(echo "${target}" | jq -r '.RoleArn')
        aws events put-targets \
            --rule "$ruleName" \
            --targets "Id=$targetId,Arn=$targetArn,RoleArn=$targetRoleArn,EcsParameters={\"TaskDefinitionArn\":\"$ecsTaskDefinition\"}"
    done
done