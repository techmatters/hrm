switch (process.env.NODE_ENV) {
  case 'development': {
    if (!process.env.INCLUDE_ERROR_IN_RESPONSE) {
      console.log('INCLUDE_ERROR_IN_RESPONSE not set, setting to true');
      process.env.INCLUDE_ERROR_IN_RESPONSE = 'true';
    }
  }
}
