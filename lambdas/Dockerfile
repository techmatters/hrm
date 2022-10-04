FROM public.ecr.aws/lambda/nodejs:14

################################
# This dockerfile depends on npm ci and typescipt having already been compiled
################################

# Copy compiled JS, modules, and package.json to lambda root
COPY *.js node_modules package.json  ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]