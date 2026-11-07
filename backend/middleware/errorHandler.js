const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The uploaded file exceeds the 10 MB limit.'
      : 'The uploaded file could not be accepted.';
  } else if (err.code && err.code.startsWith('ER_')) {
    console.error('MySQL operation failed:', err.code);
    status = err.code === 'ER_DUP_ENTRY' ? 409 : 500;
    message = err.code === 'ER_DUP_ENTRY'
      ? 'A record with the same unique value already exists.'
      : 'The database operation failed. Check the backend logs and inspected schema.';
  }

  return res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = { errorHandler };
