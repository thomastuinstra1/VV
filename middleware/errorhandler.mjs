const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message    = err.isOperational
    ? err.message
    : 'Er is een onverwachte fout opgetreden';

  if (process.env.NODE_ENV === 'development') {
    console.error('[${statusCode}] ${err.message}');
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status:  statusCode < 500 ? 'fail' : 'error',
    message
  });
};

export default errorHandler;