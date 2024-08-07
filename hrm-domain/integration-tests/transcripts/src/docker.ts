import Docker from 'dockerode';

const docker = new Docker();

export const runContainer = async (
  imageName: string,
  env: Record<string, string>,
  copyEnvironmentVariables = true,
) => {
  console.log('Starting image:', imageName, 'Env:', env);
  const [output, container] = await docker.run(imageName, [], process.stdout, {
    Env: Object.entries({
      ...(copyEnvironmentVariables ? process.env : {}),
      ...env,
    }).map(([key, value]) => `${key}=${value}`),
    HostConfig: {
      NetworkMode: 'hrm_default',
    },
  });
  await container.remove();

  if (output.StatusCode !== 0) {
    throw new Error(
      `Container from image ${imageName} exited with status code ${output.StatusCode}`,
    );
  }
};
