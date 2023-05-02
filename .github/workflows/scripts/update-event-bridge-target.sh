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

set -e

eventRuleNamePrefix=$1
ecsTaskDefinition=$2

ruleNames=$(aws events list-rules --name-prefix "${eventRuleNamePrefix}" | jq -r '.Rules[] | .Name')
returnCode=1
for ruleName in $ruleNames; do
    targets=$(aws events list-targets-by-rule --rule "$ruleName" | jq '.Targets' /tmp/event-bridge-targets.json)
    for target in $(echo "${targets}" | jq -c '.[]'); do
        targetJson=$(echo "$target" | jq '{ Id, Arn, RoleArn, EcsParameters }' | jq --arg ecsTaskDefinition "$ecsTaskDefinition" '.EcsParameters.TaskDefinitionArn = $ecsTaskDefinition')
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
