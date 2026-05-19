function validatePassword(password) {
  const requirements = {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    specialChars: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    length: password.length >= 8,
  };

  const missing = [];
  if (!requirements.uppercase) missing.push('uppercase');
  if (!requirements.lowercase) missing.push('lowercase');
  if (!requirements.numbers) missing.push('numbers');
  if (!requirements.specialChars) missing.push('specialChars');
  if (!requirements.length) missing.push('length');

  const strengthScore = Object.values(requirements).filter(Boolean).length;
  const isStrong = strengthScore >= 4;

  return {
    isStrong,
    strengthScore,
    missing,
    requirements,
  };
}

export { validatePassword };