// Authentication middleware

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || req.session.userEmail !== adminEmail) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You do not have permission to access this page.'
    });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
