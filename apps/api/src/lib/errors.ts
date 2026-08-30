// Hiérarchie d'erreurs applicatives.
// isOperational=true : erreur attendue (mauvaise saisie, ressource introuvable…)
//   → le message peut être renvoyé tel quel au client.
// isOperational=false : bug inattendu → log complet côté serveur, message générique côté client.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requête invalide') {
    super(400, message)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') {
    super(401, message)
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Crédits insuffisants') {
    super(402, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès interdit') {
    super(403, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(404, message)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit') {
    super(409, message)
  }
}
