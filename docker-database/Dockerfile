FROM library/postgres:11.14
ENV POSTGRES_USER=rdsadmin
ENV POSTGRES_HOST_AUTH_METHOD=trust
ENV POSTGRES_DB=hrmdb
ADD hrmdb.sql /docker-entrypoint-initdb.d/
