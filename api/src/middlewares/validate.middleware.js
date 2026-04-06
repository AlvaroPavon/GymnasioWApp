export const validateSchema = (schema) => (req, res, next) => {
  try {
    const validData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    // Replace parsed info to ensure sanitization
    req.body = validData.body;
    req.query = validData.query;
    req.params = validData.params;
    next();
  } catch (err) {
    return res.status(400).json({
      message: 'Error de validación de campos',
      errors: err.errors
    });
  }
};
