# Agent HubSpot Cleaner

Application web pour nettoyer et enrichir des fichiers Excel avant import dans HubSpot.

## Déploiement sur GitHub Pages

1. Créez un compte sur [github.com](https://github.com) si ce n'est pas déjà fait
2. Cliquez sur **"New repository"** → nommez-le `hubspot-cleaner` → cochez **Public**
3. Uploadez les 4 fichiers : `index.html`, `config.js`, `agent.js`, `siret.js`
4. Allez dans **Settings → Pages → Source → Deploy from branch → main**
5. Votre app est accessible sur : `https://VOTRE-NOM.github.io/hubspot-cleaner`

---

## Modifier les critères de nettoyage

**Tout se passe dans `config.js`** — c'est le seul fichier à modifier pour adapter l'agent.

### Activer / désactiver une règle

```js
{
  id: 'email_format',
  enabled: true,   // ← passer à false pour désactiver
  ...
}
```

### Ajouter une nouvelle règle

Copiez ce modèle dans le tableau `RULES` de `config.js` :

```js
{
  id: 'mon_identifiant_unique',        // identifiant unique sans espace
  label: 'Mon critère',                // nom affiché dans l'interface
  description: 'Explication courte',   // tooltip
  severity: 'error',                   // 'error' | 'warning' | 'info'
  enabled: true,
  check: (row, cols) => {
    // row = objet avec toutes les colonnes de la ligne
    // cols = raccourcis vers vos colonnes (voir COLUMNS dans config.js)
    // Retournez true si la ligne est valide, false si elle a un problème
    const valeur = (row[cols.company] || '').trim();
    return valeur !== '';
  },
  message: 'Message affiché en cas de problème',
},
```

### Exemples de règles prêtes à l'emploi

Des règles commentées sont disponibles en bas du tableau `RULES` dans `config.js` :
- Nom d'entreprise obligatoire
- Prénom avec majuscule
- Code postal 5 chiffres
- Effectif renseigné

Décommentez-les simplement pour les activer.

### Changer les colonnes Excel

Si vos colonnes ont des noms différents, mettez-les à jour dans `COLUMNS` :

```js
COLUMNS: {
  email_prospect: 'Email contact',    // ← nom exact de votre colonne
  siret: 'N° SIRET',
  ...
}
```

### Ajouter des colonnes "notes" à fusionner

```js
NOTE_COLUMNS: ['Note', 'Note.1', 'Commentaire', 'Remarque'],
```

### Changer les colonnes exportées

Modifiez `EXPORT_COLUMNS` pour choisir les colonnes et leur ordre dans le fichier final.

---

## Clé API Anthropic (optionnel)

La clé API active la **synthèse IA** après analyse. Sans clé, tout le reste fonctionne.

1. Obtenez votre clé sur [console.anthropic.com](https://console.anthropic.com/)
2. Cliquez sur **"Clé API"** en haut à droite de l'interface
3. Collez votre clé — elle est stockée uniquement dans votre navigateur (sessionStorage)

> **Sécurité** : Ne collez jamais votre clé directement dans `config.js` si votre repo est public.
> Utilisez toujours le bouton dans l'interface.

---

## Structure du projet

```
hubspot-cleaner/
├── index.html    — Interface utilisateur
├── config.js     — Critères, colonnes, règles (à modifier)
├── agent.js      — Moteur de nettoyage
├── siret.js      — Enrichissement SIRET (API Sirene gouv.fr)
└── README.md     — Ce guide
```

## Fonctionnalités

- Upload drag & drop de fichiers Excel (.xlsx / .xls)
- Validation selon vos règles configurables
- Reformatage automatique des téléphones en +33
- Fusion des colonnes de notes
- Enrichissement SIRET via l'API publique Sirene (aucune clé requise)
- Synthèse IA via Claude (clé API Anthropic optionnelle)
- Export du fichier nettoyé prêt pour HubSpot
