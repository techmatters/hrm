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

AUDIO_DIR = os.environ.get("AUDIO_DIR", "/shared/audio")
HUGGINGFACE_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")
DIARIZATION_MODEL = os.environ.get(
    "DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1"
)

_SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")

pipeline: Pipeline | None = None
_pipeline_lock = threading.Lock()


def sanitize_filename(filename: str) -> str | None:
    base = os.path.basename(filename)
    if not base or not _SAFE_FILENAME_RE.match(base):
        return None
    return base


def get_pipeline(use_gpu: bool) -> Pipeline:
    global pipeline
    if pipeline is None:
        with _pipeline_lock:
            if pipeline is None:
                p = Pipeline.from_pretrained(
                    DIARIZATION_MODEL,
                    token=HUGGINGFACE_TOKEN,
                    # use_auth_token=HUGGINGFACE_TOKEN,
                )
                if use_gpu and torch.cuda.is_available():
                    p.to(torch.device("cuda"))
                pipeline = p
    return pipeline


class DiarizeRequest(BaseModel):
    fileName: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "is_gpu_available": torch.cuda.is_available(),
        "diarization_model": DIARIZATION_MODEL,
    }


def diarize(use_gpu: bool):
    def inner_diarize(request: DiarizeRequest):
        safe_filename = sanitize_filename(request.fileName)
        if not safe_filename:
            raise HTTPException(status_code=400, detail="Invalid fileName")

        file_path = os.path.join(AUDIO_DIR, safe_filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

        try:
            diarization = get_pipeline(use_gpu)(file_path)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        annotation = diarization.speaker_diarization

        segments = [
            {
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
                "speaker": speaker,
            }
            for turn, _, speaker in annotation.itertracks(yield_label=True)
        ]

        return {"fileName": file_path, "segments": segments}

    return inner_diarize


@app.post("/diarize-gpu")
def diarize_gpu(request: DiarizeRequest):
    return diarize(True)(request)


@app.post("/diarize-cpu")
def diarize_cpu(request: DiarizeRequest):
    return diarize(False)(request)
