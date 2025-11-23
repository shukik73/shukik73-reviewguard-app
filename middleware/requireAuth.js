export default function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Populate req.user from session data
  req.user = {
    id: req.session.userId,
    email: req.session.userEmail,
    companyName: req.session.companyName
  };
  
  next();
}
