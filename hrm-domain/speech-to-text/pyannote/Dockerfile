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

FROM python:3.12-slim

ARG HUGGINGFACE_TOKEN=''
ARG task_dir=hrm-domain/speech-to-text/pyannote

# Install FFmpeg and clean up apt cache to reduce image size
RUN apt-get update && \
  apt-get install -y ffmpeg && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ${task_dir}/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY ${task_dir}/main.py ./

ENV HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN
ENV DIARIZATION_MODEL="pyannote/speaker-diarization-3.1"
EXPOSE 8081

# HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
#   CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8081/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
