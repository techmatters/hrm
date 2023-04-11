type ConfigParams = {
  configType: string;
  configId: string;
  indexType: string;
};

export const getConfig = async ({ configType, configId, indexType }: ConfigParams) => {
  let config: any = null;
  try {
    config = await require(`./config/${configId}/${configType}-${indexType}`);
  } catch (e) {
    config = await require(`./config/default/${configType}-${indexType}`);
  }

  return config;
};

export default getConfig;
