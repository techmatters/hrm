FROM library/postgres:12.10
ENV POSTGRES_USER=rdsadmin
ENV POSTGRES_HOST_AUTH_METHOD=trust
ENV POSTGRES_DB=hrmdb
ADD hrmdb.sql /docker-entrypoint-initdb.d/
