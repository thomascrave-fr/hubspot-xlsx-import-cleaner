// ============================================================
//  CONFIG.JS — Critères de nettoyage HubSpot
//  Modifiez ce fichier pour ajouter ou changer des règles.
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  //  CLÉ API ANTHROPIC
  //  Collez votre clé ici (commence par "sk-ant-...")
  //  Obtenez-la sur : https://console.anthropic.com/
  // ----------------------------------------------------------
  ANTHROPIC_API_KEY: '',

  // ----------------------------------------------------------
  //  CORRESPONDANCE DES COLONNES
  //  Indiquez le nom exact de vos colonnes Excel.
  //  Laissez '' si la colonne n'existe pas dans votre fichier.
  // ----------------------------------------------------------
  COLUMNS: {
    email_prospect:  'Mail prospect',
    email_cse:       'Mail CSE',
    siret:           'SIRET entreprise',
    phone_company:   'Téléphone entreprise',
    phone_cse:       'Téléphone CSE',
    phone_mobile:    'Téléphone portable prospect',
    company:         'Nom entreprise',
    address:         'Adresse entreprise',
    zip:             'Code postal entreprise',
    city:            'Ville entreprise',
    firstname:       'Prénom',
    lastname:        'Nom',
  },

  // ----------------------------------------------------------
  //  COLONNES "NOTES" À FUSIONNER
  //  Toutes ces colonnes seront regroupées en "Notes fusionnées"
  // ----------------------------------------------------------
  NOTE_COLUMNS: ['Note', 'Note.1'],

  // ----------------------------------------------------------
  //  RÈGLES DE VALIDATION
  //  Chaque règle est vérifiée sur chaque ligne.
  //  Modifiez, ajoutez ou supprimez des règles ici.
  // ----------------------------------------------------------
  RULES: [

    {
      id: 'email_required',
      label: 'Email obligatoire',
      description: 'Chaque ligne doit avoir au moins un email (prospect ou CSE)',
      severity: 'error',   // 'error' | 'warning' | 'info'
      enabled: true,
      check: (row, cols) => {
        const val = row[cols.email_prospect] || row[cols.email_cse] || '';
        return val.trim() !== '';
      },
      message: 'Aucun email trouvé (ni prospect ni CSE)',
    },

    {
      id: 'email_format',
      label: 'Format email valide',
      description: 'L\'email doit contenir @ et un domaine valide',
      severity: 'warning',
      enabled: true,
      check: (row, cols) => {
        const val = row[cols.email_prospect] || row[cols.email_cse] || '';
        if (!val.trim()) return true; // déjà géré par email_required
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
      },
      message: 'Format email invalide',
    },

    {
      id: 'siret_required',
      label: 'SIRET obligatoire',
      description: 'Chaque ligne doit avoir un SIRET (14 chiffres)',
      severity: 'warning',
      enabled: true,
      check: (row, cols) => {
        const val = String(row[cols.siret] || '').replace(/\s/g, '');
        return val.length === 14 && /^\d+$/.test(val);
      },
      message: 'SIRET manquant ou invalide — enrichissement requis',
    },

    {
      id: 'phone_format',
      label: 'Téléphone au format +33',
      description: 'Les numéros de téléphone français doivent être au format +33',
      severity: 'info',
      enabled: true,
      check: (row, cols) => {
        const phones = [cols.phone_company, cols.phone_cse, cols.phone_mobile]
          .map(c => String(row[c] || '').trim())
          .filter(v => v !== '');
        if (phones.length === 0) return true;
        return phones.every(p => p.startsWith('+33') || p === '');
      },
      message: 'Numéro de téléphone non formaté en +33',
    },

    // ----------------------------------------------------------
    //  EXEMPLES DE RÈGLES SUPPLÉMENTAIRES — décommentez pour activer
    // ----------------------------------------------------------

    // {
    //   id: 'company_required',
    //   label: 'Nom d\'entreprise obligatoire',
    //   severity: 'error',
    //   enabled: false,
    //   check: (row, cols) => (row[cols.company] || '').trim() !== '',
    //   message: 'Nom d\'entreprise manquant',
    // },

    // {
    //   id: 'firstname_capitalized',
    //   label: 'Prénom avec majuscule',
    //   severity: 'info',
    //   enabled: false,
    //   check: (row, cols) => {
    //     const v = (row[cols.firstname] || '').trim();
    //     if (!v) return true;
    //     return v[0] === v[0].toUpperCase();
    //   },
    //   message: 'Prénom sans majuscule initiale',
    // },

    // {
    //   id: 'zip_format',
    //   label: 'Code postal 5 chiffres',
    //   severity: 'warning',
    //   enabled: false,
    //   check: (row, cols) => {
    //     const v = String(row[cols.zip] || '').trim();
    //     if (!v) return true;
    //     return /^\d{5}$/.test(v);
    //   },
    //   message: 'Code postal invalide (doit être 5 chiffres)',
    // },

    // {
    //   id: 'effectif_present',
    //   label: 'Effectif renseigné',
    //   severity: 'info',
    //   enabled: false,
    //   check: (row) => (row['Effectif entreprise'] || '').trim() !== '',
    //   message: 'Effectif entreprise non renseigné',
    // },

  ],

  // ----------------------------------------------------------
  //  OPTIONS D'EXPORT
  //  Colonnes à inclure dans le fichier Excel exporté (dans l'ordre)
  // ----------------------------------------------------------
  EXPORT_COLUMNS: [
    'Nom entreprise',
    'Prénom',
    'Nom',
    'Fonction CSE',
    'Email principal',
    'Mail prospect',
    'Mail CSE',
    'Téléphone portable prospect',
    'Téléphone entreprise',
    'Téléphone CSE',
    'SIRET entreprise',
    'Adresse entreprise',
    'Code postal entreprise',
    'Ville entreprise',
    'Effectif entreprise',
    'Commercial nom',
    'SALON',
    'Source du scan',
    'Date et heure',
    'Notes fusionnées',
  ],

};
