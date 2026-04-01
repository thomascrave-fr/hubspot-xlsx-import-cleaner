// ============================================================
//  AGENT.JS — Moteur de nettoyage HubSpot
//  Ce fichier contient la logique de transformation des données.
//  Modifiez les fonctions de nettoyage si besoin.
// ============================================================

const Agent = {

  // ----------------------------------------------------------
  //  NETTOYAGE D'UNE LIGNE
  // ----------------------------------------------------------
  cleanRow(row) {
    const cols = CONFIG.COLUMNS;
    const cleaned = Object.assign({}, row);
    const actions = [];

    // 1. Email principal (prospect en priorité, sinon CSE)
    const emailProspect = (cleaned[cols.email_prospect] || '').trim();
    const emailCse = (cleaned[cols.email_cse] || '').trim();
    cleaned['Email principal'] = emailProspect || emailCse || '';

    // 2. Reformatage téléphones en +33
    [cols.phone_company, cols.phone_cse, cols.phone_mobile].forEach(col => {
      if (!col || !cleaned[col]) return;
      const original = String(cleaned[col]).trim();
      const formatted = Agent.formatPhone(original);
      if (formatted !== original) {
        cleaned[col] = formatted;
        actions.push('Tél. reformaté : ' + original + ' → ' + formatted);
      }
    });

    // 3. Fusion des colonnes notes
    const noteParts = CONFIG.NOTE_COLUMNS
      .map(nc => String(cleaned[nc] || '').trim())
      .filter(v => v !== '' && v !== '0');
    if (noteParts.length > 0) {
      cleaned['Notes fusionnées'] = noteParts.join(' | ');
      if (CONFIG.NOTE_COLUMNS.length > 1) {
        actions.push('Notes fusionnées (' + CONFIG.NOTE_COLUMNS.join(', ') + ')');
      }
    } else {
      cleaned['Notes fusionnées'] = '';
    }
    CONFIG.NOTE_COLUMNS.slice(1).forEach(nc => delete cleaned[nc]);

    // 4. Nettoyage SIRET
    const rawSiret = String(cleaned[cols.siret] || '').replace(/\s/g, '');
    if (rawSiret.length === 14 && /^\d+$/.test(rawSiret)) {
      cleaned[cols.siret] = rawSiret;
    } else {
      const canEnrich = (cleaned[cols.company] || '').trim() || (cleaned[cols.address] || '').trim();
      cleaned[cols.siret] = canEnrich ? '[À enrichir]' : '';
      if (canEnrich) actions.push('SIRET marqué pour enrichissement');
    }

    // 5. Normalisation texte optionnelle
    [cols.firstname, cols.lastname].forEach(col => {
      if (!col || !cleaned[col]) return;
      const v = String(cleaned[col]).trim();
      const capitalized = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
      if (capitalized !== v) {
        cleaned[col] = capitalized;
      }
    });

    return { cleaned, actions };
  },

  // ----------------------------------------------------------
  //  VALIDATION D'UNE LIGNE (retourne la liste des problèmes)
  // ----------------------------------------------------------
  validateRow(row) {
    const cols = CONFIG.COLUMNS;
    const issues = [];
    CONFIG.RULES.filter(r => r.enabled).forEach(rule => {
      if (!rule.check(row, cols)) {
        issues.push({ id: rule.id, label: rule.label, message: rule.message, severity: rule.severity });
      }
    });
    return issues;
  },

  // ----------------------------------------------------------
  //  TRAITEMENT COMPLET DU FICHIER
  // ----------------------------------------------------------
  processAll(rawRows) {
    const results = rawRows.map((row, index) => {
      const { cleaned, actions } = Agent.cleanRow(row);
      const issues = Agent.validateRow(cleaned);
      return { original: row, cleaned, actions, issues, index };
    });

    const stats = {
      total: results.length,
      errors: results.filter(r => r.issues.some(i => i.severity === 'error')).length,
      warnings: results.filter(r => r.issues.some(i => i.severity === 'warning')).length,
      clean: results.filter(r => r.issues.length === 0).length,
      toEnrich: results.filter(r => r.cleaned[CONFIG.COLUMNS.siret] === '[À enrichir]').length,
      companies: new Set(results.map(r => (r.cleaned[CONFIG.COLUMNS.company] || '').trim()).filter(Boolean)).size,
    };

    return { results, stats };
  },

  // ----------------------------------------------------------
  //  REFORMATAGE TÉLÉPHONE FRANÇAIS → +33
  // ----------------------------------------------------------
  formatPhone(val) {
    if (!val) return val;
    let s = val.replace(/[\s.\-()]/g, '');
    if (s.startsWith('+33')) return val;
    if (s.startsWith('0033')) return '+33' + s.slice(4);
    if (s.startsWith('33') && s.length >= 11) return '+' + s;
    if (s.startsWith('0') && s.length === 10) return '+33' + s.slice(1);
    return val;
  },

  // ----------------------------------------------------------
  //  SYNTHÈSE IA VIA CLAUDE (clé côté client — usage privé)
  // ----------------------------------------------------------
  async getAISummary(stats, filename) {
    const apiKey = CONFIG.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const prompt = `Tu es un expert CRM HubSpot. Analyse ce fichier "${filename}" :
- ${stats.total} contacts, ${stats.companies} entreprises uniques
- ${stats.errors} lignes avec erreurs bloquantes (email manquant...)
- ${stats.warnings} lignes avec avertissements (SIRET, format...)
- ${stats.toEnrich} SIRET à enrichir via API Sirene
- ${stats.clean} lignes propres prêtes à importer

Donne une synthèse en 4-5 phrases : qualité globale, priorités avant import, conseil pratique. Français, direct, sans bullet points ni markdown.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.map(b => b.text || '').join('') || null;
    } catch {
      return null;
    }
  },
};
