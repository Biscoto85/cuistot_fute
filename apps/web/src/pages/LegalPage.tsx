export function LegalPage() {
  return (
    <div className="max-w-2xl space-y-8 text-sm text-stone-700 leading-relaxed">
      <h1 className="text-xl font-semibold text-stone-800">Mentions légales</h1>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Éditeur</h2>
        <p>Cuistot Futé est une application personnelle exploitée à titre privé.</p>
        <p>Contact : via le compte utilisateur.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Hébergement</h2>
        <p>L'application est hébergée sur un serveur privé virtuel (VPS) dédié.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Données personnelles</h2>
        <p>
          Cuistot Futé collecte uniquement les données nécessaires au fonctionnement du service :
          adresse e-mail, préférences alimentaires, historique de repas et notations.
        </p>
        <p>
          Ces données sont stockées sur un serveur sécurisé et ne sont jamais transmises à des tiers
          à des fins commerciales.
        </p>
        <p>
          Les mots de passe sont hashés avec argon2 et ne sont jamais stockés en clair.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Cookies</h2>
        <p>
          L'application utilise un unique cookie d'authentification (<code className="text-xs bg-stone-100 px-1 py-0.5 rounded">auth_token</code>),
          httpOnly, sécurisé, sans tracking ni analytics tiers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Intelligence artificielle</h2>
        <p>
          Les plans de repas sont générés via l'API Anthropic (Claude). Vos préférences et historiques
          sont envoyés à l'API pour produire des suggestions personnalisées. Aucune donnée n'est utilisée
          pour entraîner des modèles tiers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-stone-800">Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité
          et de suppression de vos données. Ces fonctionnalités sont accessibles directement depuis
          votre compte, dans la section <strong>Préférences → Compte</strong>.
        </p>
      </section>

      <p className="text-xs text-stone-400">Dernière mise à jour : mai 2026.</p>
    </div>
  )
}
