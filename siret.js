// ============================================================
//  SIRET.JS — Enrichissement SIRET via API Sirene (gouv.fr)
//  Appels effectués depuis le navigateur, aucune clé requise.
//
//  Stratégie en 3 passes pour maximiser la précision :
//    1. Nom + adresse + CP  (le plus précis)
//    2. Nom + ville + CP    (fallback si pas d'adresse)
//    3. Nom + CP seul       (dernier recours)
//  Chaque résultat est scoré par cohérence avec les données
//  source (CP, ville, adresse) avant d'être accepté.
// ============================================================

const Siret = {

  DELAY_MS: 200,
  MIN_CONFIDENCE: 30, // score minimum pour accepter un résultat (%)

  // ----------------------------------------------------------
  //  POINT D'ENTRÉE — recherche pour une ligne
  // ----------------------------------------------------------
  async search(row) {
    const cols = CONFIG.COLUMNS;
    const nom     = Siret._clean(row[cols.company]);
    const adresse = Siret._clean(row[cols.address]);
    const cp      = Siret._clean(row[cols.zip]);
    const ville   = Siret._clean(row[cols.city]);

    if (!nom) return { siret: null, score: 0, confidence: 0, source: 'nom manquant' };

    // Stratégie multi-passes : du plus précis au plus large
    const strategies = [];

    if (nom && adresse && cp)
      strategies.push({ q: `${nom} ${adresse}`, cp, label: 'nom+adresse+CP' });

    if (nom && ville && cp)
      strategies.push({ q: `${nom} ${ville}`, cp, label: 'nom+ville+CP' });

    if (nom && cp)
      strategies.push({ q: nom, cp, label: 'nom+CP' });

    if (nom && ville)
      strategies.push({ q: `${nom} ${ville}`, cp: '', label: 'nom+ville' });

    for (const strategy of strategies) {
      const result = await Siret._callApi(strategy.q, strategy.cp);
      if (!result.candidates.length) continue;

      // Scorer chaque candidat par cohérence avec nos données
      const scored = result.candidates.map(c =>
        Siret._scoreCandidate(c, { nom, adresse, cp, ville })
      );
      scored.sort((a, b) => b.confidence - a.confidence);
      const best = scored[0];

      if (best.confidence >= Siret.MIN_CONFIDENCE) {
        return {
          siret: best.siret,
          score: best.apiScore,
          confidence: best.confidence,
          nomLegal: best.nomLegal,
          cpFound: best.cpFound,
          strategy: strategy.label,
          source: 'API Sirene',
        };
      }
    }

    return { siret: null, score: 0, confidence: 0, source: 'non trouvé' };
  },

  // ----------------------------------------------------------
  //  APPEL API
  // ----------------------------------------------------------
  async _callApi(q, cp) {
    const params = new URLSearchParams({ q: q.substring(0, 100), per_page: '5' });
    if (cp) params.set('code_postal', cp);

    const url = 'https://recherche-entreprises.api.gouv.fr/search?' + params.toString();
    try {
      const res = await fetch(url);
      if (!res.ok) return { candidates: [], error: 'HTTP ' + res.status };
      const json = await res.json();

      // L'API retourne `results`, chaque résultat a `_score` (pas `score`)
      const candidates = (json.results || []).map(r => ({
        siret: r.siege?.siret || r.matching_etablissements?.[0]?.siret || null,
        nomLegal: r.nom_complet || r.nom_raison_sociale || '',
        cpFound: r.siege?.code_postal || '',
        villeFound: r.siege?.libelle_commune || '',
        adresseFound: r.siege?.adresse || r.siege?.libelle_voie || '',
        apiScore: Math.round(((r._score || r.score || 0)) * 100),
        raw: r,
      }));

      return { candidates };
    } catch (e) {
      return { candidates: [], error: e.message };
    }
  },

  // ----------------------------------------------------------
  //  SCORING DE COHÉRENCE
  //  Compare le résultat API avec nos données sources.
  //  Retourne un score de 0 à 100.
  // ----------------------------------------------------------
  _scoreCandidate(candidate, source) {
    let confidence = candidate.apiScore; // base = score API (0-100)

    // Bonus CP identique (+30 pts) — critère le plus fiable
    if (source.cp && candidate.cpFound) {
      const cpMatch = source.cp.replace(/\s/g, '') === candidate.cpFound.replace(/\s/g, '');
      if (cpMatch) confidence += 30;
      else confidence -= 40; // pénalité forte si le CP ne correspond pas
    }

    // Bonus ville similaire (+15 pts)
    if (source.ville && candidate.villeFound) {
      const v1 = Siret._normalize(source.ville);
      const v2 = Siret._normalize(candidate.villeFound);
      if (v2.includes(v1) || v1.includes(v2)) confidence += 15;
    }

    // Bonus nom similaire (+10 pts)
    if (source.nom && candidate.nomLegal) {
      const n1 = Siret._normalize(source.nom);
      const n2 = Siret._normalize(candidate.nomLegal);
      if (n2.includes(n1) || n1.includes(n2) || Siret._jaccardSim(n1, n2) > 0.4) {
        confidence += 10;
      }
    }

    // Pénalité si SIRET manquant
    if (!candidate.siret) confidence = 0;

    return {
      ...candidate,
      confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    };
  },

  // ----------------------------------------------------------
  //  UTILITAIRES
  // ----------------------------------------------------------
  _clean(val) {
    return (val || '').toString().trim().replace(/\s+/g, ' ');
  },

  _normalize(str) {
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\b(la|le|les|de|du|des|et|sa|sas|sarl|eurl|asso|association|sté|société)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  // Similarité de Jaccard sur les bigrammes
  _jaccardSim(a, b) {
    const bigrams = s => {
      const set = new Set();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };
    const ba = bigrams(a), bb = bigrams(b);
    const inter = [...ba].filter(x => bb.has(x)).length;
    const union = new Set([...ba, ...bb]).size;
    return union === 0 ? 0 : inter / union;
  },

  // ----------------------------------------------------------
  //  ENRICHISSEMENT EN MASSE avec callbacks
  // ----------------------------------------------------------
  async enrichAll(rows, { onProgress, onResult, shouldStop }) {
    const toEnrich = rows.filter(r =>
      r.cleaned[CONFIG.COLUMNS.siret] === '[À enrichir]'
    );
    let done = 0;

    for (const row of toEnrich) {
      if (shouldStop && shouldStop()) break;

      const result = await Siret.search(row.cleaned);
      row.siretResult = result;

      if (result.siret) {
        row.cleaned[CONFIG.COLUMNS.siret] = result.siret;
      }

      done++;
      if (onProgress) onProgress(done, toEnrich.length, row, result);
      if (onResult) onResult(row, result);

      await new Promise(r => setTimeout(r, Siret.DELAY_MS));
    }

    return rows;
  },
};
