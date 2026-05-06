## This folder contains the code for a PoC running Limina + Pyannote on an ECS machine for call transcript + speaker recognition.


### How to use
Assuming https://github.com/techmatters/infrastructure-config/pull/541 is applied.
- [optional] You can connect to the underlying EC2 instance via SSM. This is helpful for debugging.
  ```
  aws ssm start-session --target < instance-id > --region us-east-1
  ```
    - You can monitor GPU usage with
      ```
      nvidia-smi -l 1
      ```
- Give yourself enough permissions to run ECS Exec commands.
- Find `development-speech-to-text-cluster > Services > development-speech-to-text > Tasks` section on ECS console, and select the active task.
  Once you open the active task, click the `connect` button and copy the ECS Exec command given by AWS. You want to connect to the proxy service.
    ```
    aws ecs execute-command --region us-east-1 --cluster development-speech-to-text-cluster --task <task-id> --container proxy --interactive --command '/bin/sh'
    ```
- From here you can use the `commands-cli` deployed as part of the `proxy` container.
  - Use `--help` flag on any command to see details about the parameters.
  - To test if services are running
    - Pyannote
      ```
      npm run commands-cli pyannote healthcheck
      ```
    - Limina
      ```
      npm run commands-cli limina healthcheck
      ```
  - To download S3 file
    ```
    npm run commands-cli proxy get-s3-object -- -b "tl-aselo-docs-as-development" -f "voice-recordings/ACd8a2e89748318adf6ddff7df6948deaf/sample-1"
    ```
    File is saved in `AUDIO_DIR` env defined in [proxy-service](./proxy-service/Dockerfile) and [pyannote](./pyannote/Dockerfile) dockerfiles.
  - To run diarization jobs (Pyannote)
    - GPU
        ```
        npm run commands-cli proxy diarization-jobs-gpu -- -f "sample-1" -j 1
        ```
    - CPU
        ```
        npm run commands-cli proxy diarization-jobs-cpu -- -f "sample-1" -j 1
        ```
    Diarization results are saved in `DIARIZATION_DIR` env defined in [proxy-service](./proxy-service/Dockerfile) dockerfile.
  - To run transcription jobs (Limina)
    ```
    npm run commands-cli proxy transcription-jobs -- -f "sample-1" -j 1
    ```
    Diarization results are saved in `TRANSCRIPTION_DIR` env defined in [proxy-service](./proxy-service/Dockerfile) dockerfile.

### Results from testing
- On a `m7i.4xlarge` instance (CPU).
  - For Limina, concurrency seems to be off (expected).
  - This was using a 71s audio file.
    - ~17s to process 1 job.
    - ~77s to process 4 concurrent jobs.
    - ~154s to process 8 concurrent jobs.

    So the througput (RFTx) from this test seems to match the benchmark section from Limina docs (~2.8). During this tests, the CPU and memory usage was at ~30%.
- On a `g4dn.4xlarge` instance (GPU).
  - For Limina, concurrency seems to be off (unexpected).
  - This was using a 71s audio file.
    - ~2s to process 1 job.
    - ~8s to process 4 concurrent jobs.
    - ~16s to process 8 concurrent jobs.
  - This was using a 928s audio file.
    - ~25s to process 1 job.
    - ~100s to process 4 concurrent jobs.

    Througput (RFTx) from this test seems to match the benchmark section from Limina docs (~23.0). During this tests, the CPU and memory usage was at ~30%.
