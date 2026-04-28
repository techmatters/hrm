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

FROM crprivateaiprod.azurecr.io/deid:4.0.0-gpu

ARG task_dir=hrm-domain/speech-to-text/limina

COPY ${task_dir}/entrypoint.sh /var/task/entrypoint.sh
COPY ${task_dir}/licence /app/license

WORKDIR /var/task
ENV PAI_ENABLE_AUDIO="true"

ENTRYPOINT ["/usr/bin/sh","/var/task/entrypoint.sh"]

EXPOSE 8080
