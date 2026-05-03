// Produits de saison France métropolitaine, par mois (1=janvier … 12=décembre).
// Source : calendrier INRAE / Fruits & Légumes Moches adapté.
// Pas exhaustif — représentatif des produits courants et accessibles.

const MONTHS_FR = [
  '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

type SeasonalData = { légumes: string[]; fruits: string[] }

const SEASONAL_PRODUCE: Record<number, SeasonalData> = {
  1: {
    légumes: ['mâche', 'endive', 'poireau', 'panais', 'céleri-rave', 'chou de Bruxelles', 'chou frisé', 'betterave', 'topinambour', 'carotte', 'navet', 'salsifis'],
    fruits:  ['pomme', 'poire', 'kiwi', 'clémentine', 'mandarine'],
  },
  2: {
    légumes: ['mâche', 'endive', 'poireau', 'panais', 'céleri-rave', 'chou frisé', 'betterave', 'topinambour', 'carotte', 'navet', 'épinard (début)'],
    fruits:  ['pomme', 'poire', 'kiwi'],
  },
  3: {
    légumes: ['épinard', 'oseille', 'radis', 'laitue (début)', 'asperge verte (début, sud)', 'poireau', 'carotte', 'navet', 'céleri-rave'],
    fruits:  ['pomme', 'poire', 'kiwi', 'rhubarbe (début)'],
  },
  4: {
    légumes: ['asperge blanche', 'asperge verte', 'petit pois', 'fève', 'épinard', 'laitue', 'oseille', 'radis', 'cresson', 'artichaut (sud)'],
    fruits:  ['fraise (début)', 'rhubarbe'],
  },
  5: {
    légumes: ['asperge', 'petit pois', 'fève', 'artichaut', 'courgette (début)', 'laitue', 'radis', 'épinard', 'ail nouveau', 'oignon nouveau'],
    fruits:  ['fraise', 'cerise (début)', 'rhubarbe'],
  },
  6: {
    légumes: ['courgette', 'haricot vert', 'tomate (début)', 'aubergine (début)', 'poivron (début)', 'artichaut', 'petit pois', 'concombre', 'fenouil', 'betterave (nouvelle)'],
    fruits:  ['fraise', 'cerise', 'abricot (début)', 'groseille', 'framboise'],
  },
  7: {
    légumes: ['tomate', 'courgette', 'aubergine', 'poivron', 'haricot vert', 'maïs', 'concombre', 'basilic', 'oignon', 'ail'],
    fruits:  ['abricot', 'pêche', 'nectarine', 'myrtille', 'melon', 'prune (début)', 'framboise', 'pastèque'],
  },
  8: {
    légumes: ['tomate', 'courgette', 'aubergine', 'poivron', 'haricot vert', 'maïs', 'concombre', 'brocoli', 'chou-fleur (début)', 'céleri branche'],
    fruits:  ['pêche', 'nectarine', 'prune', 'melon', 'pastèque', 'figue (début)', 'raisin (début)', 'mirabelle'],
  },
  9: {
    légumes: ['potiron', 'courge butternut', 'poireau (nouveau)', 'betterave', 'cèpe', 'girolle', 'chou-fleur', 'brocoli', 'épinard', 'fenouil', 'haricot vert', 'tomate (fin)'],
    fruits:  ['pomme', 'poire', 'raisin', 'prune', 'figue', 'mûre', 'pêche (fin)'],
  },
  10: {
    légumes: ['potiron', 'courge', 'poireau', 'chou', 'céleri-rave', 'betterave', 'champignon de Paris', 'panais', 'navet', 'topinambour', 'épinard'],
    fruits:  ['pomme', 'poire', 'raisin', 'coing', 'châtaigne'],
  },
  11: {
    légumes: ['poireau', 'chou', 'panais', 'céleri-rave', 'endive', 'betterave', 'topinambour', 'mâche', 'salsifis', 'courge', 'carotte'],
    fruits:  ['pomme', 'poire', 'coing', 'kiwi', 'châtaigne'],
  },
  12: {
    légumes: ['mâche', 'endive', 'poireau', 'panais', 'céleri-rave', 'chou de Bruxelles', 'chou frisé', 'betterave', 'topinambour', 'salsifis', 'carotte'],
    fruits:  ['pomme', 'poire', 'kiwi', 'mandarine', 'clémentine'],
  },
}

export function getSeasonalProduce(month: number): { name: string; text: string } {
  const data = SEASONAL_PRODUCE[month]
  if (!data) return { name: '', text: '' }
  return {
    name: MONTHS_FR[month] ?? '',
    text: `Légumes : ${data.légumes.join(', ')}.\nFruits : ${data.fruits.join(', ')}.`,
  }
}
