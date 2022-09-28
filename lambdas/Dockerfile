FROM public.ecr.aws/lambda/nodejs:14

# Copy script files and package.json to lambda root
COPY *.js package.json ${LAMBDA_TASK_ROOT}

# Install NPM dependencies for function
RUN npm install

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]