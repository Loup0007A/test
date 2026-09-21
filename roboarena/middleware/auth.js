const { Users } = require('../models/db');

// Require authentication
async function requireAuth(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await Users.findById(req.session.userId);
      if (!user) {
        return req.session.destroy(() => res.redirect('/login?error=session_expired'));
      }
      if (user.banned) {
        return req.session.destroy(() =>
          res.redirect('/login?error=banned&reason=' + encodeURIComponent(user.banReason || 'Compte banni'))
        );
      }
      req.user = user;
      return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
}

// Require admin role
// BUGFIX: this used to be `res.status(403).redirect('/')`. redirect() always
// overwrites the status code it was chained from (with a 302), so admin-only
// pages accessed by non-admins were silently served as ordinary redirects
// instead of an actual 403 response. Now renders a real 403 page.
async function requireAdmin(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await Users.findById(req.session.userId);
      if (user && user.role === 'admin' && !user.banned) {
        req.user = user;
        return next();
      }
    }
    res.status(403).render('403', {
      title: 'Accès refusé - RoboArena',
      description: "Cette page est réservée aux administrateurs.",
    });
  } catch (err) {
    next(err);
  }
}

// Optional auth (attach user if logged in)
async function optionalAuth(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await Users.findById(req.session.userId);
      if (user && !user.banned) req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Inject user into all templates
function injectUser(req, res, next) {
  res.locals.user = req.user || null;
  res.locals.siteName = 'RoboArena';
  res.locals.siteUrl = process.env.SITE_URL || 'https://roboarena.io';
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth, injectUser };
