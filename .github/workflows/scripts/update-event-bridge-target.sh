#!/usr/bin/env bash
# Copyright (C) 2021-2023 Technology Matters
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see https://www.gnu.org/licenses/.

# This script updates the ECS task definition to update the ECS task definition with the new ECS task tag for all event bridge targets

set -e

eventRuleNamePrefix=$1
ecsTaskDefinition=$2

# Targets aren't directly queryable, so we have to get the rules and then get the targets for each rule
ruleNames=$(aws events list-rules --name-prefix "${eventRuleNamePrefix}" | jq -r '.Rules[] | .Name')
returnCode=1
for ruleName in $ruleNames; do
    targets=$(aws events list-targets-by-rule --rule "$ruleName" | jq '.Targets')

    # now that we have our targets, we can update the ECS task definition target with the new task definition arn
    for target in $(echo "${targets}" | jq -c '.[]'); do
        # Individual fields on the target can't be updated, so we have to update the entire target. The fancy bit of jq at
        # the end is used to parse the entire target, but update only the task definition arn
        targetJson=$(echo "$target" | jq '{ Id, Arn, RoleArn, Input, EcsParameters }' | jq --arg ecsTaskDefinition "$ecsTaskDefinition" '.EcsParameters.TaskDefinitionArn = $ecsTaskDefinition')
        aws events put-targets \
            --rule "$ruleName" \
            --targets "${targetJson}"

        returnCode=0
    done
done

if [ $returnCode -eq 1 ]; then
    echo "No event bridge targets found for rule name prefix: $eventRuleNamePrefix"
fi
exit $returnCode
