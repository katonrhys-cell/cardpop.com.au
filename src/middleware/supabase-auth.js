import { supabase } from '../utils/supabaseClient.js';

export async function supabaseAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')?.[1];

  if (!token) {
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      req.userId = data.user.id;
    }
    return next();
  } catch (error) {
    return next(new Error(error.message));
  }
}
