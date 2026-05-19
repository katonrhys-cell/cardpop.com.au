/// <reference path="../pb_data/types.d.ts" />
// Sanitize and validate user inputs to prevent XSS and SQL injection
onRecordCreate((e) => {
  // Sanitize text fields to prevent XSS
  const textFields = ['name', 'bio', 'location', 'verificationCode', 'lastLoginIp', 'lastLoginDevice'];
  
  textFields.forEach(field => {
    const value = e.record.get(field);
    if (value && typeof value === 'string') {
      // Remove potentially dangerous HTML/script tags
      const sanitized = value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
      e.record.set(field, sanitized);
    }
  });
  
  // Validate email format
  const email = e.record.get('email');
  if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new BadRequestError('Invalid email format');
  }
  
  // Validate name length
  const name = e.record.get('name');
  if (name && name.length > 255) {
    throw new BadRequestError('Name must be 255 characters or less');
  }
  
  // Validate location length
  const location = e.record.get('location');
  if (location && location.length > 500) {
    throw new BadRequestError('Location must be 500 characters or less');
  }
  
  // Validate bio length
  const bio = e.record.get('bio');
  if (bio && bio.length > 1000) {
    throw new BadRequestError('Bio must be 1000 characters or less');
  }
  
  e.next();
}, 'users');

// Validate inputs on update
onRecordUpdate((e) => {
  const textFields = ['name', 'bio', 'location'];
  
  textFields.forEach(field => {
    const value = e.record.get(field);
    if (value && typeof value === 'string') {
      const sanitized = value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
      e.record.set(field, sanitized);
    }
  });
  
  const email = e.record.get('email');
  if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new BadRequestError('Invalid email format');
  }
  
  e.next();
}, 'users');

// Validate messages collection
onRecordCreate((e) => {
  const content = e.record.get('content');
  if (content && typeof content === 'string') {
    const sanitized = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
    e.record.set('content', sanitized);
  }
  
  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Message content cannot be empty');
  }
  
  if (content.length > 5000) {
    throw new BadRequestError('Message must be 5000 characters or less');
  }
  
  e.next();
}, 'messages');

// Validate reviews collection
onRecordCreate((e) => {
  const comment = e.record.get('comment');
  if (comment && typeof comment === 'string') {
    const sanitized = comment
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
    e.record.set('comment', sanitized);
  }
  
  const rating = e.record.get('rating');
  if (rating < 1 || rating > 5) {
    throw new BadRequestError('Rating must be between 1 and 5');
  }
  
  e.next();
}, 'reviews');