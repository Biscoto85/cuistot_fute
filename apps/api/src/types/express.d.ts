// Augmentation du type Request d'Express pour injecter req.user via requireAuth.
// Toutes les routes protégées peuvent accéder à req.user sans vérification null.
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string
        email: string
      }
    }
  }
}

export {}
