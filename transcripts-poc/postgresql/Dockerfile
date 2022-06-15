FROM library/postgres:12.10
ENV POSTGRES_USER=rdsadmin
ENV POSTGRES_HOST_AUTH_METHOD=trust
ENV POSTGRES_DB=hrm_transcripts_db
ADD hrm_transcripts_db.sql /docker-entrypoint-initdb.d/
