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

import os
import re
import threading
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pyannote.audio import Pipeline
import torch

app = FastAPI()

# AUDIO_DIR = os.environ.get("AUDIO_DIR", "/shared/audio")
# AUDIO_DIR = "/shared/audio"
HUGGINGFACE_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")
DIARIZATION_MODEL = os.environ.get("DIARIZATION_MODEL")

_SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")

pipeline: Pipeline | None = None
_pipeline_lock = threading.Lock()


def sanitize_filename(filename: str) -> str | None:
    base = os.path.basename(filename)
    if not base or not _SAFE_FILENAME_RE.match(base):
        return None
    return base


def get_pipeline() -> Pipeline:
    global pipeline
    if pipeline is None:
        with _pipeline_lock:
            if pipeline is None:
                p = Pipeline.from_pretrained(
                    DIARIZATION_MODEL,
                    token=HUGGINGFACE_TOKEN,
                )
                if torch.cuda.is_available():
                    p.to(torch.device("cuda"))
                pipeline = p
    return pipeline


class DiarizeRequest(BaseModel):
    fileName: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/diarize")
def diarize(request: DiarizeRequest):
    safe_filename = sanitize_filename(request.fileName)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid fileName")

    # file_path = os.path.join(AUDIO_DIR, safe_filename)
    file_path = safe_filename
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {safe_filename}")

    try:
        diarization = get_pipeline()(file_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    segments = [
        {"start": round(turn.start, 3), "end": round(turn.end, 3), "speaker": speaker}
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]

    return {"fileName": safe_filename, "segments": segments}
