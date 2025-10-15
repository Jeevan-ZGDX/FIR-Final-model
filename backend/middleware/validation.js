const Joi = require('joi');

/**
 * Validate FIR submission request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateFIRSubmission = (req, res, next) => {
  const schema = Joi.object({
    victimAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required()
      .messages({
        'string.pattern.base': 'Victim address must be a valid Ethereum address',
        'any.required': 'Victim address is required'
      }),
    
    // Optional additional fields
    incidentDate: Joi.date().optional(),
    location: Joi.string().max(500).optional(),
    description: Joi.string().max(2000).optional()
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  // Check if required files are present
  if (!req.files || !req.files.image || !req.files.audio) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['Both image and audio files are required']
    });
  }

  // Validate image file
  const imageFile = req.files.image[0];
  if (!imageFile) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['Image file is required']
    });
  }

  // Validate audio file
  const audioFile = req.files.audio[0];
  if (!audioFile) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['Audio file is required']
    });
  }

  // Validate file sizes (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (imageFile.size > maxSize) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['Image file size exceeds 10MB limit']
    });
  }

  if (audioFile.size > maxSize) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['Audio file size exceeds 10MB limit']
    });
  }

  // Validate file types
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
  const allowedAudioTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm'];

  if (!allowedImageTypes.includes(imageFile.mimetype)) {
    return res.status(400).json({
      error: 'Validation failed',
      details: [`Invalid image file type: ${imageFile.mimetype}. Allowed types: ${allowedImageTypes.join(', ')}`]
    });
  }

  if (!allowedAudioTypes.includes(audioFile.mimetype)) {
    return res.status(400).json({
      error: 'Validation failed',
      details: [`Invalid audio file type: ${audioFile.mimetype}. Allowed types: ${allowedAudioTypes.join(', ')}`]
    });
  }

  // Add validated data to request
  req.validatedData = value;
  next();
};

/**
 * Validate FIR ID parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateFIRId = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.number().integer().min(1).required()
      .messages({
        'number.base': 'FIR ID must be a number',
        'number.integer': 'FIR ID must be an integer',
        'number.min': 'FIR ID must be greater than 0',
        'any.required': 'FIR ID is required'
      })
  });

  const { error, value } = schema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  req.validatedParams = value;
  next();
};

/**
 * Validate victim address parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateVictimAddress = (req, res, next) => {
  const schema = Joi.object({
    address: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required()
      .messages({
        'string.pattern.base': 'Address must be a valid Ethereum address',
        'any.required': 'Victim address is required'
      })
  });

  const { error, value } = schema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  req.validatedParams = value;
  next();
};

/**
 * Validate verification request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateVerification = (req, res, next) => {
  const schema = Joi.object({
    verified: Joi.boolean().required()
      .messages({
        'boolean.base': 'Verified field must be a boolean',
        'any.required': 'Verified field is required'
      }),
    
    signature: Joi.string().optional()
      .messages({
        'string.base': 'Signature must be a string'
      }),
    
    reason: Joi.string().max(500).optional()
      .messages({
        'string.max': 'Reason must not exceed 500 characters'
      })
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  req.validatedData = value;
  next();
};

/**
 * Validate query parameters for FIR listing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateFIRQuery = (req, res, next) => {
  const schema = Joi.object({
    verified: Joi.string().valid('true', 'false').optional()
      .messages({
        'any.only': 'Verified parameter must be "true" or "false"'
      }),
    
    limit: Joi.number().integer().min(1).max(100).default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
      }),
    
    offset: Joi.number().integer().min(0).default(0)
      .messages({
        'number.base': 'Offset must be a number',
        'number.integer': 'Offset must be an integer',
        'number.min': 'Offset must not be negative'
      }),
    
    victim: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Victim address must be a valid Ethereum address'
      }),
    
    sortBy: Joi.string().valid('timestamp', 'id', 'similarityScore').default('timestamp')
      .messages({
        'any.only': 'Sort by must be one of: timestamp, id, similarityScore'
      }),
    
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
      .messages({
        'any.only': 'Sort order must be "asc" or "desc"'
      })
  });

  const { error, value } = schema.validate(req.query);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  req.validatedQuery = value;
  next();
};

/**
 * Validate wallet signature
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateSignature = (req, res, next) => {
  const schema = Joi.object({
    signature: Joi.string().required()
      .messages({
        'any.required': 'Signature is required'
      }),
    
    message: Joi.string().required()
      .messages({
        'any.required': 'Message is required'
      }),
    
    address: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required()
      .messages({
        'string.pattern.base': 'Address must be a valid Ethereum address',
        'any.required': 'Address is required'
      })
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  req.validatedSignature = value;
  next();
};

/**
 * Validate rate limiting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRateLimit = (req, res, next) => {
  // This would typically be handled by express-rate-limit middleware
  // But we can add custom rate limiting logic here if needed
  
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  // Add any custom rate limiting logic here
  req.clientInfo = {
    ip: clientIp,
    userAgent: userAgent,
    timestamp: new Date().toISOString()
  };
  
  next();
};

/**
 * Sanitize input data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };

  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body and query
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  validateFIRSubmission,
  validateFIRId,
  validateVictimAddress,
  validateVerification,
  validateFIRQuery,
  validateSignature,
  validateRateLimit,
  sanitizeInput
};

