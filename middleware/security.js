export function createBasicAuth(pool) {
  return async function basicAuth(req, res, next) {
    const userEmail = req.session?.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = await pool.query(
        'SELECT admin_auth_enabled FROM user_settings WHERE user_email = $1',
        [userEmail]
      );
      
      const adminAuthEnabled = result.rows[0]?.admin_auth_enabled === true;
      
      if (!adminAuthEnabled) {
        return next();
      }

      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ error: 'Admin password required' });
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      const [username, password] = credentials.split(':');

      const adminUser = process.env.ADMIN_USER;
      const adminPass = process.env.ADMIN_PASS;

      if (!adminUser || !adminPass) {
        console.error('ADMIN_USER and ADMIN_PASS environment variables not set');
        return res.status(500).json({ error: 'Admin credentials not configured in secrets' });
      }

      if (username === adminUser && password === adminPass) {
        return next();
      }

      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Invalid admin credentials' });
    } catch (error) {
      console.error('Admin auth check error:', error);
      return next();
    }
  };
}

export function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminUser || !adminPass) {
    console.error('ADMIN_USER and ADMIN_PASS environment variables not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (username === adminUser && password === adminPass) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).json({ error: 'Invalid credentials' });
}
