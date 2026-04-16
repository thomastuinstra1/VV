const handlePrismaError = (err) => {
  // Unieke waarde al in gebruik (bv. duplicate e-mail of naam)
  if (err.code === 'P2002') {
    const veld = err.meta?.target?.join(', ') || 'veld';
    return { statusCode: 400, message: `${veld} is al in gebruik` };
  }
  // Record niet gevonden bij update of delete
  if (err.code === 'P2025') {
    return { statusCode: 404, message: 'Record niet gevonden in de database' };
  }
  // Verplicht veld is null
  if (err.code === 'P2011') {
    return { statusCode: 400, message: 'Een verplicht veld ontbreekt' };
  }
  // Ongeldige relatie (bv. Account_id bestaat niet)
  if (err.code === 'P2003') {
    return { statusCode: 400, message: 'Gekoppeld record bestaat niet' };
  }

  return { statusCode: 500, message: 'Databasefout opgetreden' };
};

const errorHandler = (err, req, res, next) => {
  // Prisma fout
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const { statusCode, message } = handlePrismaError(err);
    console.error(`[${req.method}] ${req.originalUrl} → Prisma ${err.code}: ${err.message}`);
    return res.status(statusCode).json({ status: 'fail', message });
  }

  const statusCode = err.statusCode || 500;
  const message    = err.isOperational
    ? err.message
    : 'Er is een onverwachte fout opgetreden';

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${statusCode}] ${req.method} ${req.originalUrl} → ${err.message}`);
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status:  statusCode < 500 ? 'fail' : 'error',
    message
  });
};

export default errorHandler;
