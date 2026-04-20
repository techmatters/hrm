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
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pyannote.audio import Pipeline
import torch

app = FastAPI()

AUDIO_DIR = os.environ.get("AUDIO_DIR", "/shared/audio")
HUGGINGFACE_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")
DIARIZATION_MODEL = os.environ.get("DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1")

pipeline: Pipeline | None = None


def get_pipeline() -> Pipeline:
    global pipeline
    if pipeline is None:
        pipeline = Pipeline.from_pretrained(
            DIARIZATION_MODEL,
            token=HUGGINGFACE_TOKEN,
        )
        if torch.cuda.is_available():
            pipeline.to(torch.device("cuda"))
    return pipeline


class DiarizeRequest(BaseModel):
    fileName: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/diarize")
def diarize(request: DiarizeRequest):
    safe_filename = os.path.basename(request.fileName)
    if not safe_filename or safe_filename in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid fileName")

    file_path = os.path.join(AUDIO_DIR, safe_filename)
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
