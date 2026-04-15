const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';
  err.message    = err.message    || 'Er is een onbekende fout opgetreden';

  res.status(err.statusCode).json({
    status:  err.status,
    message: err.message,
  });
};

export default errorHandler;
